#!/bin/bash

################################################################################
# 迁移验证脚本
# 用途: 验证迁移后的服务是否正常运行
# 使用: bash migrate-verify.sh [hk|gz]
################################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_test() {
    echo -e "${CYAN}[TEST]${NC} $1"
}

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
test_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        log_info "$2"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "$2"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 检查参数
SERVER_TYPE=${1:-hk}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "         Mirror 加速站 - 迁移验证脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "服务器类型: $SERVER_TYPE"
echo "验证时间: $(date)"
echo ""

################################################################################
# 香港服务器验证 (Mirror 主站)
################################################################################
if [ "$SERVER_TYPE" = "hk" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第一部分: 系统服务检查"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 1. 检查 Node.js
    log_test "检查 Node.js..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        test_result 0 "Node.js 已安装: $NODE_VERSION"
    else
        test_result 1 "Node.js 未安装"
    fi
    
    # 2. 检查 MySQL
    log_test "检查 MySQL..."
    if systemctl is-active --quiet mysql; then
        test_result 0 "MySQL 服务运行正常"
    else
        test_result 1 "MySQL 服务未运行"
    fi
    
    # 3. 检查 Redis
    log_test "检查 Redis..."
    if systemctl is-active --quiet redis-server; then
        test_result 0 "Redis 服务运行正常"
    else
        test_result 1 "Redis 服务未运行"
    fi
    
    # 4. 检查 Nginx
    log_test "检查 Nginx..."
    if systemctl is-active --quiet nginx; then
        test_result 0 "Nginx 服务运行正常"
    else
        test_result 1 "Nginx 服务未运行"
    fi
    
    # 5. 检查 PM2
    log_test "检查 PM2..."
    if command -v pm2 &> /dev/null; then
        if pm2 list | grep -q "mirror-api.*online"; then
            test_result 0 "PM2 服务运行正常"
        else
            test_result 1 "mirror-api 未在 PM2 中运行"
        fi
    else
        test_result 1 "PM2 未安装"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第二部分: 项目文件检查"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 6. 检查项目目录
    log_test "检查项目目录..."
    if [ -d "/var/www/mirror" ]; then
        test_result 0 "项目目录存在: /var/www/mirror"
    else
        test_result 1 "项目目录不存在"
    fi
    
    # 7. 检查环境变量文件
    log_test "检查环境变量文件..."
    if [ -f "/var/www/mirror/api/.env" ]; then
        test_result 0 ".env 文件存在"
    else
        test_result 1 ".env 文件不存在"
    fi
    
    # 8. 检查 node_modules
    log_test "检查 Node.js 依赖..."
    if [ -d "/var/www/mirror/api/node_modules" ]; then
        test_result 0 "node_modules 目录存在"
    else
        test_result 1 "node_modules 目录不存在，请运行 npm install"
    fi
    
    # 9. 检查 Nginx 配置
    log_test "检查 Nginx 配置..."
    if [ -f "/etc/nginx/sites-enabled/mirror.conf" ]; then
        if nginx -t 2>&1 | grep -q "test is successful"; then
            test_result 0 "Nginx 配置正确"
        else
            test_result 1 "Nginx 配置有误"
        fi
    else
        test_result 1 "Nginx 配置文件不存在"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第三部分: API 接口测试"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 10. 测试 API 健康检查
    log_test "测试 API 健康检查..."
    if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
        test_result 0 "API 健康检查通过"
    else
        test_result 1 "API 健康检查失败"
    fi
    
    # 11. 测试前端页面
    log_test "测试前端页面..."
    if curl -s -f http://localhost/ > /dev/null 2>&1; then
        test_result 0 "前端页面可访问"
    else
        test_result 1 "前端页面无法访问"
    fi
    
    # 12. 测试 GitHub API
    log_test "测试 GitHub 代理..."
    if curl -s -f "http://localhost/gh/search/repositories?q=test&per_page=1" > /dev/null 2>&1; then
        test_result 0 "GitHub 代理功能正常"
    else
        test_result 1 "GitHub 代理功能异常"
    fi
    
    # 13. 测试 Docker Hub API
    log_test "测试 Docker Hub 代理..."
    if curl -s -f "http://localhost/v2/search/?query=nginx" > /dev/null 2>&1; then
        test_result 0 "Docker Hub 代理功能正常"
    else
        test_result 1 "Docker Hub 代理功能异常"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第四部分: 数据库连接测试"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 14. 测试 MySQL 连接
    log_test "测试 MySQL 连接..."
    if mysql -u mirror -p$(grep DB_PASSWORD /var/www/mirror/api/.env 2>/dev/null | cut -d'=' -f2) mirror -e "SELECT 1;" 2>/dev/null; then
        test_result 0 "MySQL 数据库连接正常"
    else
        test_result 1 "MySQL 数据库连接失败（可能是密码保护）"
    fi
    
    # 15. 测试 Redis 连接
    log_test "测试 Redis 连接..."
    if redis-cli ping 2>/dev/null | grep -q "PONG"; then
        test_result 0 "Redis 连接正常"
    else
        test_result 1 "Redis 连接失败"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第五部分: SSL 证书检查"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 16. 检查 SSL 证书
    log_test "检查 SSL 证书..."
    if [ -d "/etc/letsencrypt/live" ]; then
        CERT_COUNT=$(ls -1 /etc/letsencrypt/live/ 2>/dev/null | wc -l)
        if [ "$CERT_COUNT" -gt 0 ]; then
            test_result 0 "SSL 证书已安装 (共 $CERT_COUNT 个域名)"
        else
            test_result 1 "未找到 SSL 证书"
        fi
    else
        test_result 1 "Let's Encrypt 目录不存在"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第六部分: 系统资源检查"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 17. 检查磁盘空间
    log_test "检查磁盘空间..."
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -lt 80 ]; then
        test_result 0 "磁盘空间充足 (已使用 ${DISK_USAGE}%)"
    else
        test_result 1 "磁盘空间不足 (已使用 ${DISK_USAGE}%)"
    fi
    
    # 18. 检查内存使用
    log_test "检查内存使用..."
    MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    if [ "$MEM_USAGE" -lt 90 ]; then
        test_result 0 "内存使用正常 (已使用 ${MEM_USAGE}%)"
    else
        test_result 1 "内存使用过高 (已使用 ${MEM_USAGE}%)"
    fi

