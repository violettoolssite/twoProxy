#!/bin/bash

###############################################################################
# Mirror 加速站 - 自动备份脚本
# 
# 功能:
#   - 备份 MySQL 数据库
#   - 备份项目文件
#   - 备份 Nginx 配置
#   - 自动清理过期备份
#
# 使用方法:
#   sudo bash scripts/backup.sh
#
# 定时任务:
#   crontab -e
#   0 2 * * * /var/www/mirror/scripts/backup.sh >> /var/log/mirror-backup.log 2>&1
###############################################################################

set -e

# 配置变量
BACKUP_DIR="/backup/mirror"
PROJECT_DIR="/var/www/mirror"
DB_NAME="mirror"
DB_USER="mirror"
DB_PASSWORD=""  # 从 .env 文件读取

# 保留天数
KEEP_DAYS=7

# 时间戳
DATE=$(date +%Y%m%d_%H%M%S)
DATE_SIMPLE=$(date +%Y%m%d)

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# 创建备份目录
mkdir -p $BACKUP_DIR/{database,files,nginx}

log_info "开始备份..."

# 1. 读取数据库密码
if [ -f "$PROJECT_DIR/api/.env" ]; then
    DB_PASSWORD=$(grep DB_PASSWORD $PROJECT_DIR/api/.env | cut -d '=' -f2)
fi

if [ -z "$DB_PASSWORD" ]; then
    log_warn "无法读取数据库密码，跳过数据库备份"
else
    # 2. 备份数据库
    log_info "备份数据库..."
    mysqldump -u $DB_USER -p"$DB_PASSWORD" $DB_NAME | gzip > $BACKUP_DIR/database/db_${DATE}.sql.gz
    log_info "数据库备份完成: db_${DATE}.sql.gz"
fi

# 3. 备份项目文件（排除 node_modules 和日志）
log_info "备份项目文件..."
tar -czf $BACKUP_DIR/files/files_${DATE}.tar.gz \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='.git' \
    -C /var/www mirror/
log_info "项目文件备份完成: files_${DATE}.tar.gz"

# 4. 备份 Nginx 配置
log_info "备份 Nginx 配置..."
if [ -f /etc/nginx/sites-enabled/mirror.conf ]; then
    cp /etc/nginx/sites-enabled/mirror.conf $BACKUP_DIR/nginx/nginx_${DATE}.conf
    log_info "Nginx 配置备份完成: nginx_${DATE}.conf"
fi

# 5. 创建备份清单
log_info "创建备份清单..."
cat > $BACKUP_DIR/backup_${DATE_SIMPLE}.txt << EOF
Mirror 加速站备份清单
备份时间: $(date '+%Y-%m-%d %H:%M:%S')

数据库备份:
  文件: database/db_${DATE}.sql.gz
  大小: $(du -h $BACKUP_DIR/database/db_${DATE}.sql.gz | cut -f1)

项目文件备份:
  文件: files/files_${DATE}.tar.gz
  大小: $(du -h $BACKUP_DIR/files/files_${DATE}.tar.gz | cut -f1)

Nginx 配置备份:
  文件: nginx/nginx_${DATE}.conf
  大小: $(du -h $BACKUP_DIR/nginx/nginx_${DATE}.conf | cut -f1)

总大小: $(du -sh $BACKUP_DIR | cut -f1)
EOF

# 6. 清理过期备份
log_info "清理 $KEEP_DAYS 天前的备份..."
find $BACKUP_DIR/database -name "*.sql.gz" -mtime +$KEEP_DAYS -delete
find $BACKUP_DIR/files -name "*.tar.gz" -mtime +$KEEP_DAYS -delete
find $BACKUP_DIR/nginx -name "*.conf" -mtime +$KEEP_DAYS -delete
find $BACKUP_DIR -name "backup_*.txt" -mtime +$KEEP_DAYS -delete

# 7. 显示备份统计
log_info "备份完成！"
log_info "备份目录: $BACKUP_DIR"
log_info "备份文件:"
ls -lh $BACKUP_DIR/database/db_${DATE}.sql.gz
ls -lh $BACKUP_DIR/files/files_${DATE}.tar.gz
ls -lh $BACKUP_DIR/nginx/nginx_${DATE}.conf
log_info "总大小: $(du -sh $BACKUP_DIR | cut -f1)"

