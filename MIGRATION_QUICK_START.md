# 服务器迁移快速指南

本文档提供快速迁移操作指南。

## 📚 文档索引

- **[完整部署文档](DEPLOYMENT.md)** - 详细的部署步骤和配置说明
- **[双服务器迁移](TWO_SERVER_MIGRATION.md)** - 香港+广州双服务器迁移方案
- **[迁移检查清单](MIGRATION_CHECKLIST.md)** - 迁移前后的完整检查清单
- **本文档** - 快速迁移操作指南

---

## ⚡ 5分钟快速开始

### 方式 A: 一键迁移（推荐）

适用于有经验的用户，自动化完成整个迁移流程。

```bash
cd /var/www/mirror/scripts
bash migrate-all.sh
```

按照交互式提示完成操作即可。

### 方式 B: 分步迁移

适用于需要精细控制的场景。

#### 1. 在旧服务器备份

```bash
cd /var/www/mirror/scripts

# 香港服务器 (Mirror 主站)
bash migrate-backup.sh hk

# 或广州服务器 (VioletTeam)
bash migrate-backup.sh gz
```

备份文件将保存在 `~/mirror_backup_*` 目录。

#### 2. 传输到新服务器

```bash
# 打包备份
cd ~
tar -czf mirror_backup.tar.gz mirror_backup_*/

# 传输到新服务器
scp mirror_backup.tar.gz user@new-server:/tmp/

# 在新服务器解压
ssh user@new-server
cd /tmp
tar -xzf mirror_backup.tar.gz
```

#### 3. 在新服务器恢复

```bash
# 确保新服务器已安装基础软件
cd /var/www/mirror/scripts
sudo bash deploy.sh

# 恢复数据
sudo bash migrate-restore.sh hk /tmp/mirror_backup_hk_*
# 或
sudo bash migrate-restore.sh gz /tmp/mirror_backup_gz_*
```

#### 4. 验证迁移

```bash
bash migrate-verify.sh hk
# 或
bash migrate-verify.sh gz
```

#### 5. 更新 DNS

将域名 A 记录指向新服务器 IP。

---

## 📋 脚本说明

### 迁移脚本

| 脚本 | 功能 | 使用场景 |
|------|------|----------|
| `migrate-all.sh` | 一键完整迁移 | 自动化迁移，交互式配置 |
| `migrate-backup.sh` | 备份旧服务器 | 手动分步迁移第1步 |
| `migrate-restore.sh` | 恢复到新服务器 | 手动分步迁移第2步 |
| `migrate-verify.sh` | 验证迁移结果 | 测试新服务器功能 |

### 部署脚本

| 脚本 | 功能 | 使用场景 |
|------|------|----------|
| `deploy.sh` | 一键部署环境 | 新服务器初始化 |
| `deploy_hk.sh` | 部署香港服务器 | 香港服务器环境 |
| `deploy_gz.sh` | 部署广州服务器 | 广州服务器环境 |
| `backup.sh` | 定时备份 | 日常数据备份 |
| `restore.sh` | 恢复备份 | 数据恢复 |

---

## 🎯 常见场景

### 场景 1: 单服务器迁移

**需求**: 将香港服务器迁移到新香港服务器

**步骤**:
```bash
# 一键迁移
cd /var/www/mirror/scripts
bash migrate-all.sh
# 选择: 1) 香港服务器迁移
```

### 场景 2: 双服务器迁移

**需求**: 同时迁移香港和广州两台服务器

**步骤**:
```bash
# 方案 A: 保持独立架构（推荐）
bash migrate-all.sh
# 选择: 3) 双服务器完整迁移

# 方案 B: 合并到单服务器
bash migrate-all.sh
# 选择: 4) 合并到单服务器
```

### 场景 3: 仅备份（不迁移）

**需求**: 定期备份数据，不进行迁移

**步骤**:
```bash
bash migrate-all.sh
# 选择: 5) 仅备份
```

### 场景 4: 从已有备份恢复

**需求**: 使用之前的备份文件恢复

**步骤**:
```bash
bash migrate-all.sh
# 选择: 6) 仅恢复
# 输入备份目录路径
```

---

## ⏱️ 时间估算

| 操作 | 预计时间 | 说明 |
|------|---------|------|
| 备份数据库 (1GB) | 2-5 分钟 | 取决于数据库大小 |
| 备份项目文件 | 1-2 分钟 | 约 100MB |
| 传输备份 | 5-30 分钟 | 取决于网络速度 |
| 安装基础软件 | 5-10 分钟 | 首次部署需要 |
| 恢复数据 | 3-10 分钟 | 取决于数据量 |
| DNS 传播 | 5-30 分钟 | 不可控 |
| **总计** | **20-90 分钟** | 不含 DNS 传播 |

---

## ✅ 迁移检查清单

### 迁移前 (旧服务器)

- [ ] 确认服务运行正常
- [ ] 备份数据库
- [ ] 备份项目文件
- [ ] 备份环境变量 (.env)
- [ ] 备份 Nginx 配置
- [ ] 备份 SSL 证书 (可选)
- [ ] 记录当前配置 (数据库密码、JWT密钥等)
- [ ] 降低 DNS TTL (提前24小时)

### 迁移中 (新服务器)

