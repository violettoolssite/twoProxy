# 服务器迁移检查清单

## 📋 迁移前准备

### 1. 旧服务器数据备份

- [ ] 备份 MySQL 数据库
  ```bash
  mysqldump -u mirror -p mirror > mirror_backup_$(date +%Y%m%d).sql
  ```

- [ ] 备份项目文件
  ```bash
  cd /var/www
  tar -czf mirror_files_$(date +%Y%m%d).tar.gz mirror/
  ```

- [ ] 备份 Nginx 配置
  ```bash
  cp /etc/nginx/sites-enabled/mirror.conf ~/mirror_nginx_$(date +%Y%m%d).conf
  ```

- [ ] 备份 SSL 证书
  ```bash
  tar -czf ssl_certs_$(date +%Y%m%d).tar.gz /etc/letsencrypt/
  ```

- [ ] 备份环境变量
  ```bash
  cp /var/www/mirror/api/.env ~/mirror_env_$(date +%Y%m%d).bak
  ```

- [ ] 导出 PM2 配置
  ```bash
  pm2 save
  tar -czf pm2_config_$(date +%Y%m%d).tar.gz ~/.pm2/
  ```

- [ ] 记录当前配置信息
  - [ ] 域名和 DNS 配置
  - [ ] 数据库用户名和密码
  - [ ] JWT Secret
  - [ ] SMTP 配置（如有）
  - [ ] 支付配置（如有）
  - [ ] Cloudflare Worker 配置（临时邮箱）

### 2. 新服务器准备

- [ ] 购买/准备新服务器
  - [ ] CPU: 2核心以上
  - [ ] 内存: 2GB 以上
  - [ ] 磁盘: 20GB 以上
  - [ ] 系统: Ubuntu 20.04+ / Debian 11+

- [ ] 记录新服务器信息
  - [ ] IP 地址: _______________
  - [ ] SSH 端口: _______________
  - [ ] Root 密码: _______________

- [ ] 配置 SSH 密钥登录（推荐）
  ```bash
  ssh-copy-id root@NEW_SERVER_IP
  ```

### 3. DNS 准备

- [ ] 记录当前 DNS 配置
  - [ ] A 记录: mirror.yljdteam.com → 旧服务器 IP
  - [ ] A 记录: *.mirror.yljdteam.com → 旧服务器 IP
  - [ ] 其他相关记录

- [ ] 降低 DNS TTL（提前 24-48 小时）
  - [ ] 将 TTL 从 3600 降低到 300（5分钟）

---

## 🚀 迁移执行

### 阶段 1: 新服务器部署

- [ ] 连接到新服务器
  ```bash
  ssh root@NEW_SERVER_IP
  ```

- [ ] 上传项目文件
  ```bash
  # 方式1: 使用 rsync（推荐）
  rsync -avz -e ssh /var/www/mirror/ root@NEW_SERVER_IP:/var/www/mirror/
  
  # 方式2: 使用 scp
  scp mirror_files_*.tar.gz root@NEW_SERVER_IP:/tmp/
  ```

- [ ] 运行部署脚本
  ```bash
  cd /var/www/mirror
  sudo bash scripts/deploy.sh
  ```

- [ ] 验证部署脚本输出
  - [ ] Node.js 安装成功
  - [ ] MySQL 安装成功
  - [ ] Redis 安装成功
  - [ ] Nginx 安装成功
  - [ ] PM2 安装成功
  - [ ] 数据库初始化成功

### 阶段 2: 数据迁移

- [ ] 上传数据库备份
  ```bash
  scp mirror_backup_*.sql root@NEW_SERVER_IP:/tmp/
  ```

- [ ] 导入数据库
  ```bash
  mysql -u mirror -p mirror < /tmp/mirror_backup_*.sql
  ```

- [ ] 验证数据导入
  ```bash
  mysql -u mirror -p mirror -e "SELECT COUNT(*) FROM users;"
  ```

