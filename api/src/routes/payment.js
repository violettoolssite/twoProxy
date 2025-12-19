const express = require('express');
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');
const config = require('../config');
const db = require('../lib/db');
const redis = require('../lib/redis');
const { authenticate } = require('../middleware/auth');
const { activateSubscription } = require('./subscription');

const router = express.Router();

/**
 * POST /api/payment/create - 创建支付订单
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const { orderNo, paymentMethod = 'wechat' } = req.body;

    if (!orderNo) {
      return res.status(400).json({ error: '缺少订单号' });
    }

    // 查询订单
    const order = await db.queryOne(
      `SELECT * FROM orders WHERE order_no = ? AND user_id = ?`,
      [orderNo, req.user.id]
    );

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: '订单状态无效' });
    }

    // 检查订单是否过期（30 分钟）
    const orderAge = Date.now() - new Date(order.created_at).getTime();
    if (orderAge > 30 * 60 * 1000) {
      await db.update(
        `UPDATE orders SET status = 'expired' WHERE id = ?`,
        [order.id]
      );
      return res.status(400).json({ error: '订单已过期，请重新创建' });
    }

    // 更新支付方式
    await db.update(
      `UPDATE orders SET payment_method = ? WHERE id = ?`,
      [paymentMethod, order.id]
    );

    // 生成支付参数（以 PayJS 为例）
    const payjs = config.payment.payjs;
    
    if (!payjs.mchid || !payjs.key) {
      return res.status(500).json({ error: '支付未配置，请联系管理员' });
    }

    const planInfo = config.plans[order.plan];
    const body = `Mirror加速 - ${planInfo?.name || order.plan} ${order.months}个月`;

    const params = {
      mchid: payjs.mchid,
      total_fee: order.amount_cents,
      out_trade_no: order.order_no,
      body: body,
      attach: JSON.stringify({ userId: req.user.id, orderId: order.id }),
      notify_url: payjs.notifyUrl,
    };

    // 生成签名
    const signStr = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&') + `&key=${payjs.key}`;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

    // 在服务端直接请求 PayJS 原生扫码接口，获取二维码链接，避免浏览器跨域问题
    const payjsResponse = await requestPayjsNative(params);

    if (!payjsResponse || String(payjsResponse.return_code) !== '1') {
      console.error('[CreatePayment] PayJS error:', payjsResponse);
      return res.status(500).json({ error: '创建支付失败，请稍后再试' });
    }

    res.json({
      orderNo: order.order_no,
      amount: order.amount_cents,
      amountDisplay: `¥${(order.amount_cents / 100).toFixed(2)}`,
      paymentMethod,
      payParams: params,
      payjs: payjsResponse,
      // PayJS 会返回 qrcode（二维码图片地址）和 code_url（原始链接），前端直接用 qrcode 显示即可
      qrImage: payjsResponse.qrcode || '',
      codeUrl: payjsResponse.code_url || '',
    });
  } catch (err) {
    console.error('[CreatePayment] Error:', err);
    res.status(500).json({ error: '创建支付失败' });
  }
});

// 调用 PayJS 原生扫码支付接口
function requestPayjsNative(params) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify(params);

    const req = https.request(
      {
        hostname: 'payjs.cn',
        path: '/api/native',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            console.error('[PayJS] Invalid JSON response:', data);
            reject(e);
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('[PayJS] Request error:', err);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * POST /api/payment/callback - 支付回调（PayJS 通知）
 */
router.post('/callback', async (req, res) => {
  try {
    const data = req.body;
    const payjs = config.payment.payjs;

    // 验证签名
    const sign = data.sign;
    delete data.sign;

    const signStr = Object.keys(data)
      .sort()
      .filter((k) => data[k] !== '' && data[k] !== undefined)
      .map((k) => `${k}=${data[k]}`)
      .join('&') + `&key=${payjs.key}`;
    const expectedSign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

    if (sign !== expectedSign) {
      console.error('[PayCallback] Invalid signature');
      return res.status(400).send('FAIL');
    }

    // 检查支付状态
    if (data.return_code !== '1') {
      console.log('[PayCallback] Payment not successful:', data);
      return res.send('SUCCESS');
    }

    const orderNo = data.out_trade_no;
    const transactionId = data.payjs_order_id;

    // 查询订单
    const order = await db.queryOne(
      `SELECT * FROM orders WHERE order_no = ?`,
      [orderNo]
    );

    if (!order) {
      console.error('[PayCallback] Order not found:', orderNo);
      return res.send('SUCCESS');
    }

    if (order.status === 'paid') {
      // 已处理，直接返回成功
      return res.send('SUCCESS');
    }

    // 更新订单状态
    await db.update(
      `UPDATE orders SET status = 'paid', transaction_id = ?, paid_at = NOW() WHERE id = ?`,
      [transactionId, order.id]
    );

    // 激活订阅
    if (order.order_type === 'subscription' && order.plan) {
      await activateSubscription(order.user_id, order.plan, order.months);
      console.log(`[PayCallback] Subscription activated: user=${order.user_id}, plan=${order.plan}, months=${order.months}`);
    }

    // 如果是流量包订单
    if (order.order_type === 'traffic_pack') {
      // 根据金额计算流量（示例：10元 = 10GB）
      const trafficBytes = (order.amount_cents / 100) * 1024 * 1024 * 1024;
      await db.insert(
        `INSERT INTO traffic_packs (user_id, bytes_total, bytes_used) VALUES (?, ?, 0)`,
        [order.user_id, trafficBytes]
      );
      console.log(`[PayCallback] Traffic pack added: user=${order.user_id}, bytes=${trafficBytes}`);
    }

    res.send('SUCCESS');
  } catch (err) {
    console.error('[PayCallback] Error:', err);
    res.status(500).send('FAIL');
  }
});

/**
 * GET /api/payment/status/:orderNo - 查询订单状态
 */
router.get('/status/:orderNo', authenticate, async (req, res) => {
  try {
    const { orderNo } = req.params;

    const order = await db.queryOne(
      `SELECT id, order_no, order_type, plan, months, amount_cents, 
              status, payment_method, paid_at, created_at
       FROM orders 
       WHERE order_no = ? AND user_id = ?`,
      [orderNo, req.user.id]
    );

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const planInfo = order.plan ? config.plans[order.plan] : null;

    res.json({
      orderNo: order.order_no,
      orderType: order.order_type,
      plan: order.plan,
      planName: planInfo?.name,
      months: order.months,
      amount: order.amount_cents,
      amountDisplay: `¥${(order.amount_cents / 100).toFixed(2)}`,
      status: order.status,
      paymentMethod: order.payment_method,
      paidAt: order.paid_at,
      createdAt: order.created_at,
    });
  } catch (err) {
    console.error('[PaymentStatus] Error:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

/**
 * GET /api/payment/orders - 获取订单列表
 */
router.get('/orders', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const orders = await db.query(
      `SELECT id, order_no, order_type, plan, months, amount_cents, 
              status, payment_method, paid_at, created_at
       FROM orders 
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limitNum, offset]
    );

    const totalResult = await db.queryOne(
      `SELECT COUNT(*) as total FROM orders WHERE user_id = ?`,
      [req.user.id]
    );

    res.json({
      orders: orders.map((o) => ({
        orderNo: o.order_no,
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
    console.error('[Orders] Error:', err);
    res.status(500).json({ error: '获取订单列表失败' });
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