- [ ] 服务器基础配置 (SSH、防火墙)
- [ ] 安装基础软件 (Node.js、MySQL、Nginx等)
- [ ] 上传备份文件
- [ ] 恢复项目文件
- [ ] 恢复数据库
- [ ] 恢复配置文件
- [ ] 修改环境变量 (如有变化)
- [ ] 安装依赖 (npm install)
- [ ] 启动服务 (PM2、Nginx)

### 迁移后 (验证)

- [ ] 测试 API 接口 (`/api/health`)
- [ ] 测试前端页面
- [ ] 测试数据库连接
- [ ] 测试 Redis 连接
- [ ] 测试代理功能 (GitHub、Docker)
- [ ] 测试用户登录
- [ ] 更新 DNS 记录
- [ ] 申请 SSL 证书 (如需要)
- [ ] 等待 DNS 传播
- [ ] 浏览器测试全部功能
- [ ] 监控服务日志 (24小时)
- [ ] 保持旧服务器运行 (7天备份)

---

## 🚨 故障排查

### 问题 1: 备份脚本失败

**症状**: `mysqldump: command not found`

**解决**:
```bash
sudo apt install mysql-client
```

### 问题 2: 恢复后 API 无法启动

**症状**: PM2 显示 `error` 状态

**解决**:
```bash
# 查看错误日志
pm2 logs mirror-api --lines 50

# 常见原因:
# 1. .env 文件配置错误
nano /var/www/mirror/api/.env

# 2. 数据库连接失败
mysql -u mirror -p mirror -e "SELECT 1;"

# 3. 端口被占用
sudo lsof -i :3000
```

### 问题 3: Nginx 配置测试失败

**症状**: `nginx: [emerg] cannot load certificate`

**解决**:
```bash
# SSL 证书路径错误，重新申请
sudo certbot --nginx -d your-domain.com

# 或临时使用 HTTP
# 修改 Nginx 配置，注释掉 SSL 相关行
sudo nano /etc/nginx/sites-enabled/mirror.conf
```

### 问题 4: 数据库导入失败

**症状**: `ERROR 1045: Access denied`

**解决**:
```bash
# 重新创建数据库用户
sudo mysql
CREATE USER 'mirror'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON mirror.* TO 'mirror'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 问题 5: DNS 未生效

**症状**: 域名仍解析到旧 IP

**解决**:
```bash
# 检查 DNS 解析
dig your-domain.com
nslookup your-domain.com

# 清除本地 DNS 缓存
# Ubuntu/Debian
sudo systemd-resolve --flush-caches

# macOS
sudo dscacheutil -flushcache

# Windows
ipconfig /flushdns
```

---

## 📞 获取帮助

### 在线文档

- [完整部署文档](DEPLOYMENT.md)
- [双服务器迁移](TWO_SERVER_MIGRATION.md)
- [迁移检查清单](MIGRATION_CHECKLIST.md)
- [短信接码集成](SMS_INTEGRATION.md)
- [管理员 SMS 管理](ADMIN_SMS_GUIDE.md)

### 技术支持

- **QQ**: 1494458927
- **项目地址**: https://github.com/violettoolssite/twoProxy

### 常见问题

1. **迁移需要多长时间?**
   - 单服务器: 30-60分钟 (不含DNS传播)
   - 双服务器: 60-120分钟

2. **迁移过程中服务会中断吗?**
   - 会。DNS 切换后有 5-30 分钟传播时间
   - 建议在低峰期进行迁移

3. **可以先测试再切换 DNS 吗?**
   - 可以。修改本地 hosts 文件测试
   ```bash
   # Linux/macOS: /etc/hosts
   # Windows: C:\Windows\System32\drivers\etc\hosts
   NEW_SERVER_IP your-domain.com
   ```

4. **旧服务器何时可以关闭?**
   - 建议保持运行 7 天
   - 确认新服务器稳定后再关闭

5. **备份文件可以保留多久?**
   - 建议至少保留 30 天
   - 重要数据建议异地备份

---

## 🎓 进阶技巧

### 1. 自动化定时备份

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点自动备份
0 2 * * * /var/www/mirror/scripts/migrate-backup.sh hk >> /var/log/mirror-backup.log 2>&1
```

### 2. 备份到远程服务器

```bash
# 备份并自动上传到远程服务器
bash migrate-backup.sh hk
cd ~
tar -czf mirror_backup.tar.gz mirror_backup_hk_*/
scp mirror_backup.tar.gz backup-server:/backups/
```

### 3. 使用 rsync 增量同步

```bash
# 实时同步项目文件（适合双活部署）
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '*.log' \
  /var/www/mirror/ user@backup-server:/var/www/mirror/
```

### 4. 数据库主从复制

适用于高可用场景，参考 MySQL 官方文档配置主从复制。

### 5. 零停机迁移

1. 配置双活负载均衡
2. 先迁移从服务器
3. 切换流量到新服务器
4. 再迁移主服务器

---

## 📊 迁移成功标准

迁移完成后，以下指标应全部通过：

- [x] 所有服务运行正常 (绿色 `online` 状态)
- [x] API 接口返回正常 (HTTP 200)
- [x] 数据库连接正常
- [x] 前端页面可访问
- [x] 用户可以正常登录
- [x] 代理功能正常 (GitHub、Docker)
- [x] SSL 证书有效
- [x] DNS 解析正确
- [x] 日志无错误信息
- [x] 性能正常 (响应时间 < 1s)

---

**最后更新**: 2025-12-20

**版本**: v1.0