- [ ] 恢复环境变量
  ```bash
  # 复制旧服务器的 .env 文件内容
  nano /var/www/mirror/api/.env
  ```

- [ ] 恢复 SSL 证书（如有）
  ```bash
  tar -xzf ssl_certs_*.tar.gz -C /
  ```

### 阶段 3: 服务启动

- [ ] 重启后端 API
  ```bash
  pm2 restart mirror-api
  pm2 save
  ```

- [ ] 检查 PM2 状态
  ```bash
  pm2 status
  pm2 logs mirror-api --lines 50
  ```

- [ ] 重载 Nginx
  ```bash
  sudo nginx -t
  sudo systemctl reload nginx
  ```

### 阶段 4: 功能测试

- [ ] 测试 API 健康检查
  ```bash
  curl http://localhost:3000/api/health
  ```

- [ ] 测试用户登录
  ```bash
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password"}'
  ```

- [ ] 测试前端页面
  ```bash
  curl -I http://localhost/
  ```

- [ ] 测试 GitHub 代理
  ```bash
  curl http://localhost/gh/search/repositories?q=test
  ```

- [ ] 测试 Docker Hub 搜索
  ```bash
  curl http://localhost/v2/search/?query=nginx
  ```

- [ ] 测试临时邮箱功能
  - [ ] 访问 `/#/email` 页面
  - [ ] 生成临时邮箱
  - [ ] 接收测试邮件

### 阶段 5: DNS 切换

- [ ] 更新 DNS 记录
  - [ ] A 记录: mirror.yljdteam.com → 新服务器 IP
  - [ ] A 记录: *.mirror.yljdteam.com → 新服务器 IP

- [ ] 等待 DNS 传播（5-30 分钟）
  ```bash
  # 检查 DNS 解析
  dig mirror.yljdteam.com
  nslookup mirror.yljdteam.com
  ```

- [ ] 从不同地区测试访问
  - [ ] 使用在线 DNS 检查工具
  - [ ] 使用不同网络测试

### 阶段 6: SSL 证书

- [ ] 申请新的 SSL 证书（如未迁移证书）
  ```bash
  sudo certbot --nginx -d mirror.yljdteam.com
  ```

- [ ] 申请通配符证书（如需要）
  ```bash
  sudo certbot certonly --manual --preferred-challenges dns \
    -d "*.mirror.yljdteam.com" -d "mirror.yljdteam.com"
  ```

- [ ] 验证 HTTPS 访问
  ```bash
  curl -I https://mirror.yljdteam.com/
  ```

- [ ] 检查证书有效期
  ```bash
  sudo certbot certificates
  ```

---

## ✅ 迁移后验证

### 1. 功能验证

- [ ] 前端页面正常访问
  - [ ] 主页: https://mirror.yljdteam.com/
  - [ ] GitHub 模块
  - [ ] Docker 模块
  - [ ] 文件下载模块
  - [ ] 临时邮箱模块
  - [ ] 感谢名单页面

- [ ] 用户系统功能
  - [ ] 用户注册
  - [ ] 用户登录
  - [ ] 用户中心
  - [ ] 修改密码
  - [ ] 邀请码功能
  - [ ] 团队成员显示

- [ ] 管理后台功能
  - [ ] 管理员登录
  - [ ] 用户管理
  - [ ] 流量统计
  - [ ] 系统监控

- [ ] 代理功能
  - [ ] GitHub 仓库搜索
  - [ ] GitHub 文件下载
  - [ ] Docker Hub 搜索
  - [ ] Docker 镜像拉取
  - [ ] 通用文件下载加速

- [ ] 临时邮箱功能
  - [ ] 生成临时邮箱
  - [ ] 接收邮件
  - [ ] 查看邮件内容
  - [ ] 复制验证码
  - [ ] 历史邮箱记录
  - [ ] 多域名支持

### 2. 性能验证

