#!/bin/bash

###############################################################################
# Mirror 加速站 - 数据恢复脚本
# 
# 功能:
#   - 从备份恢复 MySQL 数据库
#   - 从备份恢复项目文件
#   - 从备份恢复 Nginx 配置
#
# 使用方法:
#   sudo bash scripts/restore.sh [backup_date]
#   例如: sudo bash scripts/restore.sh 20251219_020000
#
# 警告: 此操作将覆盖现有数据，请谨慎使用！
###############################################################################

set -e

# 配置变量
BACKUP_DIR="/backup/mirror"
PROJECT_DIR="/var/www/mirror"
DB_NAME="mirror"
DB_USER="mirror"
DB_PASSWORD=""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
if [ -z "$1" ]; then
    log_error "请指定备份日期"
    log_info "使用方法: sudo bash scripts/restore.sh [backup_date]"
    log_info "可用备份:"
    ls -1 $BACKUP_DIR/database/ | grep "db_" | sed 's/db_/  /' | sed 's/.sql.gz//'
    exit 1
fi

BACKUP_DATE=$1

# 检查备份文件是否存在
DB_BACKUP="$BACKUP_DIR/database/db_${BACKUP_DATE}.sql.gz"
FILES_BACKUP="$BACKUP_DIR/files/files_${BACKUP_DATE}.tar.gz"
NGINX_BACKUP="$BACKUP_DIR/nginx/nginx_${BACKUP_DATE}.conf"

if [ ! -f "$DB_BACKUP" ]; then
    log_error "数据库备份文件不存在: $DB_BACKUP"
    exit 1
fi

if [ ! -f "$FILES_BACKUP" ]; then
    log_error "项目文件备份不存在: $FILES_BACKUP"
    exit 1
fi

# 确认操作
log_warn "警告: 此操作将覆盖现有数据！"
log_warn "将要恢复的备份: $BACKUP_DATE"
log_warn "  - 数据库: $DB_BACKUP"
log_warn "  - 项目文件: $FILES_BACKUP"
log_warn "  - Nginx 配置: $NGINX_BACKUP"
echo ""
read -p "确定要继续吗? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log_info "操作已取消"
    exit 0
fi

# 读取数据库密码
if [ -f "$PROJECT_DIR/api/.env" ]; then
    DB_PASSWORD=$(grep DB_PASSWORD $PROJECT_DIR/api/.env | cut -d '=' -f2)
fi

if [ -z "$DB_PASSWORD" ]; then
    log_error "无法读取数据库密码"
    exit 1
fi

# 1. 停止服务
log_info "停止服务..."
pm2 stop mirror-api || true

# 2. 恢复数据库
log_info "恢复数据库..."
gunzip < $DB_BACKUP | mysql -u $DB_USER -p"$DB_PASSWORD" $DB_NAME
log_info "数据库恢复完成"

# 3. 恢复项目文件
log_info "恢复项目文件..."
cd /var/www
tar -xzf $FILES_BACKUP
log_info "项目文件恢复完成"

# 4. 恢复 Nginx 配置
if [ -f "$NGINX_BACKUP" ]; then
    log_info "恢复 Nginx 配置..."
    cp $NGINX_BACKUP /etc/nginx/sites-enabled/mirror.conf
    nginx -t
    systemctl reload nginx
    log_info "Nginx 配置恢复完成"
fi

# 5. 重新安装依赖
log_info "重新安装依赖..."
cd $PROJECT_DIR/api
npm install --production

# 6. 启动服务
log_info "启动服务..."
pm2 start mirror-api
pm2 save

# 7. 检查服务状态
log_info "检查服务状态..."
sleep 3
pm2 status

log_info "恢复完成！"
log_info "请检查服务是否正常运行:"
log_info "  pm2 logs mirror-api"
log_info "  curl http://localhost:3000/api/health"

