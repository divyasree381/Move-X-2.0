const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

async function inspectOtpChallenges() {
  const keys = await redis.keys('identity:otp:latest:*');
  console.log('Keys:', keys);

  for (const key of keys) {
    const value = await redis.get(key);
    console.log(key, '->', value);
  }

  redis.disconnect();
}

inspectOtpChallenges().catch((error) => {
  console.error(error);
  redis.disconnect();
  process.exitCode = 1;
});
