#!/bin/bash

################################################################################
# CDN 边缘加速配置脚本
# 用途: 快速配置 CDN 加速静态资源
# 使用: bash setup-cdn.sh [cloudflare|tencent|aliyun]
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
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 检查参数
CDN_PROVIDER=${1:-cloudflare}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "         CDN 边缘加速配置脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "CDN 服务商: $CDN_PROVIDER"
log_info "开始时间: $(date)"
echo ""

################################################################################
# Cloudflare CDN 配置
################################################################################
if [ "$CDN_PROVIDER" = "cloudflare" ]; then
    log_step "配置 Cloudflare CDN..."
    
    echo ""
    log_info "Cloudflare CDN 配置步骤："
    echo ""
    echo "1. 登录 Cloudflare Dashboard: https://dash.cloudflare.com"
    echo "2. 添加站点: mirror.yljdteam.com"
    echo "3. 按照提示修改 DNS 记录"
    echo "4. 等待 DNS 生效（通常几分钟）"
    echo ""
    
    log_info "缓存规则配置（在 Page Rules 中添加）："
    echo ""
    echo "规则1: 静态CSS缓存7天"
    echo "  URL: mirror.yljdteam.com/css/*"
    echo "  设置: Cache Everything, Edge Cache TTL: 7 days"
    echo ""
    echo "规则2: 静态JS缓存7天"
    echo "  URL: mirror.yljdteam.com/js/*"
    echo "  设置: Cache Everything, Edge Cache TTL: 7 days"
    echo ""
    echo "规则3: API请求不缓存"
    echo "  URL: mirror.yljdteam.com/api/*"
    echo "  设置: Cache Level: Bypass"
    echo ""
    echo "规则4: 代理请求不缓存"
    echo "  URL: mirror.yljdteam.com/gh/* OR mirror.yljdteam.com/v2/*"
    echo "  设置: Cache Level: Bypass"
    echo ""
    
    log_info "性能优化设置："
    echo "  - Auto Minify: 开启（CSS、JS、HTML）"
    echo "  - Brotli 压缩: 开启"
    echo "  - HTTP/2: 开启"
    echo "  - HTTP/3 (QUIC): 开启（如果支持）"
    echo ""
    
    log_info "SSL/TLS 设置："
    echo "  - SSL/TLS 模式: Full (strict)"
    echo "  - 自动 HTTPS 重定向: 开启"
    echo ""
    
    # 生成 Cloudflare Workers 配置示例
    log_step "生成 Cloudflare Workers 配置示例..."
    cat > /tmp/cloudflare-worker.js << 'EOF'
// Cloudflare Workers 配置示例
// 部署到 Cloudflare Workers 可以实现更精细的缓存控制

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 静态资源：从 Cloudflare 缓存获取
  if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
    return fetch(request, {
      cf: {
        cacheEverything: true,
        cacheTtl: 604800 // 7天
      }
    });
  }
  
  // API 请求：直接回源，不缓存
  if (url.pathname.startsWith('/api/')) {
    return fetch(request, {
      cf: {
        cacheEverything: false
      }
    });
  }
  
  // 代理请求：直接回源
  if (url.pathname.startsWith('/gh/') || 
      url.pathname.startsWith('/v2/') || 
      url.pathname.startsWith('/file/')) {
    return fetch(request, {
      cf: {
        cacheEverything: false
      }
    });
  }
  
  // 其他请求：默认处理
  return fetch(request);
}
EOF
    
    log_info "✓ Cloudflare Workers 配置示例已保存到: /tmp/cloudflare-worker.js"
    echo ""

################################################################################
# 腾讯云 CDN 配置
################################################################################
elif [ "$CDN_PROVIDER" = "tencent" ]; then
    log_step "配置腾讯云 CDN..."
    
    echo ""
    log_info "腾讯云 CDN 配置步骤："
    echo ""
    echo "1. 登录腾讯云控制台: https://console.cloud.tencent.com"
    echo "2. 进入 CDN → 域名管理 → 添加域名"
    echo "3. 配置信息："
    echo "   - 加速域名: mirror.yljdteam.com"
    echo "   - 源站类型: 源站域名"
    echo "   - 源站地址: mirror.yljdteam.com（或源站IP）"
    echo "   - 加速区域: 全球"
    echo ""
    
    log_info "缓存规则配置："
    echo ""
    echo "在 缓存配置 → 节点缓存过期配置 中添加："
    echo ""
    echo "  /css/*          → 7天"
    echo "  /js/*           → 7天"
    echo "  *.jpg, *.png    → 30天"
    echo "  *.html          → 1小时"
    echo "  /api/*          → 不缓存"
    echo ""
    
    log_info "回源配置："
    echo "  - 回源 Host: mirror.yljdteam.com"
    echo ""
    
    log_info "HTTPS 配置："
    echo "  - 开启 HTTPS 加速"
    echo "  - 配置 SSL 证书（自动申请或上传）"
    echo "  - 开启 HTTP/2"
    echo "  - 开启强制跳转 HTTPS"
    echo ""

