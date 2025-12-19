const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../lib/db');
const redis = require('../lib/redis');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 子域名格式验证
const isValidSubdomain = (subdomain) => /^[a-z][a-z0-9]{2,19}$/.test(subdomain);

// 保留子域名列表
const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'root', 'mail', 'smtp', 'ftp', 'ssh', 'test',
  'dev', 'staging', 'prod', 'app', 'static', 'cdn', 'assets', 'img',
  'images', 'js', 'css', 'file', 'files', 'download', 'downloads',
  'github', 'docker', 'git', 'hub', 'registry', 'mirror', 'proxy',
  'user', 'users', 'account', 'auth', 'login', 'register', 'signup',
  'payment', 'pay', 'billing', 'support', 'help', 'docs', 'blog',
];

/**
 * GET /api/user/profile - 获取用户信息
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.nickname, u.subdomain, u.api_key, 
              u.created_at, u.last_login_at,
              s.plan, s.monthly_traffic_bytes, s.bandwidth_limit_mbps,
              s.concurrent_limit, s.api_daily_limit, s.expires_at, s.auto_renew
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 获取当月流量使用
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const trafficStats = await db.queryOne(
      `SELECT COALESCE(SUM(bytes_used), 0) as bytes_used,
              COALESCE(SUM(requests_count), 0) as requests_count
       FROM traffic_stats
       WHERE user_id = ? AND date >= ?`,
      [req.user.id, firstDayOfMonth.toISOString().split('T')[0]]
    );

    // 获取额外流量包
    const trafficPacks = await db.query(
      `SELECT id, bytes_total, bytes_used, expires_at
       FROM traffic_packs
       WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY expires_at ASC`,
      [req.user.id]
    );

    const planInfo = config.plans[user.plan] || config.plans.free;

    // 获取邀请统计
    const inviteStats = await db.queryOne(
      `SELECT COUNT(*) as invited_count FROM users WHERE inviter_id = ?`,
      [req.user.id]
    );

    // 获取团队成员数（包括自己和所有被邀请的用户）
    const teamStats = await db.queryOne(
      `SELECT COUNT(*) as team_count FROM users 
       WHERE id = ? OR inviter_id = ? OR inviter_id IN (SELECT id FROM users WHERE inviter_id = ?)`,
      [req.user.id, req.user.id, req.user.id]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        subdomain: user.subdomain,
        subdomainUrl: user.subdomain ? `https://${user.subdomain}.${config.domain}` : null,
        apiKey: user.api_key,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        invitedCount: inviteStats.invited_count || 0,
        teamMembersCount: teamStats.team_count || 0,
      },
      subscription: {
        plan: user.plan,
        planName: planInfo.name,
        monthlyTrafficBytes: user.monthly_traffic_bytes,
        bandwidthLimitMbps: user.bandwidth_limit_mbps,
        concurrentLimit: user.concurrent_limit,
        apiDailyLimit: user.api_daily_limit,
        expiresAt: user.expires_at,
        autoRenew: user.auto_renew,
        hasSubdomain: planInfo.hasSubdomain,
      },
      usage: {
        bytesUsed: parseInt(trafficStats.bytes_used) || 0,
        requestsCount: parseInt(trafficStats.requests_count) || 0,
        trafficPacks: trafficPacks.map(p => ({
          id: p.id,
          bytesTotal: p.bytes_total,
          bytesUsed: p.bytes_used,
          bytesRemaining: p.bytes_total - p.bytes_used,
          expiresAt: p.expires_at,
        })),
      },
    });
  } catch (err) {
    console.error('[Profile] Error:', err);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

/**
 * PUT /api/user/profile - 更新用户信息
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { nickname } = req.body;

    if (nickname !== undefined) {
      if (typeof nickname !== 'string' || nickname.length > 100) {
        return res.status(400).json({ error: '昵称长度不能超过 100 个字符' });
      }

      await db.update(
        `UPDATE users SET nickname = ? WHERE id = ?`,
        [nickname.trim(), req.user.id]
      );
    }

    // 清除缓存
    await redis.del(`user:${req.user.id}`);

    res.json({ message: '更新成功' });
  } catch (err) {
    console.error('[UpdateProfile] Error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

/**
 * POST /api/user/subdomain - 申请/更换子域名
 */
router.post('/subdomain', authenticate, async (req, res) => {
  try {
    const { subdomain } = req.body;

    if (!subdomain) {
      return res.status(400).json({ error: '请填写子域名' });
    }

    const subdomainLower = subdomain.toLowerCase();

    if (!isValidSubdomain(subdomainLower)) {
      return res.status(400).json({ 
        error: '子域名格式不正确（3-20 位字母数字，以字母开头）' 
      });
    }

    if (RESERVED_SUBDOMAINS.includes(subdomainLower)) {
      return res.status(400).json({ error: '该子域名为保留名称，请换一个' });
    }

    // 免费开放模式：所有用户都可以使用子域名功能

    // 检查子域名是否已被使用
    const existing = await db.queryOne(
      `SELECT id FROM users WHERE subdomain = ? AND id != ?`,
      [subdomainLower, req.user.id]
    );

    if (existing) {
      return res.status(400).json({ error: '该子域名已被使用，请换一个' });
    }

    // 更新子域名
    await db.update(
      `UPDATE users SET subdomain = ? WHERE id = ?`,
      [subdomainLower, req.user.id]
    );

    // 清除缓存
    await redis.del(`user:${req.user.id}`);
    if (req.user.subdomain) {
      await redis.del(`subdomain:${req.user.subdomain}`);
    }

    res.json({
      message: '子域名设置成功',
      subdomain: subdomainLower,
      url: `https://${subdomainLower}.${config.domain}`,
    });
  } catch (err) {
    console.error('[Subdomain] Error:', err);
    res.status(500).json({ error: '设置失败' });
  }
});

