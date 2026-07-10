import { HttpSmsProvider } from './src/infrastructure/sms/http-sms.provider';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const provider = new HttpSmsProvider();
  console.log('Sending test SMS...');
  try {
    await provider.sendOtp({ phoneE164: '+918297808410', code: '1234', purpose: 'LOGIN' });
    console.log('Done!');
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
