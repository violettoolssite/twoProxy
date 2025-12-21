#!/bin/bash
#
# Mirror 加速站 - curl 下载示例
# 使用 API Key 获取加速地址并下载文件
#

API_KEY="${MIRROR_API_KEY:-}"
API_BASE="https://mirror.yljdteam.com"

if [ -z "$API_KEY" ]; then
  echo "❌ 错误: 请设置环境变量 MIRROR_API_KEY"
  echo "   例如: export MIRROR_API_KEY='your-api-key-here'"
  exit 1
fi

if [ -z "$1" ]; then
  echo "使用方法: $0 <原始URL> [保存文件名]"
  echo ""
  echo "示例:"
  echo "  $0 https://github.com/ollama/ollama/releases/download/v0.13.4/ollama-linux-amd64.tgz"
  echo "  $0 https://github.com/ollama/ollama/releases/download/v0.13.4/ollama-linux-amd64.tgz ollama.tgz"
  exit 1
fi

ORIGINAL_URL="$1"
SAVE_FILE="${2:-$(basename "$ORIGINAL_URL")}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Mirror 加速站 - curl 下载"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "原始 URL: $ORIGINAL_URL"
echo ""

# 获取加速地址
echo "正在获取加速地址..."
RESPONSE=$(curl -s -X POST \
  "$API_BASE/api/download/generate" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$ORIGINAL_URL\"}")

# 检查响应
if echo "$RESPONSE" | grep -q '"success":true'; then
  # 提取加速地址
  ACCELERATED_URL=$(echo "$RESPONSE" | grep -o '"acceleratedUrl":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$ACCELERATED_URL" ]; then
    echo "❌ 无法提取加速地址"
    echo "响应: $RESPONSE"
    exit 1
  fi
  
  echo "✅ 加速地址: $ACCELERATED_URL"
  echo ""
  echo "开始下载..."
  
  # 使用 curl 下载
  curl -L --progress-bar "$ACCELERATED_URL" -o "$SAVE_FILE"
  
  if [ $? -eq 0 ]; then
    SIZE=$(stat -c%s "$SAVE_FILE" 2>/dev/null || stat -f%z "$SAVE_FILE" 2>/dev/null)
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 下载完成！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "文件: $SAVE_FILE"
    echo "大小: $SIZE bytes ($(numfmt --to=iec-i --suffix=B $SIZE 2>/dev/null || echo "$(awk "BEGIN {printf \"%.2f\", $SIZE/1024/1024}") MB"))"
    echo ""
  else
    echo ""
    echo "❌ 下载失败"
    exit 1
  fi
else
  echo "❌ API 请求失败"
  echo "响应: $RESPONSE"
  exit 1
fi

