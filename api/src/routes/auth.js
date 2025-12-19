const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../lib/db');
const redis = require('../lib/redis');
const { sendResetPasswordMail } = require('../lib/mailer');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 邮箱格式验证
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// 密码强度验证（至少 8 位，包含字母和数字）
const isValidPassword = (password) => /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/.test(password);

// 子域名格式验证（3-20 位字母数字，以字母开头）
const isValidSubdomain = (subdomain) => /^[a-z][a-z0-9]{2,19}$/.test(subdomain);

/**
 * POST /api/auth/register - 用户注册
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname, inviteCode } = req.body;

    // 参数验证
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ error: '密码至少 8 位，需包含字母和数字' });
    }

    // 检查是否开放注册
    const regEnabled = await db.queryOne(
      `SELECT config_value FROM system_config WHERE config_key = 'registration_enabled'`
    );
    if (regEnabled?.config_value === 'false') {
      return res.status(403).json({ error: '暂未开放注册' });
    }

    // 检查是否仅限邀请注册
    const inviteOnly = await db.queryOne(
      `SELECT config_value FROM system_config WHERE config_key = 'invite_only'`
    );
    if (inviteOnly?.config_value === 'true' && !inviteCode) {
      return res.status(400).json({ error: '需要邀请码才能注册' });
    }

    // 检查邮箱是否已存在
    const existingUser = await db.queryOne(
      `SELECT id FROM users WHERE email = ?`,
      [email.toLowerCase()]
    );
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    // 验证邀请码（新系统：基于用户ID）
    let inviterId = null;
    if (inviteCode) {
      // 邀请码格式：YLJD + 6位用户ID（如 YLJD000001）
      const match = inviteCode.toUpperCase().match(/^YLJD(\d{6})$/);
      if (!match) {
        return res.status(400).json({ error: '邀请码格式不正确' });
      }
      
      const userId = parseInt(match[1], 10);
      const inviter = await db.queryOne(
        `SELECT id FROM users WHERE id = ? AND status = 'active'`,
        [userId]
      );
      
      if (!inviter) {
        return res.status(400).json({ error: '邀请码无效' });
      }
      
      inviterId = inviter.id;
    }

    // 创建用户
    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').substring(0, 32);

    const userId = await db.insert(
      `INSERT INTO users (email, password_hash, nickname, api_key, inviter_id, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [email.toLowerCase(), passwordHash, nickname || email.split('@')[0], apiKey, inviterId]
    );

    // 创建默认订阅（免费版）
    const freePlan = config.plans.free;
    await db.insert(
      `INSERT INTO subscriptions (user_id, plan, monthly_traffic_bytes, bandwidth_limit_mbps, 
                                  concurrent_limit, api_daily_limit)
       VALUES (?, 'free', ?, ?, ?, ?)`,
      [userId, freePlan.monthlyTrafficBytes, freePlan.bandwidthLimitMbps,
       freePlan.concurrentLimit, freePlan.apiDailyLimit]
    );

    // 记录邀请关系
    if (inviterId) {
      // 可以在这里添加邀请奖励逻辑
      console.log(`[Register] User ${userId} invited by ${inviterId}`);
    }

    // 生成 JWT
    const token = jwt.sign(
      { userId, email: email.toLowerCase() },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: userId,
        email: email.toLowerCase(),
        nickname: nickname || email.split('@')[0],
        apiKey,
      },
    });
  } catch (err) {
    console.error('[Register] Error:', err);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

/**
 * POST /api/auth/login - 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }

    // 查找用户
    const user = await db.queryOne(
      `SELECT id, email, password_hash, nickname, subdomain, api_key, status
       FROM users WHERE email = ?`,
      [email.toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: '账户已被禁用，请联系客服' });
    }

    if (user.status === 'deleted') {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 更新最后登录时间
    await db.update(
      `UPDATE users SET last_login_at = NOW() WHERE id = ?`,
      [user.id]
    );

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // 清除用户缓存
    await redis.del(`user:${user.id}`);

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        subdomain: user.subdomain,
        apiKey: user.api_key,
      },
    });
  } catch (err) {
    console.error('[Login] Error:', err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

/**
 * POST /api/auth/logout - 登出
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // 将 token 加入黑名单
    const token = req.token;
    const decoded = jwt.decode(token);
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      await redis.set(`token:blacklist:${token}`, '1', ttl);
    }

    // 清除用户缓存
    await redis.del(`user:${req.user.id}`);

    res.json({ message: '登出成功' });
  } catch (err) {
    console.error('[Logout] Error:', err);
    res.status(500).json({ error: '登出失败' });
  }
});

/**
 * POST /api/auth/refresh - 刷新 Token
 */
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const newToken = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({ token: newToken });
  } catch (err) {
    console.error('[Refresh] Error:', err);
    res.status(500).json({ error: '刷新失败' });
  }
});

