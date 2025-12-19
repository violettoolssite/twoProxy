const express = require('express');
const config = require('../config');
const db = require('../lib/db');
const redis = require('../lib/redis');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/subscription - 获取当前订阅信息
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const subscription = await db.queryOne(
      `SELECT * FROM subscriptions WHERE user_id = ?`,
      [req.user.id]
    );

    if (!subscription) {
      return res.status(404).json({ error: '未找到订阅信息' });
    }

    const planInfo = config.plans[subscription.plan] || config.plans.free;

    // 计算剩余天数
    let daysRemaining = null;
    if (subscription.expires_at) {
      const now = new Date();
      const expires = new Date(subscription.expires_at);
      daysRemaining = Math.max(0, Math.ceil((expires - now) / (1000 * 60 * 60 * 24)));
    }

    res.json({
      plan: subscription.plan,
      planName: planInfo.name,
      price: planInfo.price,
      monthlyTrafficBytes: subscription.monthly_traffic_bytes,
      bandwidthLimitMbps: subscription.bandwidth_limit_mbps,
      concurrentLimit: subscription.concurrent_limit,
      apiDailyLimit: subscription.api_daily_limit,
      startedAt: subscription.started_at,
      expiresAt: subscription.expires_at,
      daysRemaining,
      autoRenew: subscription.auto_renew,
      hasSubdomain: planInfo.hasSubdomain,
    });
  } catch (err) {
    console.error('[Subscription] Error:', err);
    res.status(500).json({ error: '获取订阅信息失败' });
  }
});

/**
 * GET /api/subscription/plans - 获取所有套餐
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = Object.entries(config.plans).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      price: plan.price,
      priceDisplay: plan.price > 0 ? `¥${(plan.price / 100).toFixed(2)}/月` : '免费',
      monthlyTrafficBytes: plan.monthlyTrafficBytes,
      monthlyTrafficDisplay: formatBytes(plan.monthlyTrafficBytes),
      bandwidthLimitMbps: plan.bandwidthLimitMbps,
      concurrentLimit: plan.concurrentLimit,
      apiDailyLimit: plan.apiDailyLimit,
      apiDailyLimitDisplay: plan.apiDailyLimit < 0 ? '无限制' : `${plan.apiDailyLimit}/天`,
      hasSubdomain: plan.hasSubdomain,
    }));

    res.json({ plans });
  } catch (err) {
    console.error('[Plans] Error:', err);
    res.status(500).json({ error: '获取套餐列表失败' });
  }
});

/**
 * POST /api/subscription/upgrade - 升级套餐（创建订单）
 */
router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !config.plans[plan]) {
      return res.status(400).json({ error: '无效的套餐' });
    }

    if (plan === 'free') {
      return res.status(400).json({ error: '无法购买免费套餐' });
    }

    // 固定按 1 个月计费，前端不再传自定义月份
    const monthsNum = 1;
    const planInfo = config.plans[plan];
    const amount = planInfo.price * monthsNum;

    // 创建订单
    const orderNo = `ORDER_${Date.now()}_${req.user.id}_${Math.random().toString(36).substring(2, 8)}`;

    const orderId = await db.insert(
      `INSERT INTO orders (user_id, order_no, order_type, plan, months, amount_cents, status)
       VALUES (?, ?, 'subscription', ?, ?, ?, 'pending')`,
      [req.user.id, orderNo, plan, monthsNum, amount]
    );

    res.json({
      orderId,
      orderNo,
      plan,
      planName: planInfo.name,
      months: monthsNum,
      amount,
      amountDisplay: `¥${(amount / 100).toFixed(2)}`,
    });
  } catch (err) {
    console.error('[Upgrade] Error:', err);
    res.status(500).json({ error: '创建订单失败' });
  }
});

/**
 * POST /api/subscription/toggle-auto-renew - 切换自动续费
 */
router.post('/toggle-auto-renew', authenticate, async (req, res) => {
  try {
    const subscription = await db.queryOne(
      `SELECT auto_renew FROM subscriptions WHERE user_id = ?`,
      [req.user.id]
    );

    const newValue = !subscription.auto_renew;

    await db.update(
      `UPDATE subscriptions SET auto_renew = ? WHERE user_id = ?`,
      [newValue, req.user.id]
    );

    res.json({
      message: newValue ? '已开启自动续费' : '已关闭自动续费',
      autoRenew: newValue,
    });
  } catch (err) {
    console.error('[ToggleAutoRenew] Error:', err);
    res.status(500).json({ error: '操作失败' });
  }
});

/**
 * 内部方法：激活订阅（支付成功后调用）
 */
async function activateSubscription(userId, plan, months) {
  const planInfo = config.plans[plan];
  if (!planInfo) throw new Error('Invalid plan');

  const now = new Date();
  
  // 获取当前订阅
  const currentSub = await db.queryOne(
    `SELECT * FROM subscriptions WHERE user_id = ?`,
    [userId]
  );

  let newExpiresAt;
  if (currentSub && currentSub.expires_at && new Date(currentSub.expires_at) > now) {
    // 叠加时间
    newExpiresAt = new Date(currentSub.expires_at);
  } else {
    newExpiresAt = now;
  }
  newExpiresAt.setMonth(newExpiresAt.getMonth() + months);

  // 更新订阅
  await db.update(
    `UPDATE subscriptions SET 
       plan = ?,
       monthly_traffic_bytes = ?,
       bandwidth_limit_mbps = ?,
       concurrent_limit = ?,
       api_daily_limit = ?,
       expires_at = ?,
       updated_at = NOW()
     WHERE user_id = ?`,
    [
      plan,
      planInfo.monthlyTrafficBytes,
      planInfo.bandwidthLimitMbps,
      planInfo.concurrentLimit,
      planInfo.apiDailyLimit,
      newExpiresAt,
      userId,
    ]
  );

  // 清除缓存
  await redis.del(`user:${userId}`);
  const user = await db.queryOne(`SELECT subdomain FROM users WHERE id = ?`, [userId]);
  if (user?.subdomain) {
    await redis.del(`subdomain:${user.subdomain}`);
  }

  return { expiresAt: newExpiresAt };
}

// 格式化字节数
function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(0)} TB`;
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

module.exports = router;
module.exports.activateSubscription = activateSubscription;