################################################################################
# 广州服务器验证 (VioletTeam)
################################################################################
elif [ "$SERVER_TYPE" = "gz" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第一部分: 系统服务检查"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 1. 检查 Python
    log_test "检查 Python..."
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        test_result 0 "Python 已安装: $PYTHON_VERSION"
    else
        test_result 1 "Python 未安装"
    fi
    
    # 2. 检查 Nginx
    log_test "检查 Nginx..."
    if systemctl is-active --quiet nginx; then
        test_result 0 "Nginx 服务运行正常"
    else
        test_result 1 "Nginx 服务未运行"
    fi
    
    # 3. 检查 GitHub 代理服务
    log_test "检查 GitHub 代理服务..."
    if systemctl is-active --quiet github-proxy; then
        test_result 0 "GitHub 代理服务运行正常"
    else
        test_result 1 "GitHub 代理服务未运行"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第二部分: 项目文件检查"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 4. 检查前端项目目录
    log_test "检查前端项目目录..."
    if [ -d "/var/www/violetteam" ]; then
        test_result 0 "前端项目目录存在"
    else
        test_result 1 "前端项目目录不存在"
    fi
    
    # 5. 检查 GitHub 代理目录
    log_test "检查 GitHub 代理目录..."
    if [ -d "/opt/github-proxy" ]; then
        test_result 0 "GitHub 代理目录存在"
    else
        test_result 1 "GitHub 代理目录不存在"
    fi
    
    # 6. 检查 Python 脚本
    log_test "检查 Python 脚本..."
    if [ -f "/opt/github-proxy/app.py" ]; then
        test_result 0 "Python 脚本存在"
    else
        test_result 1 "Python 脚本不存在"
    fi
    
    # 7. 检查 Nginx 配置
    log_test "检查 Nginx 配置..."
    if [ -f "/etc/nginx/sites-enabled/violetteam.conf" ]; then
        if nginx -t 2>&1 | grep -q "test is successful"; then
            test_result 0 "Nginx 配置正确"
        else
            test_result 1 "Nginx 配置有误"
        fi
    else
        test_result 1 "Nginx 配置文件不存在"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第三部分: API 接口测试"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 8. 测试前端页面
    log_test "测试前端页面..."
    if curl -s -f http://localhost/ > /dev/null 2>&1; then
        test_result 0 "前端页面可访问"
    else
        test_result 1 "前端页面无法访问"
    fi
    
    # 9. 测试健康检查
    log_test "测试健康检查..."
    if curl -s -f http://localhost/health > /dev/null 2>&1; then
        test_result 0 "健康检查通过"
    else
        test_result 1 "健康检查失败"
    fi
    
    # 10. 测试 GitHub 代理
    log_test "测试 GitHub 代理..."
    if curl -s -f http://localhost:18080/ > /dev/null 2>&1; then
        test_result 0 "GitHub 代理端口可访问"
    else
        test_result 1 "GitHub 代理端口无法访问"
    fi
    
    # 11. 测试 Docker Registry
    log_test "测试 Docker Registry 代理..."
    if curl -s -f http://localhost/v2/_catalog > /dev/null 2>&1; then
        test_result 0 "Docker Registry 代理正常"
    else
        test_result 1 "Docker Registry 代理异常"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第四部分: SSL 证书检查"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 12. 检查 SSL 证书
    log_test "检查 SSL 证书..."
    if [ -d "/etc/letsencrypt/live" ]; then
        CERT_COUNT=$(ls -1 /etc/letsencrypt/live/ 2>/dev/null | wc -l)
        if [ "$CERT_COUNT" -gt 0 ]; then
            test_result 0 "SSL 证书已安装 (共 $CERT_COUNT 个域名)"
        else
            test_result 1 "未找到 SSL 证书"
        fi
    else
        test_result 1 "Let's Encrypt 目录不存在"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  第五部分: 系统资源检查"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 13. 检查磁盘空间
    log_test "检查磁盘空间..."
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -lt 80 ]; then
        test_result 0 "磁盘空间充足 (已使用 ${DISK_USAGE}%)"
    else
        test_result 1 "磁盘空间不足 (已使用 ${DISK_USAGE}%)"
    fi
    
    # 14. 检查内存使用
    log_test "检查内存使用..."
    MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    if [ "$MEM_USAGE" -lt 90 ]; then
        test_result 0 "内存使用正常 (已使用 ${MEM_USAGE}%)"
    else
        test_result 1 "内存使用过高 (已使用 ${MEM_USAGE}%)"
    fi

