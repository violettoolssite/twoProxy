/**
 * 内部接口 - 供 Nginx auth_request 调用
 * 这些接口只应从本机访问，不对外暴露
 */

const express = require('express');
const config = require('../config');
const db = require('../lib/db');
const redis = require('../lib/redis');

const router = express.Router();

/**
 * GET /api/internal/auth - Nginx auth_request 鉴权接口
 * 
 * 请求头：
 * - X-Subdomain: 用户子域名
 * - X-Original-URI: 原始请求路径
 * - X-Real-IP: 客户端 IP
 * 
 * 响应头（成功时）：
 * - X-User-Id: 用户 ID
 * - X-Plan: 订阅套餐
 * - X-Rate-Limit: 限速（bytes/s）
 */
router.get('/auth', async (req, res) => {
  try {
    const subdomain = req.headers['x-subdomain'];
    const originalUri = req.headers['x-original-uri'] || '/';
    const clientIp = req.headers['x-real-ip'] || req.ip;

    // 为爱发电模式：无限制访问
    // 无子域名 = 公共访问，不记录流量
    if (!subdomain) {
      res.set('X-Plan', 'free');
      res.set('X-Rate-Limit', '0'); // 0 表示不限速
      return res.status(200).send('OK');
    }

    // 从缓存获取用户信息
    const cacheKey = `subdomain:${subdomain}`;
    let userInfo = await redis.get(cacheKey);

    if (userInfo) {
      userInfo = JSON.parse(userInfo);
    } else {
      // 查询数据库
      userInfo = await db.queryOne(
        `SELECT u.id, u.status FROM users u
         WHERE u.subdomain = ? AND u.status = 'active'`,
        [subdomain]
      );

      if (userInfo) {
        // 缓存 5 分钟
        await redis.set(cacheKey, JSON.stringify(userInfo), 300);
      }
    }

    // 子域名不存在或用户不活跃
    if (!userInfo) {
      return res.status(403).send('Invalid subdomain');
    }

    // 为爱发电模式：无流量限制、无速度限制、无过期检查
    res.set('X-User-Id', String(userInfo.id));
    res.set('X-Plan', 'unlimited');
    res.set('X-Rate-Limit', '0'); // 0 表示不限速
    res.status(200).send('OK');

  } catch (err) {
    console.error('[Internal Auth] Error:', err);
    res.status(500).send('Internal error');
  }
});

/**
 * POST/GET /api/internal/log - 记录请求日志和流量
 * 
 * 由 Nginx 日志模块或 post_action 调用
 * 支持 GET（Nginx post_action）和 POST 两种方式
 */
router.post('/log', async (req, res) => {
  await handleLogRequest(req, res);
});

router.get('/log', async (req, res) => {
  await handleLogRequest(req, res);
});

async function handleLogRequest(req, res) {
  try {
    // 支持 GET 和 POST 两种方式
    const userId = req.body?.user_id || req.query?.user_id;
    const requestType = req.body?.request_type || req.query?.request_type || 'other';
    const bytesTransferred = parseInt(req.body?.bytes_transferred || req.query?.bytes_transferred || 0);
    const requestPath = req.body?.path || req.query?.path || req.body?.request_path || req.query?.request_path || '';
    const requestMethod = req.body?.request_method || req.query?.request_method || req.method;
    const responseCode = req.body?.response_code || req.query?.response_code || 200;
    const responseTimeMs = req.body?.response_time_ms || req.query?.response_time_ms || null;
    const userAgent = req.body?.user_agent || req.query?.user_agent || req.headers['user-agent'] || '';
    const ipAddress = req.body?.ip || req.query?.ip || req.ip;
    const referer = req.body?.referer || req.query?.referer || req.headers['referer'] || '';
    const subdomain = req.body?.subdomain || req.query?.subdomain || null;

    // 插入访问日志
    await db.insert(
      `INSERT INTO access_logs 
       (user_id, subdomain, request_type, request_path, request_method,
        response_code, bytes_transferred, response_time_ms, user_agent, ip_address, referer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        subdomain || null,
        requestType,
        requestPath,
        requestMethod,
        responseCode,
        bytesTransferred,
        responseTimeMs,
        userAgent,
        ipAddress,
        referer,
      ]
    );

    // 更新每日流量统计
    if (userId && bytesTransferred > 0) {
      const today = new Date().toISOString().split('T')[0];
      
      // 确定请求类型字段
      let typeField = '';
      switch (requestType) {
        case 'github': typeField = ', github_requests = github_requests + 1'; break;
        case 'docker': typeField = ', docker_requests = docker_requests + 1'; break;
        case 'file': typeField = ', file_requests = file_requests + 1'; break;
      }

      await db.query(
        `INSERT INTO traffic_stats (user_id, date, bytes_used, requests_count)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE 
           bytes_used = bytes_used + VALUES(bytes_used),
           requests_count = requests_count + 1
           ${typeField}`,
        [userId, today, bytesTransferred]
      );

      // 更新 Redis 缓存中的流量统计（用于实时查询）
      const usageKey = `usage:${userId}:${today}`;
      await redis.incrBy(usageKey, bytesTransferred);
      await redis.expire(usageKey, 86400 * 2); // 2 天过期
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('[Internal Log] Error:', err);
    res.status(500).send('Error');
  }
}

/**
 * GET /api/internal/check-traffic - 检查用户流量
 */
router.get('/check-traffic', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const subscription = await db.queryOne(
      `SELECT monthly_traffic_bytes FROM subscriptions WHERE user_id = ?`,
      [userId]
    );

    const monthlyUsage = await getMonthlyUsage(userId);
    const extraTraffic = await getExtraTraffic(userId);

    const limit = subscription?.monthly_traffic_bytes || 0;
    const used = monthlyUsage;
    const remaining = Math.max(0, limit - used) + extraTraffic;

    res.json({
      limit,
      used,
      extra: extraTraffic,
      remaining,
      exceeded: remaining <= 0,
    });
  } catch (err) {
    console.error('[CheckTraffic] Error:', err);
    res.status(500).json({ error: 'Error' });
  }
});

// 获取当月已使用流量
async function getMonthlyUsage(userId) {
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  const result = await db.queryOne(
    `SELECT COALESCE(SUM(bytes_used), 0) as total
     FROM traffic_stats
     WHERE user_id = ? AND date >= ?`,
    [userId, firstDayOfMonth.toISOString().split('T')[0]]
  );

  return parseInt(result?.total) || 0;
}

// 获取额外流量包剩余
async function getExtraTraffic(userId) {
  const result = await db.queryOne(
    `SELECT COALESCE(SUM(bytes_total - bytes_used), 0) as remaining
     FROM traffic_packs
     WHERE user_id = ? AND bytes_used < bytes_total
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  );

  return parseInt(result?.remaining) || 0;
}

module.exports = router;

