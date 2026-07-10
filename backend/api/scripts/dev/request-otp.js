const http = require('http');

const phone = process.env.MOVEX_TEST_PHONE;
const role = process.env.MOVEX_TEST_ROLE ?? 'RESTAURANT';

if (!phone) {
  console.error('Set MOVEX_TEST_PHONE before running this script.');
  process.exit(1);
}

const data = JSON.stringify({ phone, role });

const req = http.request(
  {
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/auth/otp/request',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  },
  (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => { console.log('Response:', res.statusCode, body); });
  },
);

req.on('error', (error) => { console.error(error); });
req.write(data);
req.end();
