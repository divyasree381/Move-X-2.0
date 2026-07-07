const Redis = require('ioredis');
const redis = new Redis('redis://localhost:6379');

async function check() {
  const keys = await redis.keys('identity:otp:latest:*');
  console.log('Keys:', keys);
  for (const key of keys) {
    const value = await redis.get(key);
    console.log(key, '->', value);
  }
  redis.disconnect();
}
check();
