#!/bin/bash

echo "======================================"
echo "添加短信接码API配置"
echo "======================================"
echo ""

# 检查.env文件
if [ ! -f "api/.env" ]; then
    echo "[错误] api/.env 文件不存在"
    exit 1
fi

# 检查是否已存在SMS配置
if grep -q "^SMS_API_URL=" api/.env 2>/dev/null; then
    echo "[提示] SMS配置已存在，将更新现有配置"
    echo ""
    
    # 备份
    cp api/.env api/.env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份原配置文件"
    
    # 删除旧配置
    sed -i '/^SMS_API_URL=/d' api/.env
    sed -i '/^SMS_API_USER=/d' api/.env
    sed -i '/^SMS_API_PASS=/d' api/.env
fi

# 提示用户输入
echo "请输入好助码API配置："
echo "(留空使用默认服务器地址)"
echo ""

read -p "服务器地址 [https://api.haozhuma.com]: " SMS_URL
SMS_URL=${SMS_URL:-https://api.haozhuma.com}

read -p "API用户名: " SMS_USER
if [ -z "$SMS_USER" ]; then
    echo "[错误] API用户名不能为空"
    exit 1
fi

read -sp "API密码: " SMS_PASS
echo ""

if [ -z "$SMS_PASS" ]; then
    echo "[错误] API密码不能为空"
    exit 1
fi

# 添加配置到.env文件
echo "" >> api/.env
echo "# 短信接码API配置（好助码平台）" >> api/.env
echo "SMS_API_URL=$SMS_URL" >> api/.env
echo "SMS_API_USER=$SMS_USER" >> api/.env
echo "SMS_API_PASS=$SMS_PASS" >> api/.env

echo ""
echo "======================================"
echo "✅ 配置已添加到 api/.env"
echo "======================================"
echo ""
echo "下一步："
echo "1. 测试API连接: ./test-sms-api.sh"
echo "2. 重启API服务: cd api && pm2 restart mirror-api"
echo "3. 访问测试: https://mirror.yljdteam.com/#/sms"
echo ""
