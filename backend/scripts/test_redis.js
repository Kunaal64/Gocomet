require('dotenv').config();
const Redis = require('ioredis');

async function testConnection() {
    console.log('Testing Redis Connection...');
    const config = process.env.REDIS_URL || {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    };

    console.log('Using Config:', typeof config === 'string' ? config.replace(/:[^:@]*@/, ':****@') : config);

    const redis = new Redis(config);

    try {
        await redis.connect();
        console.log('✅ Connected successfully!');

        await redis.set('test_key', 'Hello Upstash!');
        const val = await redis.get('test_key');
        console.log('✅ Read/Write test passed: retrieved', val);

        await redis.del('test_key');
        console.log('✅ Cleanup successful');

    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    } finally {
        redis.quit();
    }
}

testConnection();
