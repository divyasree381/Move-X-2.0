const http = require('http');

const data = JSON.stringify({
  phone: "8019971381",
  role: "RESTAURANT"
});

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/auth/otp/request',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
