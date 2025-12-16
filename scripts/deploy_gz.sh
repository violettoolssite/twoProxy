#!/usr/bin/env bash
#
# 一键部署【广州节点】脚本（推荐 Ubuntu 24）
# -----------------------------------------
#
# 功能：
# - 安装 nginx、Python3、pip、Flask、requests
# - 安装 github_proxy_gz.py 到 /opt/github-proxy
# - 生成一个简单的 systemd service（可选）
# - 安装 deploy/nginx.github-proxy.conf 到 /etc/nginx/sites-available/github-proxy.conf
#
# 使用前请先修改 deploy/nginx.github-proxy.conf 中的：
# - YOUR_GZ_DOMAIN
# - 证书路径（若不使用 certbot 的默认路径）
#

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[GZ] Using repo dir: $REPO_DIR"

if [[ $EUID -ne 0 ]]; then
  echo "请以 root 或 sudo 运行本脚本" >&2
  exit 1
fi

echo "[GZ] 安装 nginx 与 Python 依赖 ..."
apt-get update -y
apt-get install -y nginx python3 python3-pip
pip3 install --upgrade pip
pip3 install flask requests

echo "[GZ] 安装 github_proxy_gz.py 到 /opt/github-proxy ..."
mkdir -p /opt/github-proxy
cp "$REPO_DIR/scripts/github_proxy_gz.py" /opt/github-proxy/github_proxy_gz.py

echo "[GZ] 创建 systemd 服务（/etc/systemd/system/github-proxy.service）..."
cat >/etc/systemd/system/github-proxy.service <<'UNIT'
[Unit]
Description=GitHub Download Proxy (Guangzhou)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/github-proxy
ExecStart=/usr/bin/python3 /opt/github-proxy/github_proxy_gz.py
Restart=always
RestartSec=5

# 如需通过 Shadowsocks 等上游代理出网，请在这里设置 HTTP_PROXY/HTTPS_PROXY
# Environment="HTTP_PROXY=socks5h://127.0.0.1:1080"
# Environment="HTTPS_PROXY=socks5h://127.0.0.1:1080"

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable github-proxy.service
systemctl restart github-proxy.service

echo "[GZ] 配置 Nginx ..."
cp "$REPO_DIR/deploy/nginx.github-proxy.conf" /etc/nginx/sites-available/github-proxy.conf

# 检测是使用域名还是 IP
echo ""
echo "[GZ] 请选择配置方式："
echo "  1) 使用域名（需要 SSL 证书）"
echo "  2) 使用公网 IP（HTTP 服务，无需证书）"
read -p "请输入选项 [1/2]（默认 2）: " CONFIG_MODE
CONFIG_MODE=${CONFIG_MODE:-2}

if [[ "$CONFIG_MODE" == "1" ]]; then
    read -p "请输入域名（例如 violetteam.cloud）: " GZ_DOMAIN
    sed -i "s/YOUR_GZ_DOMAIN/$GZ_DOMAIN/g" /etc/nginx/sites-available/github-proxy.conf
    echo "[GZ] 已配置为 HTTPS 模式，域名: $GZ_DOMAIN"
    echo "[GZ] 请运行以下命令申请证书："
    echo "    certbot --nginx -d $GZ_DOMAIN --agree-tos --email your@email.com"
else
    # 自动获取公网 IP 或手动输入
    echo "[GZ] 正在获取公网 IP ..."
    GZ_IP=$(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 ip.sb || curl -s --max-time 5 icanhazip.com || echo "")
    if [[ -z "$GZ_IP" ]]; then
        read -p "无法自动获取 IP，请手动输入公网 IP: " GZ_IP
    else
        echo "[GZ] 检测到公网 IP: $GZ_IP"
        read -p "是否使用此 IP？[Y/n]: " USE_IP
        if [[ "${USE_IP:-Y}" != "Y" && "${USE_IP:-Y}" != "y" ]]; then
            read -p "请输入公网 IP: " GZ_IP
        fi
    fi
    
    # 替换 IP 并配置为 HTTP 模式
    sed -i "s/YOUR_GZ_DOMAIN/$GZ_IP/g" /etc/nginx/sites-available/github-proxy.conf
    
    # 注释掉 SSL 配置，改为 HTTP
    sed -i 's/listen 9090 ssl http2;/listen 9090; # HTTP mode (no SSL for IP)/' /etc/nginx/sites-available/github-proxy.conf
    sed -i 's/^    ssl_certificate/#    ssl_certificate/' /etc/nginx/sites-available/github-proxy.conf
    sed -i 's/^    ssl_certificate_key/#    ssl_certificate_key/' /etc/nginx/sites-available/github-proxy.conf
    sed -i 's/^    include \/etc\/letsencrypt\/options-ssl-nginx.conf;/#    include \/etc\/letsencrypt\/options-ssl-nginx.conf;/' /etc/nginx/sites-available/github-proxy.conf
    sed -i 's/^    ssl_dhparam/#    ssl_dhparam/' /etc/nginx/sites-available/github-proxy.conf
    sed -i 's/proxy_set_header X-Forwarded-Proto https;/proxy_set_header X-Forwarded-Proto http; # HTTP mode/' /etc/nginx/sites-available/github-proxy.conf
    
    echo "[GZ] 已配置为 HTTP 模式，IP: $GZ_IP"
    echo "[GZ] 注意：前端 js/app.js 中的 GitHub 加速地址也需要改为 http://$GZ_IP:9090/github/..."
fi

ln -sf /etc/nginx/sites-available/github-proxy.conf /etc/nginx/sites-enabled/github-proxy.conf

echo "[GZ] 测试并重载 Nginx ..."
nginx -t
systemctl reload nginx

if [[ "$CONFIG_MODE" == "1" ]]; then
    cat <<INFO
[GZ] 广州节点基础部署完成（HTTPS 模式）。

下一步建议：
1. 使用 certbot 为 $GZ_DOMAIN 签发证书：
   certbot --nginx -d $GZ_DOMAIN --agree-tos --email you@example.com

2. 如需通过 Shadowsocks 出网：
   - 在本机先配置好 ss-local（或其他代理），例如监听 127.0.0.1:1080。
   - 编辑 /etc/systemd/system/github-proxy.service，将 Environment="HTTP_PROXY=..." 等行取消注释并填入正确地址。
   - 运行：
       systemctl daemon-reload
       systemctl restart github-proxy.service

3. 前端中，将 GitHub 下载加速前缀设置为：
   https://$GZ_DOMAIN:9090/github/...

INFO
else
    cat <<INFO
[GZ] 广州节点基础部署完成（HTTP 模式，使用 IP）。

下一步建议：
1. 修改前端 js/app.js，将 GitHub 加速地址改为：
   http://$GZ_IP:9090/github/...
   
   可以使用以下命令：
   sed -i 's|https://violetteam.cloud:9090|http://$GZ_IP:9090|g' /path/to/frontend/js/app.js

2. 如需通过 Shadowsocks 出网：
   - 在本机先配置好 ss-local（或其他代理），例如监听 127.0.0.1:1080。
   - 编辑 /etc/systemd/system/github-proxy.service，将 Environment="HTTP_PROXY=..." 等行取消注释并填入正确地址。
   - 运行：
       systemctl daemon-reload
       systemctl restart github-proxy.service

3. 测试服务是否正常：
   curl http://$GZ_IP:9090/status

INFO
fi


