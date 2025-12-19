#!/usr/bin/env bash
#
# 一键部署【香港节点】脚本（推荐 Ubuntu 24）
# -----------------------------------------
#
# 功能：
# - 安装 nginx、certbot
# - 将本仓库中的 nginx.mirror.conf 安装到 /etc/nginx/sites-available/mirror.conf
# - （可选）构建 Ollama 增强安装脚本
#
# 使用前请先修改 deploy/nginx.mirror.conf 中的：
# - YOUR_HK_DOMAIN
# - 证书路径（若不使用 certbot 的默认路径）
#

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[HK] Using repo dir: $REPO_DIR"

if [[ $EUID -ne 0 ]]; then
  echo "请以 root 或 sudo 运行本脚本" >&2
  exit 1
fi

echo "[HK] 安装 nginx 与 certbot ..."
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

echo "[HK] 部署前端静态文件到 /var/www/mirror ..."
mkdir -p /var/www/mirror
rsync -a --delete "$REPO_DIR/index.html" "$REPO_DIR/css" "$REPO_DIR/js" /var/www/mirror/

echo "[HK] 安装 nginx.mirror.conf 到 /etc/nginx/sites-available/mirror.conf ..."
cp "$REPO_DIR/deploy/nginx.mirror.conf" /etc/nginx/sites-available/mirror.conf
ln -sf /etc/nginx/sites-available/mirror.conf /etc/nginx/sites-enabled/mirror.conf

echo "[HK] 测试并重载 Nginx ..."
nginx -t
systemctl reload nginx

cat <<'INFO'
[HK] 部署完成基础 Nginx 与前端站点。

下一步建议：
1. 使用 certbot 为 YOUR_HK_DOMAIN 签发证书，例如：
   certbot --nginx -d YOUR_HK_DOMAIN --agree-tos --email you@example.com

2. 如需启用 Ollama install.sh 增强脚本：
   - 编辑 scripts/build_ollama_install.sh，填好 CHANGE_ME_SS_* 占位符。
   - 运行：
       bash scripts/build_ollama_install.sh
   - 在 deploy/nginx.mirror.conf 中取消注释 ollama.com/install.sh 的 location。
   - 再次执行：
       nginx -t && systemctl reload nginx

INFO


