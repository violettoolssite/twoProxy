#!/bin/bash

###############################################################################
# Mirror 加速站 - 一键部署脚本
# 适用于 Ubuntu 20.04+ / Debian 11+
# 
# 使用方法:
#   sudo bash scripts/deploy.sh
#
# 注意: 请在执行前修改脚本中的配置变量
###############################################################################

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    log_error "请使用 root 权限运行此脚本"
    log_info "使用方法: sudo bash scripts/deploy.sh"
    exit 1
fi

# ============================================================================
# 配置变量（请根据实际情况修改）
# ============================================================================

# 域名配置
DOMAIN="mirror.yljdteam.com"
EMAIL="admin@yljdteam.com"  # 用于 SSL 证书申请

# 数据库配置
DB_NAME="mirror"
DB_USER="mirror"
DB_PASSWORD=""  # 留空则自动生成

# 项目路径
PROJECT_DIR="/var/www/mirror"

# Node.js 版本
NODE_VERSION="18"

# ============================================================================
# 开始部署
# ============================================================================

log_info "开始部署 Mirror 加速站..."
log_info "域名: $DOMAIN"
log_info "项目路径: $PROJECT_DIR"

# 1. 更新系统
log_info "更新系统包..."
apt update && apt upgrade -y

# 2. 安装基础工具
log_info "安装基础工具..."
apt install -y curl wget git vim ufw build-essential

# 3. 安装 Node.js
log_info "安装 Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
fi

log_info "Node.js 版本: $(node --version)"
log_info "npm 版本: $(npm --version)"

# 4. 安装 MySQL
log_info "安装 MySQL..."
if ! command -v mysql &> /dev/null; then
    apt install -y mysql-server
    systemctl start mysql
    systemctl enable mysql
fi

# 生成随机数据库密码（如果未设置）
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD=$(openssl rand -base64 16)
    log_info "生成的数据库密码: $DB_PASSWORD"
    echo "数据库密码: $DB_PASSWORD" >> /root/mirror-credentials.txt
fi

# 创建数据库和用户
log_info "创建数据库和用户..."
mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || true
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';" || true
mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';" || true
mysql -e "FLUSH PRIVILEGES;" || true

# 5. 安装 Redis
log_info "安装 Redis..."
if ! command -v redis-cli &> /dev/null; then
    apt install -y redis-server
    systemctl start redis-server
    systemctl enable redis-server
fi

# 6. 安装 Nginx
log_info "安装 Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
fi

# 7. 安装 PM2
log_info "安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 8. 安装 Certbot
log_info "安装 Certbot..."
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
fi

# 9. 配置项目
log_info "配置项目..."

# 进入项目目录
cd $PROJECT_DIR/api

# 安装依赖
log_info "安装 Node.js 依赖..."
npm install --production

# 生成 JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# 创建 .env 文件
log_info "创建环境变量文件..."
cat > .env << EOF
# 环境配置
NODE_ENV=production
PORT=3000

# JWT 密钥
JWT_SECRET=$JWT_SECRET

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 邮件配置（可选）
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# 域名配置
DOMAIN=$DOMAIN
BASE_URL=https://$DOMAIN

# 支付配置（可选）
PAYJS_MCHID=
PAYJS_KEY=
PAYJS_NOTIFY_URL=
EOF

# 保存凭证
log_info "保存凭证到 /root/mirror-credentials.txt"
cat > /root/mirror-credentials.txt << EOF
Mirror 加速站部署凭证
生成时间: $(date)

数据库信息:
  数据库名: $DB_NAME
  用户名: $DB_USER
  密码: $DB_PASSWORD

JWT Secret: $JWT_SECRET

项目路径: $PROJECT_DIR
域名: $DOMAIN
EOF

chmod 600 /root/mirror-credentials.txt

# 10. 初始化数据库
log_info "初始化数据库..."
npm run init-db

# 11. 配置 Nginx
log_info "配置 Nginx..."

# 备份原配置
if [ -f /etc/nginx/sites-enabled/mirror.conf ]; then
    cp /etc/nginx/sites-enabled/mirror.conf /etc/nginx/sites-enabled/mirror.conf.bak.$(date +%Y%m%d%H%M%S)
fi

# 测试 Nginx 配置
nginx -t

# 12. 启动后端 API
log_info "启动后端 API..."
cd $PROJECT_DIR/api

# 停止旧进程（如果存在）
pm2 stop mirror-api || true
pm2 delete mirror-api || true

# 启动新进程
pm2 start src/app.js --name mirror-api
pm2 save

# 设置 PM2 开机自启
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER || true

# 13. 配置防火墙
log_info "配置防火墙..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# 14. 申请 SSL 证书
log_info "准备申请 SSL 证书..."
log_warn "请确保域名 $DOMAIN 已正确解析到本服务器 IP"
log_warn "如需申请证书，请运行:"
log_warn "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL"

# 15. 重载 Nginx
log_info "重载 Nginx..."
systemctl reload nginx

# ============================================================================
# 部署完成
# ============================================================================

log_info "============================================"
log_info "部署完成！"
log_info "============================================"
log_info ""
log_info "重要信息:"
log_info "  - 凭证文件: /root/mirror-credentials.txt"
log_info "  - 项目路径: $PROJECT_DIR"
log_info "  - API 端口: 3000"
log_info "  - 域名: $DOMAIN"
log_info ""
log_info "下一步操作:"
log_info "  1. 确保域名已解析到本服务器"
log_info "  2. 申请 SSL 证书:"
log_info "     sudo certbot --nginx -d $DOMAIN"
log_info "  3. 查看 API 日志:"
log_info "     pm2 logs mirror-api"
log_info "  4. 查看 API 状态:"
log_info "     pm2 status"
log_info ""
log_info "测试接口:"
log_info "  curl http://localhost:3000/api/health"
log_info ""
log_warn "请妥善保管 /root/mirror-credentials.txt 文件！"
log_info "============================================"

