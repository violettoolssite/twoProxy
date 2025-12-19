// 环境变量示例文件
// 复制此文件为 .env 并修改相应配置

// 环境配置
NODE_ENV=production
PORT=3000

// JWT 密钥（请生成随机字符串）
// 生成方式: openssl rand -base64 32
JWT_SECRET=CHANGE_THIS_TO_RANDOM_STRING_USE_OPENSSL_RAND_BASE64_32

// 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=mirror
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE
DB_NAME=mirror

// Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

// 邮件配置（用于忘记密码等功能）
SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASS=YOUR_EMAIL_PASSWORD_HERE
SMTP_FROM=noreply@example.com

// 域名配置
DOMAIN=mirror.yljdteam.com
BASE_URL=https://mirror.yljdteam.com

// 支付配置（可选，如不需要支付功能可留空）
PAYJS_MCHID=
PAYJS_KEY=
PAYJS_NOTIFY_URL=https://mirror.yljdteam.com/api/payment/callback