- [ ] 页面加载速度
  ```bash
  curl -w "@curl-format.txt" -o /dev/null -s https://mirror.yljdteam.com/
  ```

- [ ] API 响应时间
  ```bash
  time curl http://localhost:3000/api/health
  ```

- [ ] 数据库查询性能
  ```bash
  mysql -u mirror -p mirror -e "SHOW PROCESSLIST;"
  ```

- [ ] 服务器资源使用
  ```bash
  htop
  free -h
  df -h
  ```

### 3. 安全验证

- [ ] 防火墙配置
  ```bash
  sudo ufw status
  ```

- [ ] SSL 证书有效性
  ```bash
  openssl s_client -connect mirror.yljdteam.com:443 -servername mirror.yljdteam.com
  ```

- [ ] 敏感文件权限
  ```bash
  ls -la /var/www/mirror/api/.env
  ls -la /root/mirror-credentials.txt
  ```

- [ ] 数据库访问限制
  ```bash
  mysql -u mirror -h 127.0.0.1 -p -e "SHOW GRANTS;"
  ```

### 4. 监控配置

- [ ] 配置 PM2 监控
  ```bash
  pm2 monit
  ```

- [ ] 配置日志轮转
  ```bash
  pm2 install pm2-logrotate
  ```

- [ ] 配置自动备份
  ```bash
  crontab -e
  # 添加: 0 2 * * * /var/www/mirror/scripts/backup.sh >> /var/log/mirror-backup.log 2>&1
  ```

- [ ] 配置监控告警（可选）
  - [ ] 服务器监控（如 Zabbix, Prometheus）
  - [ ] 网站监控（如 UptimeRobot）
  - [ ] 日志监控（如 ELK Stack）

---

## 🔄 回滚计划

如果迁移出现问题，需要回滚到旧服务器：

- [ ] 保持旧服务器运行（至少 7 天）
- [ ] 记录回滚步骤
  1. [ ] 停止新服务器服务
  2. [ ] 将 DNS 切回旧服务器 IP
  3. [ ] 等待 DNS 传播
  4. [ ] 验证旧服务器访问正常
  5. [ ] 从新服务器导出最新数据（如有新数据）
  6. [ ] 导入到旧服务器

---

## 📝 迁移后清理

### 1. 旧服务器清理（确认新服务器稳定后）

- [ ] 备份旧服务器最终数据
- [ ] 停止旧服务器服务
  ```bash
  pm2 stop all
  sudo systemctl stop nginx
  sudo systemctl stop mysql
  ```

- [ ] 删除敏感数据
  ```bash
  rm -f /var/www/mirror/api/.env
  rm -f /root/mirror-credentials.txt
  ```

- [ ] 取消服务器续费或销毁实例

### 2. DNS 清理

- [ ] 恢复 DNS TTL 到正常值（3600）
- [ ] 删除旧服务器相关记录

### 3. 文档更新

- [ ] 更新部署文档中的 IP 地址
- [ ] 更新监控配置中的服务器信息
- [ ] 更新团队文档中的服务器信息

---

## 📞 应急联系

- **系统管理员**: _______________
- **数据库管理员**: _______________
- **域名服务商**: _______________
- **服务器提供商**: _______________

---

## 📅 迁移时间表

| 时间 | 任务 | 负责人 | 状态 |
|------|------|--------|------|
| 提前 48h | 降低 DNS TTL | | ⬜ |
| 提前 24h | 备份旧服务器数据 | | ⬜ |
| 提前 12h | 部署新服务器 | | ⬜ |
| 提前 6h | 数据迁移和测试 | | ⬜ |
| 迁移时 | DNS 切换 | | ⬜ |
| 迁移后 1h | 功能验证 | | ⬜ |
| 迁移后 24h | 性能监控 | | ⬜ |
| 迁移后 7d | 旧服务器清理 | | ⬜ |

---

**迁移完成日期**: _______________  
**迁移负责人**: _______________  
**验证人**: _______________

