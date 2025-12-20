const express = require('express');
const config = require('../config');
const db = require('../lib/db');
const redis = require('../lib/redis');
const { authenticate } = require('../middleware/auth');
const { activateSubscription } = require('./subscription');

const router = express.Router();

// 简单的管理员校验：仅允许特定邮箱
const ADMIN_EMAILS = ['1494458927@qq.com', 'violet@yljdteam.com'];

function requireAdmin(req, res, next) {
  if (!req.user || !ADMIN_EMAILS.includes(req.user.email)) {
    return res.status(403).json({ error: '仅限站长访问' });
  }
  next();
}

// 所有管理接口都需要登录 + 管理员
router.use(authenticate, requireAdmin);

/**
 * GET /api/admin/orders - 获取所有用户的订单列表
 * 支持分页与按状态过滤
 */
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];

    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const ordersSql = `
      SELECT o.id, o.order_no, o.order_type, o.plan, o.months, o.amount_cents,
             o.status, o.payment_method, o.paid_at, o.created_at,
             u.email, u.nickname
      FROM orders o
      INNER JOIN users u ON o.user_id = u.id
      ${whereSql}
      ORDER BY o.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const orders = await db.query(ordersSql, params);

    const totalResult = await db.queryOne(
      `SELECT COUNT(*) as total
       FROM orders o
       ${whereSql}`,
      params
    );

    res.json({
      orders: orders.map((o) => ({
        orderNo: o.order_no,
        userEmail: o.email,
        userNickname: o.nickname,
        orderType: o.order_type,
        plan: o.plan,
        planName: o.plan ? config.plans[o.plan]?.name : null,
        months: o.months,
        amount: o.amount_cents,
        amountDisplay: `¥${(o.amount_cents / 100).toFixed(2)}`,
        status: o.status,
        statusText: getStatusText(o.status),
        paymentMethod: o.payment_method,
        paidAt: o.paid_at,
        createdAt: o.created_at,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / limitNum),
      },
    });
  } catch (err) {
    console.error('[Admin Orders] Error:', err);
    res.status(500).json({ error: '获取订单列表失败' });
  }
});

/**
 * POST /api/admin/orders/:orderNo/mark-paid
 * 标记订单为已支付，并在是订阅订单时激活套餐
 */
router.post('/orders/:orderNo/mark-paid', async (req, res) => {
  try {
    const { orderNo } = req.params;

    const order = await db.queryOne(
      `SELECT * FROM orders WHERE order_no = ?`,
      [orderNo]
    );

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    if (order.status === 'paid') {
      return res.json({ message: '订单已是已支付状态' });
    }

    // 更新订单状态为已支付
    await db.update(
      `UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = ?`,
      [order.id]
    );

    // 如果是订阅订单，激活订阅（按订单中的 plan 和 months）
    if (order.order_type === 'subscription' && order.plan) {
      const months = order.months || 1;
      await activateSubscription(order.user_id, order.plan, months);
      console.log(`[Admin] Subscription activated: user=${order.user_id}, plan=${order.plan}, months=${months}`);
    }

    // 清除与用户相关的缓存
    await redis.del(`user:${order.user_id}`);

    res.json({ message: '已标记为已支付并更新订阅（如适用）' });
  } catch (err) {
    console.error('[Admin MarkPaid] Error:', err);
    res.status(500).json({ error: '操作失败' });
  }
});

function getStatusText(status) {
  const statusMap = {
    pending: '待支付',
    paid: '已支付',
    refunded: '已退款',
    cancelled: '已取消',
    expired: '已过期',
  };
  return statusMap[status] || status;
}

/**
 * GET /api/admin/sms-users - 获取所有用户的SMS使用情况
 * 支持分页和搜索
 */
router.get('/sms-users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];

    if (search) {
      where.push('(u.email LIKE ? OR u.nickname LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 查询用户列表
    // 注意: MySQL的prepared statement不支持LIMIT参数绑定，需要直接拼接
    // limitNum和offset已经过parseInt验证，是安全的整数
    const usersSql = `
      SELECT u.id, u.email, u.nickname,
             u.sms_usage_count, u.sms_usage_limit, u.sms_last_used_at,
             u.created_at
      FROM users u
      ${whereSql}
      ORDER BY u.sms_usage_count DESC, u.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const users = await db.pool.query(usersSql, params).then(([rows]) => rows);

    // 查询总数
    const countSql = `SELECT COUNT(*) as total FROM users u ${whereSql}`;
    const [[{ total }]] = await db.pool.query(countSql, params);

    res.json({
      success: true,
      data: {
        users: users.map(u => ({
          id: u.id,
          email: u.email,
          nickname: u.nickname,
          smsUsageCount: u.sms_usage_count || 0,
          smsUsageLimit: u.sms_usage_limit || 3,
          smsLastUsedAt: u.sms_last_used_at,
          createdAt: u.created_at
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (err) {
    console.error('[Admin] Get SMS users failed:', err);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

/**
 * POST /api/admin/sms-users/:userId/update-limit - 修改用户SMS使用次数限制
 * Body: { limit: number, resetCount: boolean }
 */
router.post('/sms-users/:userId/update-limit', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, resetCount } = req.body;

    if (typeof limit !== 'number' || limit < 0) {
      return res.status(400).json({ error: '次数限制必须是非负整数' });
    }

    // 检查用户是否存在
    const user = await db.queryOne('SELECT id, email FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 更新限制
    const updates = ['sms_usage_limit = ?'];
    const params = [limit];

    if (resetCount) {
      updates.push('sms_usage_count = 0');
    }

    await db.update(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      [...params, userId]
    );

    // 清除用户缓存
    await redis.del(`user:${userId}`);

    // 获取更新后的数据
    const updatedUser = await db.queryOne(
      'SELECT sms_usage_count, sms_usage_limit FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: `已更新用户 ${user.email} 的SMS额度`,
      data: {
        smsUsageCount: updatedUser.sms_usage_count || 0,
        smsUsageLimit: updatedUser.sms_usage_limit || 3
      }
    });
  } catch (err) {
    console.error('[Admin] Update SMS limit failed:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

/**
 * GET /api/admin/sms-stats - 获取SMS使用统计
 */
router.get('/sms-stats', async (req, res) => {
  try {
    const stats = await db.queryOne(`
      SELECT 
        COUNT(*) as totalUsers,
        SUM(sms_usage_count) as totalUsage,
        COUNT(CASE WHEN sms_usage_count >= sms_usage_limit THEN 1 END) as usersAtLimit,
        COUNT(CASE WHEN sms_usage_count > 0 THEN 1 END) as activeUsers
      FROM users
    `);

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('[Admin] Get SMS stats failed:', err);
    res.status(500).json({ error: '获取统计失败' });
  }
});

module.exports = router;


