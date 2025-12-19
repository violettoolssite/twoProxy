# 双服务器迁移指南

本文档提供香港服务器（Mirror 加速站）和广州服务器（VioletTeam）的完整迁移方案。

## 📋 服务器架构

### 香港服务器 (mirror.yljdteam.com)
- **功能**: Mirror 加速站主站
- **域名**: mirror.yljdteam.com, *.mirror.yljdteam.com, ai.yljdteam.com
- **服务**:
  - 前端静态页面
  - 后端 API (Node.js, 端口 3000)
  - GitHub API 代理
  - Docker Hub 代理
  - 文件下载加速
  - 临时邮箱服务
  - 用户系统和管理后台
- **数据库**: MySQL (mirror)
- **配置文件**: `/etc/nginx/sites-enabled/mirror.conf`

### 广州服务器 (violetteam.cloud)
- **功能**: GitHub 文件加速 + Docker Registry 镜像
- **域名**: violetteam.cloud
- **服务**:
  - 前端静态页面 (SPA)
  - 后端 API (端口 4000)
  - GitHub 代理 (Python, 端口 18080)
  - Docker Registry 镜像（腾讯云）
- **配置文件**: `/etc/nginx/sites-enabled/violetteam.conf`

---

## 🎯 迁移策略

### 方案 A: 独立迁移（推荐）
将两台服务器分别迁移到新服务器，保持独立架构。

**优点**:
- 服务隔离，互不影响
- 故障域分离
- 便于独立扩展

**缺点**:
- 需要两台新服务器
- 管理成本稍高

### 方案 B: 合并迁移
将两台服务器的功能合并到一台新服务器。

**优点**:
- 节省服务器成本
- 统一管理

**缺点**:
- 单点故障风险
- 资源竞争
- 配置复杂

---

## 🚀 方案 A: 独立迁移（推荐）

### 阶段 1: 香港服务器迁移

#### 1.1 备份现有数据

```bash
# 在旧香港服务器执行
cd /var/www/mirror

# 备份项目文件
tar -czf ~/mirror_hk_files_$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='*.log' \
  --exclude='.git' \
  /var/www/mirror/

# 备份数据库
mysqldump -u mirror -p mirror | gzip > ~/mirror_hk_db_$(date +%Y%m%d).sql.gz

# 备份 Nginx 配置
cp /etc/nginx/sites-enabled/mirror.conf ~/mirror_hk_nginx_$(date +%Y%m%d).conf

# 备份 SSL 证书
sudo tar -czf ~/mirror_hk_ssl_$(date +%Y%m%d).tar.gz /etc/letsencrypt/

# 备份环境变量
cp /var/www/mirror/api/.env ~/mirror_hk_env_$(date +%Y%m%d).bak
```

#### 1.2 部署到新香港服务器

```bash
# 上传文件到新服务器
scp mirror_hk_files_*.tar.gz root@NEW_HK_SERVER:/tmp/
scp mirror_hk_db_*.sql.gz root@NEW_HK_SERVER:/tmp/
scp mirror_hk_nginx_*.conf root@NEW_HK_SERVER:/tmp/
scp mirror_hk_ssl_*.tar.gz root@NEW_HK_SERVER:/tmp/
scp mirror_hk_env_*.bak root@NEW_HK_SERVER:/tmp/

# 在新服务器上执行
ssh root@NEW_HK_SERVER

# 解压项目文件
mkdir -p /var/www
cd /var/www
tar -xzf /tmp/mirror_hk_files_*.tar.gz

# 运行部署脚本
cd /var/www/mirror
bash scripts/deploy.sh

# 导入数据库
gunzip < /tmp/mirror_hk_db_*.sql.gz | mysql -u mirror -p mirror

# 恢复 SSL 证书
sudo tar -xzf /tmp/mirror_hk_ssl_*.tar.gz -C /

# 恢复 Nginx 配置
sudo cp /tmp/mirror_hk_nginx_*.conf /etc/nginx/sites-enabled/mirror.conf

# 恢复环境变量
cp /tmp/mirror_hk_env_*.bak /var/www/mirror/api/.env

# 重启服务
pm2 restart mirror-api
sudo nginx -t && sudo systemctl reload nginx
```

#### 1.3 DNS 切换

```bash
# 更新 A 记录
# mirror.yljdteam.com → 新香港服务器 IP
# *.mirror.yljdteam.com → 新香港服务器 IP
# ai.yljdteam.com → 新香港服务器 IP
```

### 阶段 2: 广州服务器迁移

#### 2.1 备份现有数据

