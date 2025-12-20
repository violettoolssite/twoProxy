#!/bin/bash

################################################################################
# 迁移备份脚本 - 在旧服务器上运行
# 用途: 备份所有需要迁移的数据
# 使用: sudo bash migrate-backup.sh [hk|gz]
################################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 获取服务器类型
SERVER_TYPE=${1:-hk}
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/mirror_backup_${SERVER_TYPE}_${DATE}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "         Mirror 加速站 - 迁移备份脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "服务器类型: $SERVER_TYPE"
log_info "备份目录: $BACKUP_DIR"
log_info "开始时间: $(date)"
echo ""

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 检查是否为 root 或有 sudo 权限
if [ "$EUID" -ne 0 ]; then 
    log_warn "建议使用 sudo 运行此脚本以确保完整备份"
fi

################################################################################
# 香港服务器备份 (Mirror 主站)
################################################################################
if [ "$SERVER_TYPE" = "hk" ]; then
    log_step "开始备份香港服务器 (Mirror 主站)..."
    
    # 1. 备份项目文件
    log_info "1/8 备份项目文件..."
    if [ -d "/var/www/mirror" ]; then
        tar -czf "$BACKUP_DIR/mirror_files.tar.gz" \
            --exclude='node_modules' \
            --exclude='*.log' \
            --exclude='.git' \
            --exclude='package-lock.json' \
            --exclude='.env' \
            -C /var/www mirror/
        log_info "✓ 项目文件备份完成: $(du -h "$BACKUP_DIR/mirror_files.tar.gz" | cut -f1)"
    else
        log_error "项目目录 /var/www/mirror 不存在"
        exit 1
    fi
    
    # 2. 备份数据库
    log_info "2/8 备份 MySQL 数据库..."
    read -p "请输入 MySQL 数据库用户名 [mirror]: " DB_USER
    DB_USER=${DB_USER:-mirror}
    read -p "请输入 MySQL 数据库名 [mirror]: " DB_NAME
    DB_NAME=${DB_NAME:-mirror}
    read -sp "请输入 MySQL 密码: " DB_PASS
    echo ""
    
    if command -v mysqldump &> /dev/null; then
        mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_DIR/mirror_database.sql.gz"
        if [ $? -eq 0 ]; then
            log_info "✓ 数据库备份完成: $(du -h "$BACKUP_DIR/mirror_database.sql.gz" | cut -f1)"
        else
            log_error "数据库备份失败"
            exit 1
        fi
    else
        log_error "mysqldump 未安装"
        exit 1
    fi
    
    # 3. 备份环境变量
    log_info "3/8 备份环境变量..."
    if [ -f "/var/www/mirror/api/.env" ]; then
        cp /var/www/mirror/api/.env "$BACKUP_DIR/mirror_env.bak"
        log_info "✓ 环境变量备份完成"
    else
        log_warn ".env 文件不存在，跳过"
    fi
    
    # 4. 备份 Nginx 配置
    log_info "4/8 备份 Nginx 配置..."
    if [ -f "/etc/nginx/sites-enabled/mirror.conf" ]; then
        cp /etc/nginx/sites-enabled/mirror.conf "$BACKUP_DIR/mirror_nginx.conf"
        log_info "✓ Nginx 配置备份完成"
    else
        log_warn "Nginx 配置文件不存在，跳过"
    fi
    
    # 5. 备份 SSL 证书
    log_info "5/8 备份 SSL 证书..."
    if [ -d "/etc/letsencrypt" ]; then
        sudo tar -czf "$BACKUP_DIR/mirror_ssl_certs.tar.gz" /etc/letsencrypt/
        log_info "✓ SSL 证书备份完成: $(du -h "$BACKUP_DIR/mirror_ssl_certs.tar.gz" | cut -f1)"
    else
        log_warn "SSL 证书目录不存在，跳过"
    fi
    
    # 6. 备份 PM2 配置
    log_info "6/8 备份 PM2 配置..."
    if command -v pm2 &> /dev/null; then
        pm2 save
        if [ -d "$HOME/.pm2" ]; then
            tar -czf "$BACKUP_DIR/mirror_pm2.tar.gz" -C "$HOME" .pm2/
            log_info "✓ PM2 配置备份完成"
        fi
    else
        log_warn "PM2 未安装，跳过"
    fi
    
    # 7. 导出系统信息
    log_info "7/8 导出系统信息..."
    cat > "$BACKUP_DIR/system_info.txt" << EOF
备份时间: $(date)
服务器类型: 香港服务器 (Mirror 主站)
主机名: $(hostname)
系统版本: $(lsb_release -d | cut -f2)
内核版本: $(uname -r)
Node.js 版本: $(node --version 2>/dev/null || echo "未安装")
npm 版本: $(npm --version 2>/dev/null || echo "未安装")
MySQL 版本: $(mysql --version 2>/dev/null || echo "未安装")
Nginx 版本: $(nginx -v 2>&1 | cut -d'/' -f2 || echo "未安装")
Redis 版本: $(redis-cli --version 2>/dev/null || echo "未安装")
PM2 版本: $(pm2 --version 2>/dev/null || echo "未安装")
EOF
    log_info "✓ 系统信息导出完成"
    
    # 8. 创建恢复说明
    log_info "8/8 创建恢复说明..."
    cat > "$BACKUP_DIR/README.txt" << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mirror 加速站 - 香港服务器备份
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

备份时间: $(date)
备份目录: $BACKUP_DIR

文件列表:
$(ls -lh "$BACKUP_DIR" | tail -n +2)

恢复步骤:
1. 将整个备份目录上传到新服务器
2. 在新服务器上运行: sudo bash migrate-restore.sh hk /path/to/backup
3. 更新 DNS 记录指向新服务器 IP
4. 运行验证脚本: bash migrate-verify.sh hk

