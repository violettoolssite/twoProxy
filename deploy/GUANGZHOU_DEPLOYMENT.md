# 广州服务器部署文档 (violetteam.cloud)

## 📋 服务器信息

- **域名**: violetteam.cloud
- **功能**: GitHub 文件加速 + Docker Registry 镜像
- **服务**:
  - 前端 SPA (端口 80/443)
  - 后端 API (端口 4000, 可选)
  - GitHub 代理服务 (Python, 端口 18080)
  - Docker Registry 代理（腾讯云镜像）

---

## 🚀 快速部署

### 1. 系统准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础软件
sudo apt install -y nginx python3 python3-pip git vim ufw

# 安装 Certbot（SSL 证书）
sudo apt install -y certbot python3-certbot-nginx
```

### 2. 安装 Python 依赖

```bash
# 安装 Flask 和 requests
sudo pip3 install flask requests

# 或使用 requirements.txt
sudo pip3 install -r /path/to/requirements.txt
```

### 3. 部署 GitHub 代理服务

```bash
# 创建目录
sudo mkdir -p /opt/github-proxy
cd /opt/github-proxy

# 复制代理脚本
sudo cp /path/to/guangzhou-github-proxy.py /opt/github-proxy/app.py

# 设置权限
sudo chown -R www-data:www-data /opt/github-proxy
sudo chmod +x /opt/github-proxy/app.py
```

### 4. 创建 systemd 服务

```bash
# 复制 systemd 服务文件
sudo cp /path/to/guangzhou-github-proxy.service /etc/systemd/system/github-proxy.service

# 重载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start github-proxy

# 设置开机自启
sudo systemctl enable github-proxy

# 查看状态
sudo systemctl status github-proxy

# 查看日志
sudo journalctl -u github-proxy -f
```

### 5. 配置 Nginx

```bash
# 复制 Nginx 配置
sudo cp /path/to/nginx-guangzhou.conf.example /etc/nginx/sites-enabled/violetteam.conf

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 6. 申请 SSL 证书

```bash
# 为 violetteam.cloud 申请证书
sudo certbot --nginx -d violetteam.cloud

# 验证证书
sudo certbot certificates

# 设置自动续期（已自动配置）
sudo certbot renew --dry-run
```

### 7. 配置防火墙

```bash
# 启用防火墙
sudo ufw enable

# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 查看状态
sudo ufw status
```

---

## 🔧 配置说明

### GitHub 代理服务配置

服务文件位置: `/etc/systemd/system/github-proxy.service`

**代理设置**:
```ini
Environment="HTTP_PROXY=http://127.0.0.1:8118"
Environment="HTTPS_PROXY=http://127.0.0.1:8118"
```

如果使用 Shadowsocks 本地代理，请根据实际端口修改。

常见代理配置:
- Privoxy: `http://127.0.0.1:8118`
- Shadowsocks (SOCKS5): `socks5://127.0.0.1:1080`
- HTTP 代理: `http://127.0.0.1:PORT`

### Nginx 路由配置

```nginx
# GitHub 代理
location /ghproxy/ {
    proxy_pass http://127.0.0.1:18080/;
    # ... 其他配置
}

# Docker Registry 镜像
location /v2/ {
    proxy_pass https://mirror.ccs.tencentyun.com;
    # ... 其他配置
}
```

---

## ✅ 功能测试

### 1. 测试 GitHub 代理服务

```bash
# 检查服务状态
curl http://localhost:18080/status

# 测试文件下载
curl -L "http://localhost:18080/download?url=https://github.com/ollama/ollama/releases/download/v0.1.0/ollama-linux-amd64" -o test.bin

# 通过 Nginx 测试
curl -I https://violetteam.cloud/ghproxy/download?url=https://github.com/test/test
```

### 2. 测试 Docker Registry

```bash
# 搜索镜像
curl https://violetteam.cloud/v2/_catalog

# 测试拉取（在客户端）
docker pull violetteam.cloud/library/nginx:latest
```

### 3. 测试前端页面

