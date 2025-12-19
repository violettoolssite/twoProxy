const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../lib/db');
const redis = require('../lib/redis');

/**
 * JWT 认证中间件
 */
const authenticate = async (req, res, next) => {
  try {
    // 从 Header 获取 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未登录或登录已过期' });
    }

    const token = authHeader.substring(7);

    // 检查 token 是否在黑名单中（登出时添加）
    const isBlacklisted = await redis.get(`token:blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: '登录已失效，请重新登录' });
    }

    // 验证 token
    const decoded = jwt.verify(token, config.jwt.secret);

    // 从缓存或数据库获取用户信息
    const cacheKey = `user:${decoded.userId}`;
    let user = await redis.get(cacheKey);

    if (user) {
      user = JSON.parse(user);
    } else {
      user = await db.queryOne(
        `SELECT id, email, nickname, subdomain, api_key, status FROM users WHERE id = ?`,
        [decoded.userId]
      );

      if (user) {
        await redis.set(cacheKey, JSON.stringify(user), 300); // 缓存 5 分钟
      }
    }

    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: '账户已被禁用' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的登录凭证' });
    }
    console.error('[Auth] Error:', err);
    return res.status(500).json({ error: '认证服务异常' });
  }
};

/**
 * API Key 认证中间件（用于 API 调用）
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({ error: '缺少 API Key' });
    }

    // 从缓存或数据库获取用户信息
    const cacheKey = `apikey:${apiKey}`;
    let user = await redis.get(cacheKey);

    if (user) {
      user = JSON.parse(user);
    } else {
      user = await db.queryOne(
        `SELECT u.id, u.email, u.nickname, u.subdomain, u.status,
                s.plan, s.api_daily_limit
         FROM users u
         LEFT JOIN subscriptions s ON u.id = s.user_id
         WHERE u.api_key = ? AND u.status = 'active'`,
        [apiKey]
      );

      if (user) {
        await redis.set(cacheKey, JSON.stringify(user), 300);
      }
    }

    if (!user) {
      return res.status(401).json({ error: '无效的 API Key' });
    }

    // 检查 API 调用限制
    if (user.api_daily_limit > 0) {
      const today = new Date().toISOString().split('T')[0];
      const limitKey = `api:limit:${user.id}:${today}`;
      const currentCount = parseInt(await redis.get(limitKey)) || 0;

      if (currentCount >= user.api_daily_limit) {
        return res.status(429).json({ error: '已达到今日 API 调用限制' });
      }

      await redis.incr(limitKey);
      // 设置过期时间为明天 0 点
      const ttl = await redis.ttl(limitKey);
      if (ttl < 0) {
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        const secondsUntilMidnight = Math.floor((midnight - new Date()) / 1000);
        await redis.expire(limitKey, secondsUntilMidnight);
      }
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[ApiKey Auth] Error:', err);
    return res.status(500).json({ error: '认证服务异常' });
  }
};

/**
 * 可选认证（不强制要求登录）
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await db.queryOne(
      `SELECT id, email, nickname, subdomain, status FROM users WHERE id = ?`,
      [decoded.userId]
    );

    if (user && user.status === 'active') {
      req.user = user;
    }
  } catch (err) {
    // 忽略认证错误，继续执行
  }
  next();
};

module.exports = {
  authenticate,
  authenticateApiKey,
  optionalAuth,
};