/**
 * POST /api/auth/change-password - 修改密码
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请填写原密码和新密码' });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ error: '新密码至少 8 位，需包含字母和数字' });
    }

    // 验证原密码
    const user = await db.queryOne(
      `SELECT password_hash FROM users WHERE id = ?`,
      [req.user.id]
    );

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: '原密码错误' });
    }

    // 更新密码
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(
      `UPDATE users SET password_hash = ? WHERE id = ?`,
      [newHash, req.user.id]
    );

    // 清除所有登录状态（让用户重新登录）
    await redis.del(`user:${req.user.id}`);

    res.json({ message: '密码修改成功，请重新登录' });
  } catch (err) {
    console.error('[ChangePassword] Error:', err);
    res.status(500).json({ error: '修改失败' });
  }
});

/**
 * POST /api/auth/forgot-password - 忘记密码（发送重置链接）
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: '请输入邮箱地址' });
    }

    // 查找用户
    const user = await db.queryOne(
      `SELECT id, email, status FROM users WHERE email = ?`,
      [email.toLowerCase()]
    );

    // 无论用户是否存在，都返回相同的消息（防止邮箱枚举攻击）
    if (!user || user.status !== 'active') {
      // 延迟返回，模拟发送邮件的时间
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.json({ 
        message: '如果该邮箱已注册，重置链接将发送到您的邮箱' 
      });
    }

    // 生成重置 token（1小时有效）
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1小时后过期

    // 存储到 Redis
    await redis.set(
      `password:reset:${resetToken}`,
      JSON.stringify({ userId: user.id, email: user.email }),
      3600 // 1小时
    );

    const resetLink = `https://mirror.yljdteam.com/user/reset-password?token=${resetToken}`;

    try {
      // 发送重置密码邮件
      await sendResetPasswordMail(user.email, resetLink);
    } catch (mailErr) {
      console.error('[ForgotPassword] Mail send error:', mailErr);
      // 邮件发送失败也不暴露细节给前端
    }

    // 返回成功消息
    res.json({ 
      message: '如果该邮箱已注册，重置链接将发送到您的邮箱',
      // 开发模式下返回 token（生产环境应删除这行）
      ...(process.env.NODE_ENV !== 'production' && { _dev_token: resetToken })
    });
  } catch (err) {
    console.error('[ForgotPassword] Error:', err);
    res.status(500).json({ error: '发送失败，请稍后重试' });
  }
});

/**
 * POST /api/auth/reset-password - 重置密码
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ error: '密码至少 8 位，需包含字母和数字' });
    }

    // 从 Redis 获取重置信息
    const resetData = await redis.get(`password:reset:${token}`);
    if (!resetData) {
      return res.status(400).json({ error: '重置链接无效或已过期' });
    }

    const { userId, email } = JSON.parse(resetData);

    // 更新密码
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(
      `UPDATE users SET password_hash = ? WHERE id = ?`,
      [newHash, userId]
    );

    // 删除重置 token
    await redis.del(`password:reset:${token}`);

    // 清除用户缓存
    await redis.del(`user:${userId}`);

    console.log(`[ResetPassword] Password reset for user ${userId} (${email})`);

    res.json({ message: '密码重置成功，请使用新密码登录' });
  } catch (err) {
    console.error('[ResetPassword] Error:', err);
    res.status(500).json({ error: '重置失败，请稍后重试' });
  }
});

/**
 * GET /api/auth/verify-reset-token - 验证重置 token 是否有效
 */
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ valid: false, error: '缺少 token' });
    }

    const resetData = await redis.get(`password:reset:${token}`);
    if (!resetData) {
      return res.json({ valid: false, error: '链接无效或已过期' });
    }

    const { email } = JSON.parse(resetData);
    // 返回部分邮箱信息（隐藏中间部分）
    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    res.json({ valid: true, email: maskedEmail });
  } catch (err) {
    console.error('[VerifyResetToken] Error:', err);
    res.status(500).json({ valid: false, error: '验证失败' });
  }
});

module.exports = router;