```bash
# 访问主页
curl -I https://violetteam.cloud/

# 测试健康检查
curl https://violetteam.cloud/health
```

---

## 📊 监控和维护

### 查看服务日志

```bash
# GitHub 代理服务日志
sudo journalctl -u github-proxy -f

# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 重启服务

```bash
# 重启 GitHub 代理
sudo systemctl restart github-proxy

# 重新加载 Nginx
sudo systemctl reload nginx

# 重启 Nginx
sudo systemctl restart nginx
```

### 性能优化

**使用 Gunicorn（推荐）**:

```bash
# 安装 Gunicorn
sudo pip3 install gunicorn

# 修改 systemd 服务
sudo nano /etc/systemd/system/github-proxy.service

# 修改 ExecStart 为:
ExecStart=/usr/local/bin/gunicorn -w 4 -b 0.0.0.0:18080 app:app

# 重启服务
sudo systemctl daemon-reload
sudo systemctl restart github-proxy
```

---

## 🔒 安全建议

### 1. 限制访问

```nginx
# 在 Nginx 配置中添加 IP 白名单（可选）
location /ghproxy/ {
    allow 1.2.3.4;  # 允许特定 IP
    deny all;       # 拒绝其他
    # ...
}
```

### 2. 配置速率限制

```nginx
# 在 http 块中添加
limit_req_zone $binary_remote_addr zone=ghproxy:10m rate=10r/s;

# 在 location 中应用
location /ghproxy/ {
    limit_req zone=ghproxy burst=20;
    # ...
}
```

### 3. 日志轮转

```bash
# 安装 logrotate（通常已安装）
sudo apt install logrotate

# 配置日志轮转
sudo nano /etc/logrotate.d/github-proxy

# 添加配置:
/var/log/github-proxy/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

---

## 🔄 更新和维护

### 更新代理服务

```bash
# 备份现有代码
sudo cp /opt/github-proxy/app.py /opt/github-proxy/app.py.bak

# 更新代码
sudo cp new_app.py /opt/github-proxy/app.py

# 重启服务
sudo systemctl restart github-proxy

# 查看日志确认
sudo journalctl -u github-proxy -n 50
```

### 更新 Nginx 配置

```bash
# 备份配置
sudo cp /etc/nginx/sites-enabled/violetteam.conf /etc/nginx/sites-enabled/violetteam.conf.bak

# 更新配置
sudo nano /etc/nginx/sites-enabled/violetteam.conf

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## 🐛 故障排查

### GitHub 代理服务无法启动

```bash
# 查看详细日志
sudo journalctl -u github-proxy -n 100 --no-pager

# 检查端口占用
sudo lsof -i :18080

# 手动启动测试
cd /opt/github-proxy
sudo -u www-data python3 app.py
```

### 下载失败或超时

```bash
# 检查代理配置
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 测试代理连接
curl --proxy http://127.0.0.1:8118 https://github.com

# 检查防火墙
sudo ufw status
```

### Nginx 502 错误

```bash
# 检查 GitHub 代理服务状态
sudo systemctl status github-proxy

# 检查 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 检查连接
curl http://127.0.0.1:18080/status
```

---

## 📦 备份

### 备份脚本

```bash
#!/bin/bash
# 备份广州服务器

BACKUP_DIR="/backup/violetteam"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份项目文件
tar -czf $BACKUP_DIR/violetteam_files_$DATE.tar.gz /var/www/violetteam/

# 备份 GitHub 代理
tar -czf $BACKUP_DIR/github_proxy_$DATE.tar.gz /opt/github-proxy/

# 备份 Nginx 配置
cp /etc/nginx/sites-enabled/violetteam.conf $BACKUP_DIR/nginx_$DATE.conf

# 备份 SSL 证书
sudo tar -czf $BACKUP_DIR/ssl_$DATE.tar.gz /etc/letsencrypt/

echo "备份完成: $BACKUP_DIR"
```

---

## 📞 联系支持

如有问题，请联系:
- **QQ**: 1494458927

---

**最后更新**: 2025-12-19

