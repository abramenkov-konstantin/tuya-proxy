const express = require('express');
const crypto = require('crypto');

const app = express();

const ACCESS_ID = process.env.TUYA_ACCESS_ID;
const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;
const DEVICE_ID = process.env.TUYA_DEVICE_ID;
const BASE_URL = 'https://openapi.tuyaeu.com';

async function getToken() {
  const t = Date.now().toString();
  const method = 'GET';
  const signUrl = '/v1.0/token?grant_type=1';
  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  
  const stringToSign = [method, contentHash, '', signUrl].join('\n');
  const signStr = ACCESS_ID + t + stringToSign;
  
  const sign = crypto
    .createHmac('sha256', ACCESS_SECRET)
    .update(signStr)
    .digest('hex')
    .toUpperCase();

  const response = await fetch(`${BASE_URL}${signUrl}`, {
    headers: {
      'client_id': ACCESS_ID,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256'
    }
  });
  
  const data = await response.json();
  return data.result.access_token;
}

async function getDeviceStatus(token) {
  const t = Date.now().toString();
  const method = 'GET';
  const signUrl = `/v1.0/devices/${DEVICE_ID}`;
  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  
  const stringToSign = [method, contentHash, '', signUrl].join('\n');
  const signStr = ACCESS_ID + token + t + signUrl;
  
  const sign = crypto
    .createHmac('sha256', ACCESS_SECRET)
    .update(signStr)
    .digest('hex')
    .toUpperCase();

  const response = await fetch(`${BASE_URL}${signUrl}`, {
    headers: {
      'client_id': ACCESS_ID,
      'access_token': token,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256'
    }
  });
  
  return await response.json();
}

app.get('/status', async (req, res) => {
  try {
    const token = await getToken();
    const device = await getDeviceStatus(token);
    
    let voltage = null;
    let current = null;
    let power = null;
    
    const phaseA = device.result?.status?.find(s => s.code === 'phase_a');
    if (phaseA) {
      const buffer = Buffer.from(phaseA.value, 'base64');
      voltage = (buffer[0] << 8 | buffer[1]) / 10;
      current = (buffer[2] << 16 | buffer[3] << 8 | buffer[4]) / 1000;
      power = (buffer[5] << 16 | buffer[6] << 8 | buffer[7]);
    }
    
    // Перевірка алертів
    const alerts = [];
    if (voltage !== null) {
      if (voltage < 200) alerts.push(`⚠️ Низька напруга: ${voltage}В`);
      if (voltage > 250) alerts.push(`⚠️ Висока напруга: ${voltage}В`);
    }
    
    const currentOnline = device.result?.online ?? false;
    
    // Форматувати час
    const now = new Date();
    const timestamp = now.toLocaleString('uk-UA', { 
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    res.json({
      online: currentOnline,
      voltage,
      current,
      power,
      hasAlerts: alerts.length > 0,
      alerts,
      timestamp
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Tuya Proxy running on port ${PORT}`);
});