```bash
# 在旧广州服务器执行

# 备份项目文件
tar -czf ~/violetteam_gz_files_$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='*.log' \
  --exclude='.git' \
  --exclude='__pycache__' \
  /var/www/violetteam/

# 备份 Python 代理服务
tar -czf ~/violetteam_gz_ghproxy_$(date +%Y%m%d).tar.gz /opt/github-proxy/

# 备份 Nginx 配置
cp /etc/nginx/sites-enabled/violetteam.conf ~/violetteam_gz_nginx_$(date +%Y%m%d).conf

# 备份 SSL 证书
sudo tar -czf ~/violetteam_gz_ssl_$(date +%Y%m%d).tar.gz /etc/letsencrypt/

# 备份数据库（如有）
# mysqldump -u violetteam -p violetteam | gzip > ~/violetteam_gz_db_$(date +%Y%m%d).sql.gz

# 备份环境变量（如有）
# cp /var/www/violetteam/.env ~/violetteam_gz_env_$(date +%Y%m%d).bak
```

#### 2.2 部署到新广州服务器

```bash
# 上传文件到新服务器
scp violetteam_gz_*.tar.gz root@NEW_GZ_SERVER:/tmp/
scp violetteam_gz_nginx_*.conf root@NEW_GZ_SERVER:/tmp/

# 在新服务器上执行
ssh root@NEW_GZ_SERVER

# 安装基础软件
apt update && apt upgrade -y
apt install -y nginx python3 python3-pip certbot python3-certbot-nginx

# 安装 Python 依赖
pip3 install flask requests

# 解压项目文件
mkdir -p /var/www
cd /var/www
tar -xzf /tmp/violetteam_gz_files_*.tar.gz

# 解压 GitHub 代理服务
mkdir -p /opt/github-proxy
cd /opt/github-proxy
tar -xzf /tmp/violetteam_gz_ghproxy_*.tar.gz --strip-components=3

# 恢复 SSL 证书
sudo tar -xzf /tmp/violetteam_gz_ssl_*.tar.gz -C /

# 恢复 Nginx 配置
sudo cp /tmp/violetteam_gz_nginx_*.conf /etc/nginx/sites-enabled/violetteam.conf

# 测试 Nginx 配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx

# 创建 systemd 服务（GitHub 代理）
sudo tee /etc/systemd/system/github-proxy.service > /dev/null <<EOF
[Unit]
Description=GitHub Proxy Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/github-proxy
ExecStart=/usr/bin/python3 /opt/github-proxy/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable github-proxy
sudo systemctl start github-proxy

# 检查服务状态
sudo systemctl status github-proxy
```

#### 2.3 DNS 切换

```bash
# 更新 A 记录
# violetteam.cloud → 新广州服务器 IP
```

---

## 🔄 方案 B: 合并迁移

如果选择将两台服务器合并到一台新服务器：

### 架构设计

```
新服务器 (combined-server)
├── 端口 80/443 (Nginx)
│   ├── mirror.yljdteam.com → /var/www/mirror
│   ├── *.mirror.yljdteam.com → /var/www/mirror
│   ├── ai.yljdteam.com → /var/www/mirror
│   └── violetteam.cloud → /var/www/violetteam
├── 端口 3000 (Mirror API - Node.js)
├── 端口 4000 (VioletTeam API - Node.js)
├── 端口 18080 (GitHub Proxy - Python)
├── MySQL (mirror 数据库)
└── Redis
```

### 合并 Nginx 配置

创建 `/etc/nginx/sites-enabled/combined.conf`:

```nginx
# ==================== Mirror 加速站 (香港) ====================

server {
    listen 443 ssl http2;
    server_name mirror.yljdteam.com ai.yljdteam.com ~^(?<subdomain>[^.]+)\.mirror\.yljdteam\.com$;

    root /var/www/mirror;
    index index.html;
    client_max_body_size 0;

    # SSL 证书（Mirror）
    ssl_certificate     /etc/letsencrypt/live/mirror.yljdteam.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mirror.yljdteam.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Mirror 配置（省略，使用现有配置）
    # ... (完整配置见 /etc/nginx/sites-enabled/mirror.conf)
}

# ==================== VioletTeam (广州) ====================

server {
    listen 80;
    server_name violetteam.cloud;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name violetteam.cloud;

    # SSL 证书（VioletTeam）
    ssl_certificate     /etc/letsencrypt/live/violetteam.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/violetteam.cloud/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # 安全相关 HTTP 头
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # 前端静态资源
    root /var/www/violetteam/dist;
    index index.html;

    # SPA 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 后端 API 反代（注意端口 4000）
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Docker Registry 镜像加速
    location /v2/ {
        proxy_pass https://mirror.ccs.tencentyun.com;
        proxy_set_header Host mirror.ccs.tencentyun.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # GitHub 代理
    location /ghproxy/ {
        access_log off;
        proxy_pass http://127.0.0.1:18080/;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_buffering off;
        proxy_request_buffering off;

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # 健康检查接口
    location /health {
        return 200 'VioletTeam Proxy\nStatus: OK\n';
        add_header Content-Type text/plain;
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_vary on;
}
```

