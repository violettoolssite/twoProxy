#!/bin/bash

################################################################################
# 迁移恢复脚本 - 在新服务器上运行
# 用途: 恢复备份的数据到新服务器
# 使用: sudo bash migrate-restore.sh [hk|gz] /path/to/backup
################################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 检查参数
if [ $# -lt 2 ]; then
    log_error "参数不足"
    echo "使用方法: sudo bash $0 [hk|gz] /path/to/backup"
    exit 1
fi

SERVER_TYPE=$1
BACKUP_DIR=$2

# 检查备份目录
if [ ! -d "$BACKUP_DIR" ]; then
    log_error "备份目录不存在: $BACKUP_DIR"
    exit 1
fi

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then 
    log_error "此脚本需要 root 权限运行"
    echo "请使用: sudo bash $0 $SERVER_TYPE $BACKUP_DIR"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "         Mirror 加速站 - 迁移恢复脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "服务器类型: $SERVER_TYPE"
log_info "备份目录: $BACKUP_DIR"
log_info "开始时间: $(date)"
echo ""

################################################################################
# 香港服务器恢复 (Mirror 主站)
################################################################################
if [ "$SERVER_TYPE" = "hk" ]; then
    log_step "开始恢复香港服务器 (Mirror 主站)..."
    
    # 1. 确认基础软件已安装
    log_info "1/10 检查基础软件..."
    MISSING_DEPS=()
    
    command -v node >/dev/null 2>&1 || MISSING_DEPS+=("Node.js")
    command -v npm >/dev/null 2>&1 || MISSING_DEPS+=("npm")
    command -v mysql >/dev/null 2>&1 || MISSING_DEPS+=("MySQL")
    command -v nginx >/dev/null 2>&1 || MISSING_DEPS+=("Nginx")
    command -v redis-cli >/dev/null 2>&1 || MISSING_DEPS+=("Redis")
    command -v pm2 >/dev/null 2>&1 || MISSING_DEPS+=("PM2")
    
    if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
        log_warn "缺少以下依赖: ${MISSING_DEPS[*]}"
        log_info "请先运行部署脚本: bash scripts/deploy.sh"
        read -p "是否继续恢复? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_info "✓ 所有基础软件已安装"
    fi
    
    # 2. 恢复项目文件
    log_info "2/10 恢复项目文件..."
    if [ -f "$BACKUP_DIR/mirror_files.tar.gz" ]; then
        mkdir -p /var/www
        tar -xzf "$BACKUP_DIR/mirror_files.tar.gz" -C /var/www/
        chown -R $SUDO_USER:$SUDO_USER /var/www/mirror
        log_info "✓ 项目文件恢复完成"
    else
        log_error "项目文件备份不存在"
        exit 1
    fi
    
    # 3. 安装 Node.js 依赖
    log_info "3/10 安装 Node.js 依赖..."
    if [ -d "/var/www/mirror/api" ]; then
        cd /var/www/mirror/api
        sudo -u $SUDO_USER npm install --production
        log_info "✓ Node.js 依赖安装完成"
    fi
    
    # 4. 恢复环境变量
    log_info "4/10 恢复环境变量..."
    if [ -f "$BACKUP_DIR/mirror_env.bak" ]; then
        cp "$BACKUP_DIR/mirror_env.bak" /var/www/mirror/api/.env
        chown $SUDO_USER:$SUDO_USER /var/www/mirror/api/.env
        chmod 600 /var/www/mirror/api/.env
        log_info "✓ 环境变量恢复完成"
        log_warn "请检查 .env 文件，确认配置是否需要更新"
    else
        log_warn "环境变量备份不存在，请手动创建 .env 文件"
    fi
    
    # 5. 恢复数据库
    log_info "5/10 恢复数据库..."
    if [ -f "$BACKUP_DIR/mirror_database.sql.gz" ]; then
        read -p "请输入 MySQL 用户名 [mirror]: " DB_USER
        DB_USER=${DB_USER:-mirror}
        read -p "请输入 MySQL 数据库名 [mirror]: " DB_NAME
        DB_NAME=${DB_NAME:-mirror}
        read -sp "请输入 MySQL 密码: " DB_PASS
        echo ""
        
        # 检查数据库是否存在
        if mysql -u "$DB_USER" -p"$DB_PASS" -e "USE $DB_NAME" 2>/dev/null; then
            log_warn "数据库 $DB_NAME 已存在"
            read -p "是否覆盖现有数据库? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "跳过数据库恢复"
            else
                gunzip < "$BACKUP_DIR/mirror_database.sql.gz" | mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
                log_info "✓ 数据库恢复完成"
            fi
        else
            log_info "创建数据库 $DB_NAME..."
            mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            gunzip < "$BACKUP_DIR/mirror_database.sql.gz" | mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
            log_info "✓ 数据库恢复完成"
        fi
    else
        log_warn "数据库备份不存在，跳过"
    fi
    
    # 6. 恢复 Nginx 配置
    log_info "6/10 恢复 Nginx 配置..."
    if [ -f "$BACKUP_DIR/mirror_nginx.conf" ]; then
        cp "$BACKUP_DIR/mirror_nginx.conf" /etc/nginx/sites-enabled/mirror.conf
        
        # 删除默认配置
        if [ -f "/etc/nginx/sites-enabled/default" ]; then
            rm -f /etc/nginx/sites-enabled/default
        fi
        
        # 测试配置
        nginx -t
        if [ $? -eq 0 ]; then
            log_info "✓ Nginx 配置恢复完成"
        else
            log_error "Nginx 配置测试失败，请检查配置文件"
        fi
    else
        log_warn "Nginx 配置备份不存在，跳过"
    fi
    
    # 7. 恢复 SSL 证书
    log_info "7/10 恢复 SSL 证书..."
    if [ -f "$BACKUP_DIR/mirror_ssl_certs.tar.gz" ]; then
        read -p "是否恢复 SSL 证书? (建议重新申请) (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            tar -xzf "$BACKUP_DIR/mirror_ssl_certs.tar.gz" -C /
            log_info "✓ SSL 证书恢复完成"
        else
            log_info "跳过 SSL 证书恢复，请稍后使用 certbot 申请新证书"
        fi
    else
        log_warn "SSL 证书备份不存在，请使用 certbot 申请新证书"
    fi
    
    # 8. 恢复 PM2 配置
    log_info "8/10 恢复 PM2 配置..."
    if [ -f "$BACKUP_DIR/mirror_pm2.tar.gz" ]; then
        read -p "是否恢复 PM2 配置? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            tar -xzf "$BACKUP_DIR/mirror_pm2.tar.gz" -C /home/$SUDO_USER/
            chown -R $SUDO_USER:$SUDO_USER /home/$SUDO_USER/.pm2
            log_info "✓ PM2 配置恢复完成"
        fi
    fi
    
    # 9. 启动服务
    log_info "9/10 启动服务..."
    cd /var/www/mirror/api
    sudo -u $SUDO_USER pm2 start src/app.js --name mirror-api
    sudo -u $SUDO_USER pm2 save
    sudo -u $SUDO_USER pm2 startup
    log_info "✓ 后端 API 已启动"
    
    systemctl reload nginx
    log_info "✓ Nginx 已重载"
    
    # 10. 验证服务状态
    log_info "10/10 验证服务状态..."
    sleep 3
    
    # 检查 PM2
    if sudo -u $SUDO_USER pm2 status | grep -q "mirror-api.*online"; then
        log_info "✓ PM2 服务运行正常"
    else
        log_warn "PM2 服务状态异常，请检查日志"
    fi
    
    # 检查 Nginx
    if systemctl is-active --quiet nginx; then
        log_info "✓ Nginx 服务运行正常"
    else
        log_warn "Nginx 服务状态异常"
    fi
    
    # 检查 MySQL
    if systemctl is-active --quiet mysql; then
        log_info "✓ MySQL 服务运行正常"
    else
        log_warn "MySQL 服务状态异常"
    fi
    
    # 检查 Redis
    if systemctl is-active --quiet redis-server; then
        log_info "✓ Redis 服务运行正常"
    else
        log_warn "Redis 服务状态异常"
    fi

################################################################################
# 广州服务器恢复 (VioletTeam)
################################################################################
elif [ "$SERVER_TYPE" = "gz" ]; then
    log_step "开始恢复广州服务器 (VioletTeam)..."
    
    # 1. 检查基础软件
    log_info "1/8 检查基础软件..."
    MISSING_DEPS=()
    
    command -v python3 >/dev/null 2>&1 || MISSING_DEPS+=("Python3")
    command -v pip3 >/dev/null 2>&1 || MISSING_DEPS+=("pip3")
    command -v nginx >/dev/null 2>&1 || MISSING_DEPS+=("Nginx")
    
    if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
        log_warn "缺少以下依赖: ${MISSING_DEPS[*]}"
        log_info "安装缺失依赖..."
        apt update
        apt install -y python3 python3-pip nginx
    fi
    log_info "✓ 基础软件检查完成"
    
    # 2. 恢复前端项目文件
    log_info "2/8 恢复前端项目文件..."
    if [ -f "$BACKUP_DIR/violetteam_files.tar.gz" ]; then
        mkdir -p /var/www
        tar -xzf "$BACKUP_DIR/violetteam_files.tar.gz" -C /var/www/
        chown -R www-data:www-data /var/www/violetteam
        log_info "✓ 前端项目恢复完成"
    fi
    
    # 3. 恢复 GitHub 代理服务
    log_info "3/8 恢复 GitHub 代理服务..."
    if [ -f "$BACKUP_DIR/github_proxy.tar.gz" ]; then
        mkdir -p /opt
        tar -xzf "$BACKUP_DIR/github_proxy.tar.gz" -C /opt/
        chown -R www-data:www-data /opt/github-proxy
        chmod +x /opt/github-proxy/*.py
        log_info "✓ GitHub 代理服务恢复完成"
    fi
    
    # 4. 安装 Python 依赖
    log_info "4/8 安装 Python 依赖..."
    pip3 install flask requests
    log_info "✓ Python 依赖安装完成"
    
    # 5. 恢复 Nginx 配置
    log_info "5/8 恢复 Nginx 配置..."
    if [ -f "$BACKUP_DIR/violetteam_nginx.conf" ]; then
        cp "$BACKUP_DIR/violetteam_nginx.conf" /etc/nginx/sites-enabled/violetteam.conf
        
        # 删除默认配置
        if [ -f "/etc/nginx/sites-enabled/default" ]; then
            rm -f /etc/nginx/sites-enabled/default
        fi
        
        nginx -t
        if [ $? -eq 0 ]; then
            log_info "✓ Nginx 配置恢复完成"
        else
            log_error "Nginx 配置测试失败"
        fi
    fi
    
    # 6. 恢复 SSL 证书
    log_info "6/8 恢复 SSL 证书..."
    if [ -f "$BACKUP_DIR/violetteam_ssl_certs.tar.gz" ]; then
        read -p "是否恢复 SSL 证书? (建议重新申请) (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            tar -xzf "$BACKUP_DIR/violetteam_ssl_certs.tar.gz" -C /
            log_info "✓ SSL 证书恢复完成"
        fi
    fi
    
    # 7. 恢复 systemd 服务
    log_info "7/8 恢复 systemd 服务..."
    if [ -f "$BACKUP_DIR/github-proxy.service" ]; then
        cp "$BACKUP_DIR/github-proxy.service" /etc/systemd/system/
        systemctl daemon-reload
        systemctl enable github-proxy
        systemctl start github-proxy
        log_info "✓ GitHub 代理服务已启动"
    else
        log_info "创建 systemd 服务..."
        cat > /etc/systemd/system/github-proxy.service << 'EOF'
[Unit]
Description=GitHub Proxy Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/github-proxy
ExecStart=/usr/bin/python3 /opt/github-proxy/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload
        systemctl enable github-proxy
        systemctl start github-proxy
        log_info "✓ GitHub 代理服务已创建并启动"
    fi
    
    # 8. 启动 Nginx
    log_info "8/8 启动 Nginx..."
    systemctl reload nginx
    log_info "✓ Nginx 已重载"
    
    # 验证服务
    sleep 2
    if systemctl is-active --quiet github-proxy; then
        log_info "✓ GitHub 代理服务运行正常"
    else
        log_warn "GitHub 代理服务状态异常"
    fi
    
    if systemctl is-active --quiet nginx; then
        log_info "✓ Nginx 服务运行正常"
    else
        log_warn "Nginx 服务状态异常"
    fi

else
    log_error "无效的服务器类型: $SERVER_TYPE"
    echo "使用方法: sudo bash $0 [hk|gz] /path/to/backup"
    exit 1
fi

################################################################################
# 恢复完成
################################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "恢复完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "下一步操作:"
if [ "$SERVER_TYPE" = "hk" ]; then
    echo "  1. 检查环境变量: nano /var/www/mirror/api/.env"
    echo "  2. 查看服务日志: pm2 logs mirror-api"
    echo "  3. 测试 API: curl http://localhost:3000/api/health"
    echo "  4. 申请 SSL 证书: sudo certbot --nginx -d your-domain.com"
    echo "  5. 更新 DNS 记录指向新服务器 IP"
    echo "  6. 运行验证脚本: bash scripts/migrate-verify.sh hk"
else
    echo "  1. 查看服务日志: sudo journalctl -u github-proxy -f"
    echo "  2. 测试 GitHub 代理: curl http://localhost:18080/health"
    echo "  3. 申请 SSL 证书: sudo certbot --nginx -d your-domain.com"
    echo "  4. 更新 DNS 记录指向新服务器 IP"
    echo "  5. 运行验证脚本: bash scripts/migrate-verify.sh gz"
fi
echo ""
log_info "结束时间: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

