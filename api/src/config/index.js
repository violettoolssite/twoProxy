require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    expiresIn: '7d',
  },

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'mirror',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mirror',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // 邮件发送配置（用于忘记密码等通知）
  mail: {
    host: process.env.SMTP_HOST || 'mail.spacemail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true, // 465 默认 true
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  },

  domain: process.env.DOMAIN || 'mirror.yljdteam.com',
  baseUrl: process.env.BASE_URL || 'https://mirror.yljdteam.com',

  payment: {
    payjs: {
      mchid: process.env.PAYJS_MCHID || '',
      key: process.env.PAYJS_KEY || '',
      notifyUrl: process.env.PAYJS_NOTIFY_URL || '',
    },
  },

  // 套餐配置
  plans: {
    free: {
      name: '免费版',
      price: 0,
      monthlyTrafficBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      bandwidthLimitMbps: 5,
      concurrentLimit: 5,
      apiDailyLimit: 100,
      hasSubdomain: false,
    },
    basic: {
      name: '基础版',
      price: 990, // 单位：分
      monthlyTrafficBytes: 50 * 1024 * 1024 * 1024, // 50 GB
      bandwidthLimitMbps: 20,
      concurrentLimit: 20,
      apiDailyLimit: 1000,
      hasSubdomain: true,
    },
    pro: {
      name: '专业版',
      price: 2990,
      monthlyTrafficBytes: 200 * 1024 * 1024 * 1024, // 200 GB
      bandwidthLimitMbps: 50,
      concurrentLimit: 50,
      apiDailyLimit: 5000,
      hasSubdomain: true,
    },
    enterprise: {
      name: '企业版',
      price: 9990,
      monthlyTrafficBytes: 1024 * 1024 * 1024 * 1024, // 1 TB
      bandwidthLimitMbps: 100,
      concurrentLimit: 200,
      apiDailyLimit: -1, // 无限制
      hasSubdomain: true,
    },
  },
};