注意事项:
- 请妥善保管 .env 文件，包含敏感信息
- SSL 证书可选择迁移或重新申请
- 恢复后需要修改 .env 中的配置（如有变化）

技术支持:
QQ: 1494458927

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    log_info "✓ 恢复说明创建完成"

################################################################################
# 广州服务器备份 (VioletTeam)
################################################################################
elif [ "$SERVER_TYPE" = "gz" ]; then
    log_step "开始备份广州服务器 (VioletTeam)..."
    
    # 1. 备份前端项目文件
    log_info "1/7 备份前端项目文件..."
    if [ -d "/var/www/violetteam" ]; then
        tar -czf "$BACKUP_DIR/violetteam_files.tar.gz" \
            --exclude='node_modules' \
            --exclude='*.log' \
            --exclude='.git' \
            --exclude='package-lock.json' \
            -C /var/www violetteam/
        log_info "✓ 前端项目备份完成: $(du -h "$BACKUP_DIR/violetteam_files.tar.gz" | cut -f1)"
    else
        log_warn "项目目录 /var/www/violetteam 不存在，跳过"
    fi
    
    # 2. 备份 Python GitHub 代理
    log_info "2/7 备份 GitHub 代理服务..."
    if [ -d "/opt/github-proxy" ]; then
        tar -czf "$BACKUP_DIR/github_proxy.tar.gz" -C /opt github-proxy/
        log_info "✓ GitHub 代理备份完成: $(du -h "$BACKUP_DIR/github_proxy.tar.gz" | cut -f1)"
    else
        log_warn "GitHub 代理目录不存在，跳过"
    fi
    
    # 3. 备份 Nginx 配置
    log_info "3/7 备份 Nginx 配置..."
    if [ -f "/etc/nginx/sites-enabled/violetteam.conf" ]; then
        cp /etc/nginx/sites-enabled/violetteam.conf "$BACKUP_DIR/violetteam_nginx.conf"
        log_info "✓ Nginx 配置备份完成"
    else
        log_warn "Nginx 配置文件不存在，跳过"
    fi
    
    # 4. 备份 SSL 证书
    log_info "4/7 备份 SSL 证书..."
    if [ -d "/etc/letsencrypt" ]; then
        sudo tar -czf "$BACKUP_DIR/violetteam_ssl_certs.tar.gz" /etc/letsencrypt/
        log_info "✓ SSL 证书备份完成: $(du -h "$BACKUP_DIR/violetteam_ssl_certs.tar.gz" | cut -f1)"
    else
        log_warn "SSL 证书目录不存在，跳过"
    fi
    
    # 5. 备份 systemd 服务配置
    log_info "5/7 备份 systemd 服务配置..."
    if [ -f "/etc/systemd/system/github-proxy.service" ]; then
        cp /etc/systemd/system/github-proxy.service "$BACKUP_DIR/github-proxy.service"
        log_info "✓ systemd 服务配置备份完成"
    else
        log_warn "systemd 服务配置不存在，跳过"
    fi
    
    # 6. 导出系统信息
    log_info "6/7 导出系统信息..."
    cat > "$BACKUP_DIR/system_info.txt" << EOF
备份时间: $(date)
服务器类型: 广州服务器 (VioletTeam)
主机名: $(hostname)
系统版本: $(lsb_release -d | cut -f2)
内核版本: $(uname -r)
Python 版本: $(python3 --version 2>/dev/null || echo "未安装")
Nginx 版本: $(nginx -v 2>&1 | cut -d'/' -f2 || echo "未安装")
EOF
    log_info "✓ 系统信息导出完成"
    
    # 7. 创建恢复说明
    log_info "7/7 创建恢复说明..."
    cat > "$BACKUP_DIR/README.txt" << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VioletTeam - 广州服务器备份
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

备份时间: $(date)
备份目录: $BACKUP_DIR

文件列表:
$(ls -lh "$BACKUP_DIR" | tail -n +2)

恢复步骤:
1. 将整个备份目录上传到新服务器
2. 在新服务器上运行: sudo bash migrate-restore.sh gz /path/to/backup
3. 更新 DNS 记录指向新服务器 IP
4. 运行验证脚本: bash migrate-verify.sh gz

注意事项:
- Python 依赖需要重新安装: pip3 install flask requests
- 检查 GitHub 代理脚本权限
- SSL 证书可选择迁移或重新申请

技术支持:
QQ: 1494458927

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    log_info "✓ 恢复说明创建完成"

else
    log_error "无效的服务器类型: $SERVER_TYPE"
    echo "使用方法: bash $0 [hk|gz]"
    exit 1
fi

################################################################################
# 备份完成
################################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "备份完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "备份目录: $BACKUP_DIR"
log_info "总大小: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo ""
log_info "备份文件列表:"
ls -lh "$BACKUP_DIR" | tail -n +2 | awk '{printf "  - %-30s %8s\n", $9, $5}'
echo ""
log_info "下一步操作:"
echo "  1. 将备份目录打包: tar -czf mirror_backup_${SERVER_TYPE}_${DATE}.tar.gz -C $(dirname "$BACKUP_DIR") $(basename "$BACKUP_DIR")"
echo "  2. 上传到新服务器: scp mirror_backup_${SERVER_TYPE}_${DATE}.tar.gz user@new-server:/tmp/"
echo "  3. 在新服务器解压: tar -xzf /tmp/mirror_backup_${SERVER_TYPE}_${DATE}.tar.gz -C /tmp/"
echo "  4. 运行恢复脚本: sudo bash migrate-restore.sh $SERVER_TYPE /tmp/mirror_backup_${SERVER_TYPE}_${DATE}"
echo ""
log_info "结束时间: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

