const express = require('express');
const crypto = require('crypto');

const app = express();

const ACCESS_ID = process.env.TUYA_ACCESS_ID;
const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;
const DEVICE_ID = process.env.TUYA_DEVICE_ID;
const BASE_URL = 'https://openapi.tuyaeu.com'; // EU datacenter

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
  const signStr = ACCESS_ID + token + t + stringToSign;
  
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
    
    res.json({
      online: device.result?.online ?? false,
      name: device.result?.name,
      timestamp: new Date().toISOString()
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
