#!/bin/bash

###############################################################################
# GitHub SSH 密钥快速设置脚本
# 用途: 为 GitHub 推送配置 SSH 密钥认证
###############################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  GitHub SSH 密钥设置向导${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查是否已有 SSH 密钥
if [ -f ~/.ssh/id_ed25519.pub ] || [ -f ~/.ssh/id_rsa.pub ]; then
    echo -e "${GREEN}✅ 发现已有 SSH 密钥${NC}"
    echo ""
    
    if [ -f ~/.ssh/id_ed25519.pub ]; then
        echo "Ed25519 公钥内容:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        cat ~/.ssh/id_ed25519.pub
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    elif [ -f ~/.ssh/id_rsa.pub ]; then
        echo "RSA 公钥内容:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        cat ~/.ssh/id_rsa.pub
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi
    
    echo ""
    read -p "是否使用现有密钥? (y/n): " use_existing
    
    if [ "$use_existing" != "y" ] && [ "$use_existing" != "Y" ]; then
        echo -e "${YELLOW}⚠️  将生成新的 SSH 密钥（旧密钥将被保留）${NC}"
        read -p "按回车继续..."
    else
        SKIP_GENERATE=true
    fi
fi

# 生成新的 SSH 密钥
if [ "$SKIP_GENERATE" != "true" ]; then
    echo ""
    echo -e "${GREEN}📝 步骤 1: 生成 SSH 密钥${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    read -p "请输入邮箱（用于标识密钥，按回车使用默认）: " email
    if [ -z "$email" ]; then
        email="twoProxy@$(hostname)"
    fi
    
    echo "生成 Ed25519 密钥..."
    ssh-keygen -t ed25519 -C "$email" -f ~/.ssh/id_ed25519 -N ''
    
    echo ""
    echo -e "${GREEN}✅ SSH 密钥已生成${NC}"
fi

# 显示公钥
echo ""
echo -e "${GREEN}📋 步骤 2: 复制公钥内容${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "请复制以下公钥内容（已自动复制到剪贴板，如支持）:"
echo ""

if [ -f ~/.ssh/id_ed25519.pub ]; then
    cat ~/.ssh/id_ed25519.pub
    # 尝试复制到剪贴板
    if command -v xclip &> /dev/null; then
        cat ~/.ssh/id_ed25519.pub | xclip -selection clipboard
        echo ""
        echo -e "${GREEN}✅ 已自动复制到剪贴板${NC}"
    elif command -v pbcopy &> /dev/null; then
        cat ~/.ssh/id_ed25519.pub | pbcopy
        echo ""
        echo -e "${GREEN}✅ 已自动复制到剪贴板${NC}"
    fi
elif [ -f ~/.ssh/id_rsa.pub ]; then
    cat ~/.ssh/id_rsa.pub
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 添加到 GitHub
echo ""
echo -e "${GREEN}🌐 步骤 3: 添加公钥到 GitHub${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 访问: ${BLUE}https://github.com/settings/ssh/new${NC}"
echo "2. Title: hongkong-server (或任意名称)"
echo "3. Key type: Authentication Key"
echo "4. 粘贴上面的公钥内容"
echo "5. 点击 'Add SSH key'"
echo ""

read -p "完成后按回车继续..."

# 测试 SSH 连接
echo ""
echo -e "${GREEN}🔍 步骤 4: 测试 SSH 连接${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试连接到 GitHub..."

if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo -e "${GREEN}✅ SSH 连接成功！${NC}"
else
    echo -e "${YELLOW}⚠️  连接测试未通过，但这可能是正常的${NC}"
    echo "如果看到 'Hi xxx! You've successfully authenticated' 消息，说明成功"
fi

# 修改 Git 仓库 URL
echo ""
echo -e "${GREEN}🔧 步骤 5: 修改 Git 仓库 URL${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /var/www/mirror

current_url=$(git remote get-url origin 2>/dev/null || echo "")
if [ -n "$current_url" ]; then
    echo "当前 URL: $current_url"
    
    if [[ $current_url == git@github.com:* ]]; then
        echo -e "${GREEN}✅ 已经是 SSH URL，无需修改${NC}"
    else
        echo "修改为 SSH URL..."
        git remote set-url origin git@github.com:violettoolssite/twoProxy.git
        echo -e "${GREEN}✅ URL 已更新${NC}"
        echo "新 URL: $(git remote get-url origin)"
    fi
else
    echo "添加远程仓库..."
    git remote add origin git@github.com:violettoolssite/twoProxy.git
    echo -e "${GREEN}✅ 远程仓库已添加${NC}"
fi

# 推送测试
echo ""
echo -e "${GREEN}🚀 步骤 6: 推送到 GitHub${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "准备推送..."
echo ""

read -p "是否现在推送? (y/n): " do_push

if [ "$do_push" = "y" ] || [ "$do_push" = "Y" ]; then
    git push origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}🎉 成功推送到 GitHub！${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "查看仓库: https://github.com/violettoolssite/twoProxy"
    else
        echo ""
        echo -e "${YELLOW}⚠️  推送失败，请检查错误信息${NC}"
    fi
else
    echo ""
    echo "跳过推送。稍后可以手动执行:"
    echo "  cd /var/www/mirror"
    echo "  git push origin main"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  设置完成！${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