/**
 * GET /api/user/api-key - 获取 API Key
 */
router.get('/api-key', authenticate, async (req, res) => {
  try {
    const user = await db.queryOne(
      `SELECT api_key FROM users WHERE id = ?`,
      [req.user.id]
    );

    res.json({ apiKey: user.api_key });
  } catch (err) {
    console.error('[GetApiKey] Error:', err);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * POST /api/user/api-key/refresh - 刷新 API Key
 */
router.post('/api-key/refresh', authenticate, async (req, res) => {
  try {
    const newApiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').substring(0, 32);

    await db.update(
      `UPDATE users SET api_key = ? WHERE id = ?`,
      [newApiKey, req.user.id]
    );

    // 清除旧 API Key 缓存
    if (req.user.api_key) {
      await redis.del(`apikey:${req.user.api_key}`);
    }
    await redis.del(`user:${req.user.id}`);

    res.json({ 
      message: 'API Key 已刷新',
      apiKey: newApiKey 
    });
  } catch (err) {
    console.error('[RefreshApiKey] Error:', err);
    res.status(500).json({ error: '刷新失败' });
  }
});

/**
 * GET /api/user/traffic/stats - 获取流量统计
 */
router.get('/traffic/stats', authenticate, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = Math.min(Math.max(parseInt(days) || 30, 1), 365);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum + 1);
    startDate.setHours(0, 0, 0, 0);

    const stats = await db.query(
      `SELECT date, bytes_used, requests_count, 
              github_requests, docker_requests, file_requests
       FROM traffic_stats
       WHERE user_id = ? AND date >= ?
       ORDER BY date ASC`,
      [req.user.id, startDate.toISOString().split('T')[0]]
    );

    // 填充缺失的日期
    const result = [];
    const statsMap = new Map(stats.map(s => [s.date.toISOString().split('T')[0], s]));

    for (let i = 0; i < daysNum; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const stat = statsMap.get(dateStr);
      result.push({
        date: dateStr,
        bytesUsed: stat ? parseInt(stat.bytes_used) : 0,
        requestsCount: stat ? parseInt(stat.requests_count) : 0,
        githubRequests: stat ? parseInt(stat.github_requests) : 0,
        dockerRequests: stat ? parseInt(stat.docker_requests) : 0,
        fileRequests: stat ? parseInt(stat.file_requests) : 0,
      });
    }

    // 计算总计
    const total = result.reduce((acc, cur) => ({
      bytesUsed: acc.bytesUsed + cur.bytesUsed,
      requestsCount: acc.requestsCount + cur.requestsCount,
    }), { bytesUsed: 0, requestsCount: 0 });

    res.json({
      days: daysNum,
      total,
      daily: result,
    });
  } catch (err) {
    console.error('[TrafficStats] Error:', err);
    res.status(500).json({ error: '获取统计失败' });
  }
});

/**
 * GET /api/user/team-members - 获取团队成员及活动
 */
router.get('/team-members', authenticate, async (req, res) => {
  try {
    // 获取团队成员（包括自己和被邀请的用户）
    const members = await db.query(
      `SELECT id, email, nickname, subdomain, created_at,
              CASE WHEN id = ? THEN 1 ELSE 0 END as is_self
       FROM users 
       WHERE (id = ? OR inviter_id = ?) AND status = 'active'
       ORDER BY is_self DESC, created_at DESC`,
      [req.user.id, req.user.id, req.user.id]
    );

    // 为每个成员获取最近的活动记录（最多5条）
    const membersWithActivities = await Promise.all(
      members.map(async (member) => {
        const activities = await db.query(
          `SELECT request_type as type, request_path as path, created_at
           FROM access_logs
           WHERE user_id = ? AND request_type IN ('github', 'docker', 'file')
           ORDER BY created_at DESC
           LIMIT 5`,
          [member.id]
        );

        return {
          id: member.id,
          email: member.email,
          nickname: member.nickname,
          subdomain: member.subdomain,
          created_at: member.created_at,
          is_self: member.is_self === 1,
          recent_activities: activities.map(activity => ({
            type: activity.type,
            path: formatActivityPath(activity.path, activity.type),
            created_at: activity.created_at,
          })),
        };
      })
    );

    res.json({
      members: membersWithActivities,
    });
  } catch (err) {
    console.error('[Team Members] Error:', err);
    res.status(500).json({ error: '获取团队成员失败' });
  }
});

/**
 * 格式化活动路径，提取关键信息
 */
function formatActivityPath(path, type) {
  if (!path) return '-';
  
  try {
    // GitHub: 提取仓库名
    if (type === 'github') {
      const match = path.match(/github\.com\/([^\/]+\/[^\/]+)/);
      if (match) return match[1];
    }
    
    // Docker: 提取镜像名
    if (type === 'docker') {
      const match = path.match(/\/v2\/([^\/]+)\/manifests/);
      if (match) return match[1];
      const match2 = path.match(/\/v2\/library\/([^\/]+)/);
      if (match2) return match2[1];
    }
    
    // 文件下载: 提取文件名
    if (type === 'file') {
      const match = path.match(/\/([^\/]+)$/);
      if (match) return match[1];
    }
    
    // 如果路径太长，截断
    if (path.length > 60) {
      return path.substring(0, 57) + '...';
    }
    
    return path;
  } catch (e) {
    return path;
  }
}

module.exports = router;

