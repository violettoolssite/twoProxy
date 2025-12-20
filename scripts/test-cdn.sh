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
