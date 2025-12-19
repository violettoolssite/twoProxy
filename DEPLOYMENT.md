# 服务器迁移部署文档

本文档提供完整的服务器迁移指南，确保 Mirror 加速站能够快速在新服务器上部署。

## 📋 目录

- [系统要求](#系统要求)
- [依赖软件](#依赖软件)
- [部署步骤](#部署步骤)
- [配置清单](#配置清单)
- [数据迁移](#数据迁移)
- [验证测试](#验证测试)
- [常见问题](#常见问题)

---

## 系统要求

- **操作系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **CPU**: 2核心以上
- **内存**: 2GB 以上
- **磁盘**: 20GB 以上
- **网络**: 公网 IP，支持 80/443 端口

---

## 依赖软件

### 必需软件

| 软件 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 18.0.0 | 后端 API 运行环境 |
| npm | >= 9.0.0 | Node.js 包管理器 |
| MySQL | >= 8.0 | 数据库 |
| Nginx | >= 1.18 | Web 服务器和反向代理 |
| Redis | >= 6.0 | 缓存和会话存储 |
| PM2 | 最新版 | Node.js 进程管理器 |
| Certbot | 最新版 | SSL 证书管理 |

### 可选软件

| 软件 | 用途 |
|------|------|
| Git | 代码版本控制 |
| UFW | 防火墙管理 |

---

## 部署步骤

### 1. 准备新服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git vim ufw
```

### 2. 安装 Node.js

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载环境
source ~/.bashrc

# 安装 Node.js 18
nvm install 18
nvm use 18
nvm alias default 18

# 验证安装
node --version  # 应显示 v18.x.x
npm --version   # 应显示 9.x.x
```

### 3. 安装 MySQL

```bash
# 安装 MySQL Server
sudo apt install -y mysql-server

# 启动 MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置
sudo mysql_secure_installation
```

**创建数据库和用户：**

```sql
-- 登录 MySQL
sudo mysql

-- 创建数据库
CREATE DATABASE mirror CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（请修改密码）
CREATE USER 'mirror'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';

-- 授予权限
GRANT ALL PRIVILEGES ON mirror.* TO 'mirror'@'localhost';
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

### 4. 安装 Redis

```bash
# 安装 Redis
sudo apt install -y redis-server

# 启动 Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 验证
redis-cli ping  # 应返回 PONG
```

### 5. 安装 Nginx

```bash
# 安装 Nginx
sudo apt install -y nginx

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证
sudo nginx -t
```

### 6. 安装 PM2

```bash
# 全局安装 PM2
npm install -g pm2

# 设置开机自启
pm2 startup
# 按照提示执行命令
```

### 7. 安装 Certbot（SSL 证书）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 验证
certbot --version
```

### 8. 部署项目文件

```bash
# 创建项目目录
sudo mkdir -p /var/www/mirror
sudo chown -R $USER:$USER /var/www/mirror

# 上传项目文件（使用以下方式之一）
# 方式1: 使用 Git
cd /var/www/mirror
git clone <your-repo-url> .

# 方式2: 使用 rsync 从旧服务器同步
# rsync -avz -e ssh user@old-server:/var/www/mirror/ /var/www/mirror/

# 方式3: 使用 scp 上传压缩包
# scp mirror.tar.gz user@new-server:/tmp/
# cd /var/www/mirror
# tar -xzf /tmp/mirror.tar.gz
```

### 9. 配置后端 API

```bash
cd /var/www/mirror/api

# 安装依赖
npm install --production

# 创建环境变量文件
cat > .env << 'EOF'
# 环境配置
NODE_ENV=production
PORT=3000

# JWT 密钥（请生成随机字符串）
JWT_SECRET=CHANGE_THIS_TO_RANDOM_STRING

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=mirror
DB_PASSWORD=YOUR_STRONG_PASSWORD
DB_NAME=mirror

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 邮件配置（可选）
SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASS=YOUR_EMAIL_PASSWORD
SMTP_FROM=noreply@example.com

# 域名配置
DOMAIN=mirror.yljdteam.com
BASE_URL=https://mirror.yljdteam.com

# 支付配置（可选）
PAYJS_MCHID=
PAYJS_KEY=
PAYJS_NOTIFY_URL=
EOF

# 生成随机 JWT_SECRET
JWT_SECRET=$(openssl rand -base64 32)
sed -i "s/CHANGE_THIS_TO_RANDOM_STRING/$JWT_SECRET/" .env

# 修改数据库密码（替换为实际密码）
nano .env
```

### 10. 初始化数据库

```bash
cd /var/www/mirror/api

# 运行数据库初始化脚本
npm run init-db

# 验证表是否创建成功
mysql -u mirror -p mirror -e "SHOW TABLES;"
```

### 11. 配置 Nginx

```bash
# 备份默认配置
sudo cp /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.bak

# 复制项目配置
sudo cp /etc/nginx/sites-enabled/mirror.conf /etc/nginx/sites-enabled/mirror.conf.bak
sudo nano /etc/nginx/sites-enabled/mirror.conf

# 修改配置中的域名
# 将 mirror.yljdteam.com 替换为你的域名

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 12. 申请 SSL 证书

```bash
# 为主域名申请证书
sudo certbot --nginx -d mirror.yljdteam.com

# 为通配符子域名申请证书（需要 DNS 验证）
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.mirror.yljdteam.com" -d "mirror.yljdteam.com"

# 按照提示添加 DNS TXT 记录

# 设置自动续期
sudo certbot renew --dry-run
```

### 13. 启动后端 API

```bash
cd /var/www/mirror/api

# 使用 PM2 启动
pm2 start src/app.js --name mirror-api

# 保存 PM2 配置
pm2 save

# 查看日志
pm2 logs mirror-api

# 查看状态
pm2 status
```

### 14. 配置防火墙

```bash
# 启用 UFW
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

## 配置清单

### 必须修改的配置项

#### 1. 后端 API 环境变量 (`/var/www/mirror/api/.env`)

- `JWT_SECRET`: JWT 密钥
- `DB_PASSWORD`: MySQL 密码
- `DOMAIN`: 你的域名
- `BASE_URL`: 完整的网站 URL

#### 2. Nginx 配置 (`/etc/nginx/sites-enabled/mirror.conf`)

- `server_name`: 替换为你的域名
- `ssl_certificate`: SSL 证书路径
- `ssl_certificate_key`: SSL 私钥路径

#### 3. 前端配置 (`/var/www/mirror/js/app.js`)

- 如果域名变更，需要修改 API 请求的基础 URL

### 可选配置项

#### 邮件服务

如果需要发送邮件（忘记密码等功能），需配置 SMTP：

```env
SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASS=YOUR_EMAIL_PASSWORD
SMTP_FROM=noreply@example.com
```

#### 支付服务

如果需要支付功能，需配置 PayJS 或其他支付平台：

```env
PAYJS_MCHID=你的商户号
PAYJS_KEY=你的密钥
PAYJS_NOTIFY_URL=https://your-domain.com/api/payment/callback
```

---

## 数据迁移

### 导出旧服务器数据

```bash
# 在旧服务器上执行

# 1. 导出 MySQL 数据库
mysqldump -u mirror -p mirror > mirror_backup_$(date +%Y%m%d).sql

# 2. 打包项目文件
cd /var/www
tar -czf mirror_files_$(date +%Y%m%d).tar.gz mirror/

# 3. 打包 Nginx 配置
tar -czf nginx_config_$(date +%Y%m%d).tar.gz /etc/nginx/sites-enabled/mirror.conf

# 4. 导出 PM2 配置
pm2 save
tar -czf pm2_config_$(date +%Y%m%d).tar.gz ~/.pm2/
```

### 导入到新服务器

```bash
# 在新服务器上执行

# 1. 上传备份文件
# scp user@old-server:~/mirror_backup_*.sql .
# scp user@old-server:~/mirror_files_*.tar.gz .

# 2. 导入 MySQL 数据库
mysql -u mirror -p mirror < mirror_backup_*.sql

# 3. 解压项目文件
cd /var/www
sudo tar -xzf ~/mirror_files_*.tar.gz

# 4. 恢复 Nginx 配置
sudo tar -xzf ~/nginx_config_*.tar.gz -C /

# 5. 恢复 PM2 配置
tar -xzf ~/pm2_config_*.tar.gz -C ~/
pm2 resurrect
```

---

## 验证测试

### 1. 检查服务状态

```bash
# 检查 Nginx
sudo systemctl status nginx
sudo nginx -t

# 检查 MySQL
sudo systemctl status mysql
mysql -u mirror -p -e "SELECT 1;"

# 检查 Redis
sudo systemctl status redis-server
redis-cli ping

# 检查 PM2
pm2 status
pm2 logs mirror-api --lines 50
```

### 2. 测试 API 接口

```bash
# 健康检查
curl https://your-domain.com/api/health

# 测试注册（可选）
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}'
```

### 3. 测试前端页面

```bash
# 访问主页
curl -I https://your-domain.com/

# 访问用户中心
curl -I https://your-domain.com/user/

# 访问管理后台
curl -I https://your-domain.com/admin/
```

### 4. 测试代理功能

```bash
# 测试 GitHub 代理
curl -I https://your-domain.com/gh/search/repositories?q=test

# 测试 Docker Hub 搜索
curl https://your-domain.com/v2/search/?query=nginx

# 测试文件下载代理
curl -I https://your-domain.com/file/https/example.com/test.txt
```

---

## 常见问题

### 1. Nginx 启动失败

**问题**: `nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)`

**解决**:
```bash
# 查看占用端口的进程
sudo lsof -i :80
sudo lsof -i :443

# 停止占用进程或修改 Nginx 端口
```

### 2. MySQL 连接失败

**问题**: `ER_ACCESS_DENIED_ERROR: Access denied for user 'mirror'@'localhost'`

**解决**:
```bash
# 重新设置用户权限
sudo mysql
GRANT ALL PRIVILEGES ON mirror.* TO 'mirror'@'localhost';
FLUSH PRIVILEGES;
```

### 3. PM2 进程异常退出

**问题**: API 服务频繁重启

**解决**:
```bash
# 查看详细日志
pm2 logs mirror-api --lines 100

# 检查环境变量
cd /var/www/mirror/api
cat .env

# 检查数据库连接
mysql -u mirror -p mirror -e "SELECT 1;"
```

### 4. SSL 证书申请失败

**问题**: Certbot 验证失败

**解决**:
```bash
# 确保域名已正确解析到服务器 IP
dig your-domain.com

# 确保 80 端口开放
sudo ufw allow 80/tcp

# 检查 Nginx 配置
sudo nginx -t

# 重新申请
sudo certbot --nginx -d your-domain.com
```

### 5. 跨域问题

**问题**: 前端请求 API 出现 CORS 错误

**解决**:
```bash
# 检查后端 CORS 配置
cd /var/www/mirror/api
nano src/app.js

# 确保 origin 包含你的域名
# 重启 API
pm2 restart mirror-api
```

---

## 性能优化建议

### 1. Nginx 优化

```nginx
# 在 /etc/nginx/nginx.conf 中添加
worker_processes auto;
worker_connections 4096;

# 启用 gzip 压缩
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

# 启用缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;
```

### 2. MySQL 优化

```sql
-- 在 /etc/mysql/mysql.conf.d/mysqld.cnf 中添加
[mysqld]
innodb_buffer_pool_size = 1G
max_connections = 200
query_cache_size = 64M
```

### 3. Redis 优化

```bash
# 在 /etc/redis/redis.conf 中修改
maxmemory 512mb
maxmemory-policy allkeys-lru
```

### 4. Node.js 优化

```bash
# 使用 PM2 集群模式
pm2 start src/app.js --name mirror-api -i max

# 启用监控
pm2 install pm2-logrotate
```

---

## 备份策略

### 自动备份脚本

创建 `/root/backup-mirror.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backup/mirror"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u mirror -p'YOUR_PASSWORD' mirror > $BACKUP_DIR/db_$DATE.sql

# 备份项目文件
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/mirror

# 备份 Nginx 配置
tar -czf $BACKUP_DIR/nginx_$DATE.tar.gz /etc/nginx/sites-enabled/mirror.conf

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

设置定时任务：

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点执行备份
0 2 * * * /root/backup-mirror.sh >> /var/log/mirror-backup.log 2>&1
```

---

## 监控建议

### 1. 使用 PM2 监控

```bash
# 安装 PM2 监控模块
pm2 install pm2-server-monit

# 查看实时监控
pm2 monit
```

### 2. 使用 Nginx 日志分析

```bash
# 实时查看访问日志
tail -f /var/log/nginx/access.log

# 分析错误日志
tail -f /var/log/nginx/error.log
```

### 3. 使用系统监控工具

```bash
# 安装 htop
sudo apt install htop

# 查看系统资源
htop
```

---

## 联系与支持

如有问题，请联系：

- **QQ**: 1494458927
- **项目地址**: https://github.com/your-repo

---

**最后更新**: 2025-12-19

