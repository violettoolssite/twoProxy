const { createClient } = require('redis');
const config = require('../config');

let client = null;

const getClient = async () => {
  if (client && client.isOpen) {
    return client;
  }

  client = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
    },
    password: config.redis.password || undefined,
  });

  client.on('error', (err) => {
    console.error('[Redis] Error:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  await client.connect();
  return client;
};

// 封装常用方法
const redis = {
  async get(key) {
    const c = await getClient();
    return c.get(key);
  },

  async set(key, value, ttlSeconds = 0) {
    const c = await getClient();
    if (ttlSeconds > 0) {
      return c.setEx(key, ttlSeconds, value);
    }
    return c.set(key, value);
  },

  async del(key) {
    const c = await getClient();
    return c.del(key);
  },

  async incr(key) {
    const c = await getClient();
    return c.incr(key);
  },

  async incrBy(key, amount) {
    const c = await getClient();
    return c.incrBy(key, amount);
  },

  async expire(key, seconds) {
    const c = await getClient();
    return c.expire(key, seconds);
  },

  async ttl(key) {
    const c = await getClient();
    return c.ttl(key);
  },

  // 获取或设置（带缓存）
  async getOrSet(key, ttlSeconds, fetchFn) {
    let value = await this.get(key);
    if (value !== null) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    const result = await fetchFn();
    const toStore = typeof result === 'object' ? JSON.stringify(result) : result;
    await this.set(key, toStore, ttlSeconds);
    return result;
  },
};

module.exports = redis;