### 合并部署步骤

```bash
# 1. 备份两台旧服务器（见方案 A）

# 2. 在新服务器上部署 Mirror
cd /var/www/mirror
bash scripts/deploy.sh

# 3. 部署 VioletTeam
mkdir -p /var/www/violetteam
cd /var/www/violetteam
tar -xzf /tmp/violetteam_gz_files_*.tar.gz --strip-components=2

# 4. 部署 GitHub 代理
mkdir -p /opt/github-proxy
cd /opt/github-proxy
tar -xzf /tmp/violetteam_gz_ghproxy_*.tar.gz --strip-components=3

# 5. 启动所有服务
pm2 start /var/www/mirror/api/src/app.js --name mirror-api
pm2 start /var/www/violetteam/api/src/app.js --name violetteam-api
pm2 save

sudo systemctl start github-proxy

# 6. 配置 Nginx
sudo cp combined.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 7. 申请 SSL 证书
sudo certbot --nginx -d mirror.yljdteam.com
sudo certbot --nginx -d violetteam.cloud
```

---

## ⚠️ 注意事项

### 1. 端口冲突
- Mirror API: 端口 3000
- VioletTeam API: 端口 4000
- GitHub Proxy: 端口 18080

确保端口不冲突。

### 2. SSL 证书
两个域名需要分别申请证书：
```bash
sudo certbot --nginx -d mirror.yljdteam.com -d *.mirror.yljdteam.com
sudo certbot --nginx -d violetteam.cloud
```

### 3. DNS 配置
确保两个域名都正确解析到新服务器。

### 4. 防火墙配置
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
```

### 5. 性能监控
合并服务器后需要特别关注：
- CPU 使用率
- 内存使用率
- 磁盘 I/O
- 网络带宽

建议服务器配置至少：
- CPU: 4核心
- 内存: 4GB
- 磁盘: 40GB SSD

---

## 📊 迁移对比

| 项目 | 方案 A (独立) | 方案 B (合并) |
|------|--------------|--------------|
| 服务器数量 | 2 台 | 1 台 |
| 月成本 | 较高 | 较低 |
| 可靠性 | 高（故障隔离） | 中（单点故障） |
| 扩展性 | 好 | 一般 |
| 管理复杂度 | 中 | 低 |
| 迁移难度 | 中 | 高 |
| 推荐度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 🔧 迁移后验证

### 香港服务器（Mirror）
```bash
# 1. 测试主页
curl -I https://mirror.yljdteam.com/

# 2. 测试 API
curl https://mirror.yljdteam.com/api/health

# 3. 测试 GitHub 代理
curl https://mirror.yljdteam.com/gh/search/repositories?q=test

# 4. 测试 Docker Hub
curl https://mirror.yljdteam.com/v2/search/?query=nginx

# 5. 测试临时邮箱
# 访问 https://mirror.yljdteam.com/#/email
```

### 广州服务器（VioletTeam）
```bash
# 1. 测试主页
curl -I https://violetteam.cloud/

# 2. 测试 API（如有）
curl https://violetteam.cloud/api/health

# 3. 测试 GitHub 代理
curl -I https://violetteam.cloud/ghproxy/github.com/test/test

# 4. 测试 Docker Registry
curl https://violetteam.cloud/v2/_catalog

# 5. 测试健康检查
curl https://violetteam.cloud/health
```

---

## 📝 迁移检查清单

### 香港服务器
- [ ] 备份项目文件
- [ ] 备份数据库
- [ ] 备份 Nginx 配置
- [ ] 备份 SSL 证书
- [ ] 备份环境变量
- [ ] 部署到新服务器
- [ ] 导入数据库
- [ ] 恢复配置
- [ ] 启动服务
- [ ] 更新 DNS
- [ ] 功能测试
- [ ] 性能监控

### 广州服务器
- [ ] 备份项目文件
- [ ] 备份 Python 代理服务
- [ ] 备份 Nginx 配置
- [ ] 备份 SSL 证书
- [ ] 部署到新服务器
- [ ] 恢复配置
- [ ] 启动服务
- [ ] 更新 DNS
- [ ] 功能测试
- [ ] 性能监控

---

## 📞 技术支持

如有问题，请联系：
- **QQ**: 1494458927

---

**最后更新**: 2025-12-19

