#!/bin/bash

################################################################################
# CDN域名路由错误修复脚本
# 用途: 修复 mirror.violetteam.cloud 访问错误路由到 hunshcn/gh-proxy 的问题
# 使用: sudo bash fix-cdn-domain.sh
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

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then 
    log_error "此脚本需要 root 权限运行"
    echo "请使用: sudo bash $0"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "     CDN 域名路由错误修复脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

NGINX_CONF="/etc/nginx/sites-enabled/mirror.conf"

# 检查配置文件是否存在
if [ ! -f "$NGINX_CONF" ]; then
    log_error "Nginx 配置文件不存在: $NGINX_CONF"
    echo ""
    echo "请先创建配置文件："
    echo "  sudo cp /var/www/mirror/deploy/nginx-hongkong.conf.example $NGINX_CONF"
    exit 1
fi

log_step "步骤 1/4: 备份当前配置..."
BACKUP_FILE="${NGINX_CONF}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONF" "$BACKUP_FILE"
log_info "✓ 配置已备份到: $BACKUP_FILE"
echo ""

log_step "步骤 2/4: 检查当前排除列表..."
if grep -q "hunshcn\|gh-proxy" "$NGINX_CONF"; then
    log_info "✓ 排除列表中已包含相关项"
else
    log_warn "⚠ 排除列表中未包含 hunshcn 和 gh-proxy"
fi
echo ""

log_step "步骤 3/4: 更新排除列表..."
# 查找GitHub代理规则的位置
if grep -q "location ~ \^/(\[^/\]\+/\[^/\]\+)" "$NGINX_CONF"; then
    # 使用sed更新排除列表
    sed -i 's/if ($owner_repo ~ \^(css|js|file|assets|_next|static|favicon\\.ico|github|search|v2))/if ($owner_repo ~ ^(css|js|file|assets|api|user|admin|_next|static|favicon\.ico|github|search|v2|gh|sponsors|hunshcn|gh-proxy|violetteam|mirror))/' "$NGINX_CONF"
    
    # 如果上面的sed失败，尝试更简单的方式
    if ! grep -q "hunshcn\|gh-proxy" "$NGINX_CONF"; then
        log_warn "自动更新失败，需要手动编辑配置文件"
        echo ""
        echo "请手动编辑 $NGINX_CONF"
        echo "找到 GitHub 代理规则中的排除列表，添加："
        echo "  hunshcn|gh-proxy|violetteam|mirror|api|user|admin|gh|sponsors"
        echo ""
        read -p "是否现在编辑配置文件? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            nano "$NGINX_CONF"
        fi
    else
        log_info "✓ 排除列表已更新"
    fi
else
    log_warn "未找到 GitHub 代理规则，可能需要手动配置"
fi
echo ""

log_step "步骤 4/4: 测试配置..."
if nginx -t 2>&1 | grep -q "test is successful"; then
    log_info "✓ Nginx 配置测试通过"
    echo ""
    read -p "是否立即重载 Nginx? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        systemctl reload nginx
        log_info "✓ Nginx 已重载"
    else
        log_warn "请稍后手动重载: sudo systemctl reload nginx"
    fi
else
    log_error "✗ Nginx 配置测试失败"
    echo ""
    echo "请检查配置文件: $NGINX_CONF"
    echo "如果修改有误，可以恢复备份:"
    echo "  sudo cp $BACKUP_FILE $NGINX_CONF"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "修复完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "验证步骤："
echo "  1. 访问主页: curl -I https://mirror.violetteam.cloud/"
echo "  2. 应该返回 index.html，而不是 GitHub 代理页面"
echo "  3. 测试 API: curl https://mirror.violetteam.cloud/api/health"
echo ""
log_info "如果问题仍然存在："
echo "  1. 查看修复指南: cat CDN_DOMAIN_FIX.md"
echo "  2. 检查 CDN 回源配置"
echo "  3. 检查 DNS 记录"
echo ""
log_info "备份文件: $BACKUP_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