################################################################################
# 阿里云 CDN 配置
################################################################################
elif [ "$CDN_PROVIDER" = "aliyun" ]; then
    log_step "配置阿里云 CDN..."
    
    echo ""
    log_info "阿里云 CDN 配置步骤："
    echo ""
    echo "1. 登录阿里云控制台: https://ecs.console.aliyun.com"
    echo "2. 进入 CDN → 域名管理 → 添加域名"
    echo "3. 配置信息："
    echo "   - 加速域名: mirror.yljdteam.com"
    echo "   - 业务类型: 全站加速"
    echo "   - 源站信息: 源站域名或IP"
    echo "   - 加速区域: 全球"
    echo ""
    
    log_info "缓存规则配置："
    echo ""
    echo "在 缓存配置 → 缓存过期时间 中添加："
    echo ""
    echo "  /css/*          → 7天"
    echo "  /js/*           → 7天"
    echo "  *.jpg, *.png    → 30天"
    echo "  *.html          → 1小时"
    echo "  /api/*          → 不缓存"
    echo ""
    
    log_info "HTTPS 配置："
    echo "  - 开启 HTTPS 安全加速"
    echo "  - 配置 SSL 证书"
    echo "  - 开启 HTTP/2"
    echo ""

else
    log_error "不支持的 CDN 服务商: $CDN_PROVIDER"
    echo ""
    echo "支持的服务商:"
    echo "  - cloudflare  (Cloudflare CDN)"
    echo "  - tencent     (腾讯云 CDN)"
    echo "  - aliyun      (阿里云 CDN)"
    exit 1
fi

################################################################################
# 生成 Nginx 配置优化建议
################################################################################
log_step "生成 Nginx 配置优化建议..."
cat > /tmp/nginx-cdn-optimization.conf << 'EOF'
# Nginx CDN 优化配置
# 添加到 /etc/nginx/sites-enabled/mirror.conf

# ========= 静态资源缓存头 =========
location ^~ /css/ {
    access_log off;
    expires 7d;
    add_header Cache-Control "public, max-age=604800";
    add_header CDN-Cache-Control "public, max-age=604800";
    try_files $uri =404;
}

location ^~ /js/ {
    access_log off;
    expires 7d;
    add_header Cache-Control "public, max-age=604800";
    add_header CDN-Cache-Control "public, max-age=604800";
    try_files $uri =404;
}

# ========= API 请求不缓存 =========
location ^~ /api/ {
    add_header Cache-Control "no-store, no-cache, must-revalidate, private";
    add_header Pragma "no-cache";
    add_header Expires "0";
    proxy_pass http://127.0.0.1:3000;
    # ... 其他代理配置
}

# ========= 代理请求不缓存 =========
location ~ ^/(gh|v2|file)/ {
    add_header Cache-Control "no-store, no-cache, must-revalidate, private";
    add_header Pragma "no-cache";
    add_header Expires "0";
    # ... 代理配置
}
EOF

log_info "✓ Nginx 优化配置已保存到: /tmp/nginx-cdn-optimization.conf"
echo ""

################################################################################
# 生成测试脚本
################################################################################
log_step "生成 CDN 测试脚本..."
cat > /tmp/test-cdn.sh << 'EOF'
#!/bin/bash
# CDN 加速效果测试脚本

DOMAIN="mirror.yljdteam.com"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CDN 加速效果测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "测试静态资源加载速度..."
echo ""

# 测试 CSS
echo "1. CSS 文件:"
time curl -s -o /dev/null -w "  时间: %{time_total}s\n  大小: %{size_download} bytes\n  CDN节点: %{remote_ip}\n" \
  "https://${DOMAIN}/css/style.css" 2>/dev/null || echo "  ✗ 测试失败"
echo ""

# 测试 JS
echo "2. JavaScript 文件:"
time curl -s -o /dev/null -w "  时间: %{time_total}s\n  大小: %{size_download} bytes\n  CDN节点: %{remote_ip}\n" \
  "https://${DOMAIN}/js/app.js" 2>/dev/null || echo "  ✗ 测试失败"
echo ""

# 测试 API（应该不缓存）
echo "3. API 请求（应该回源）:"
time curl -s -o /dev/null -w "  时间: %{time_total}s\n  大小: %{size_download} bytes\n  源站: %{remote_ip}\n" \
  "https://${DOMAIN}/api/health" 2>/dev/null || echo "  ✗ 测试失败"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试完成！"
echo ""
echo "如果静态资源从CDN节点加载，说明CDN配置成功。"
echo "如果API请求从源站加载，说明缓存规则配置正确。"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
EOF

chmod +x /tmp/test-cdn.sh
log_info "✓ CDN 测试脚本已保存到: /tmp/test-cdn.sh"
echo ""

################################################################################
# 完成
################################################################################
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "CDN 配置指南生成完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "生成的文件："
echo "  1. Cloudflare Workers 配置: /tmp/cloudflare-worker.js"
echo "  2. Nginx 优化配置: /tmp/nginx-cdn-optimization.conf"
echo "  3. CDN 测试脚本: /tmp/test-cdn.sh"
echo ""
log_info "下一步操作："
echo "  1. 按照上述步骤配置 CDN 服务商"
echo "  2. 应用 Nginx 优化配置（可选）"
echo "  3. 运行测试脚本验证 CDN 效果"
echo ""
log_info "详细文档："
echo "  cat CDN_CONFIGURATION.md"
echo ""
log_info "结束时间: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

