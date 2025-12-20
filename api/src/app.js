require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');

// 路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const subscriptionRoutes = require('./routes/subscription');
const paymentRoutes = require('./routes/payment');
const internalRoutes = require('./routes/internal');
const adminRoutes = require('./routes/admin');
const smsRoutes = require('./routes/sms');

const app = express();

// 信任代理（Nginx）
app.set('trust proxy', 1);

// 安全头
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: [
    `https://${config.domain}`,
    `https://*.${config.domain}`,
    'http://localhost:3000',
    'http://localhost:8080',
  ],
  credentials: true,
}));

// 解析请求体
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 全局限流
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 100, // 每分钟最多 100 次请求
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sms', smsRoutes);

// 内部接口（只允许本机访问）
app.use('/api/internal', (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
  
  if (!isLocal && config.nodeEnv === 'production') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, internalRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: config.nodeEnv === 'production' ? '服务器内部错误' : err.message,
  });
});

// 启动服务器
const PORT = config.port;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Mirror API] Server running on http://127.0.0.1:${PORT}`);
  console.log(`[Mirror API] Environment: ${config.nodeEnv}`);
  
  // 启动SMS自动释放定时任务
  const { startAutoRelease } = require('./jobs/sms-auto-release');
  startAutoRelease();
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[Mirror API] Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Mirror API] Received SIGINT, shutting down...');
  process.exit(0);
});

