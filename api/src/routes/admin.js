const express = require('express');
const config = require('../config');
const db = require('../lib/db');
const redis = require('../lib/redis');
const { authenticate } = require('../middleware/auth');
const { activateSubscription } = require('./subscription');

const router = express.Router();

// 简单的管理员校验：仅允许特定邮箱
const ADMIN_EMAILS = ['1494458927@qq.com'];

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

module.exports = router;