else
    log_error "无效的服务器类型: $SERVER_TYPE"
    echo "使用方法: bash $0 [hk|gz]"
    exit 1
fi

################################################################################
# 显示测试结果汇总
################################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  测试结果汇总"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✓ 所有测试通过！迁移成功！${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "下一步建议:"
    if [ "$SERVER_TYPE" = "hk" ]; then
        echo "  1. 更新 DNS 记录指向新服务器"
        echo "  2. 等待 DNS 传播完成（5-30分钟）"
        echo "  3. 使用浏览器访问网站测试功能"
        echo "  4. 监控服务日志: pm2 logs mirror-api"
        echo "  5. 保持旧服务器运行 7 天作为备份"
    else
        echo "  1. 更新 DNS 记录指向新服务器"
        echo "  2. 等待 DNS 传播完成（5-30分钟）"
        echo "  3. 使用浏览器访问网站测试功能"
        echo "  4. 监控服务日志: sudo journalctl -u github-proxy -f"
        echo "  5. 保持旧服务器运行 7 天作为备份"
    fi
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  ✗ 有 $FAILED_TESTS 项测试失败，请检查相关服务${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "故障排查建议:"
    if [ "$SERVER_TYPE" = "hk" ]; then
        echo "  1. 查看 PM2 日志: pm2 logs mirror-api --lines 100"
        echo "  2. 查看 Nginx 错误日志: sudo tail -f /var/log/nginx/error.log"
        echo "  3. 检查环境变量: cat /var/www/mirror/api/.env"
        echo "  4. 测试数据库连接: mysql -u mirror -p mirror"
        echo "  5. 重启服务: pm2 restart mirror-api && sudo systemctl reload nginx"
    else
        echo "  1. 查看服务日志: sudo journalctl -u github-proxy -n 50"
        echo "  2. 查看 Nginx 错误日志: sudo tail -f /var/log/nginx/error.log"
        echo "  3. 手动测试 Python 脚本: cd /opt/github-proxy && python3 app.py"
        echo "  4. 检查端口占用: sudo netstat -tlnp | grep ':18080'"
        echo "  5. 重启服务: sudo systemctl restart github-proxy nginx"
    fi
    echo ""
    echo "技术支持: QQ 1494458927"
    exit 1
fi

