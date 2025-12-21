#!/bin/bash
#
# Cursor 自动填写扩展安装脚本
# 用于快速设置扩展文件
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Cursor 自动填写扩展安装脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查必要文件
if [ ! -f "manifest-cursor.json" ]; then
  echo "❌ 错误: manifest-cursor.json 文件不存在"
  exit 1
fi

if [ ! -f "cursor-auto-fill.js" ]; then
  echo "❌ 错误: cursor-auto-fill.js 文件不存在"
  exit 1
fi

# 备份原有的 manifest.json（如果存在）
if [ -f "manifest.json" ] && [ ! -L "manifest.json" ]; then
  echo "📦 备份原有的 manifest.json..."
  cp manifest.json manifest.json.backup
fi

# 创建 manifest.json（从 manifest-cursor.json）
echo "📝 创建 manifest.json..."
cp manifest-cursor.json manifest.json

echo ""
echo "✅ 扩展文件已准备完成！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 下一步操作："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 打开浏览器扩展管理页面："
echo "   Chrome: chrome://extensions/"
echo "   Edge:   edge://extensions/"
echo ""
echo "2. 启用「开发者模式」（右上角开关）"
echo ""
echo "3. 点击「加载已解压的扩展程序」"
echo ""
echo "4. 选择当前文件夹："
echo "   $SCRIPT_DIR"
echo ""
echo "5. 确认安装后，访问 Cursor 注册页面测试"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

