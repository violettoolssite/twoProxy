# 脚本使用说明

本目录包含项目的所有自动化脚本。

## 📂 脚本分类

### 🚀 部署脚本

| 脚本 | 功能 | 使用场景 |
|------|------|----------|
| `deploy.sh` | 一键部署环境 | 新服务器初始化（香港） |
| `deploy_hk.sh` | 香港服务器专用部署 | 香港服务器环境配置 |
| `deploy_gz.sh` | 广州服务器专用部署 | 广州服务器环境配置 |

**使用示例**:
```bash
# 香港服务器部署
sudo bash deploy.sh

# 广州服务器部署
sudo bash deploy_gz.sh
```

### 🔄 迁移脚本

| 脚本 | 功能 | 使用场景 |
|------|------|----------|
| `migrate-all.sh` | **一键迁移（推荐）** | 自动化完整迁移流程 |
| `migrate-backup.sh` | 备份旧服务器 | 手动迁移 - 第1步 |
| `migrate-restore.sh` | 恢复到新服务器 | 手动迁移 - 第2步 |
| `migrate-verify.sh` | 验证迁移结果 | 迁移后测试 |

**使用示例**:
```bash
# 方式1: 一键迁移（推荐）
bash migrate-all.sh

# 方式2: 分步迁移
bash migrate-backup.sh hk              # 备份香港服务器
bash migrate-restore.sh hk /backup/dir # 恢复到新服务器
bash migrate-verify.sh hk              # 验证迁移结果
```

### 💾 备份脚本

| 脚本 | 功能 | 使用场景 |
|------|------|----------|
| `backup.sh` | 定期数据备份 | 日常数据保护 |
| `restore.sh` | 恢复备份数据 | 数据恢复 |

**使用示例**:
```bash
# 手动备份
sudo bash backup.sh

# 恢复数据
sudo bash restore.sh /path/to/backup
```

### 🛠️ 工具脚本

| 脚本 | 功能 | 使用场景 |
|------|------|----------|
| `setup-github-ssh.sh` | 配置 GitHub SSH | Git 推送配置 |
| `add-sms-config.sh` | 添加 SMS 配置 | 短信接码功能配置 |

**使用示例**:
```bash
# 配置 GitHub SSH
bash setup-github-ssh.sh

# 添加 SMS 配置
bash add-sms-config.sh
```

---

## 🎯 快速导航

### 新服务器部署
👉 使用 `deploy.sh` 或参考 [DEPLOYMENT.md](../DEPLOYMENT.md)

### 服务器迁移
👉 使用 `migrate-all.sh` 或参考 [MIGRATION_QUICK_START.md](../MIGRATION_QUICK_START.md)

### 数据备份
👉 使用 `backup.sh` 或配置自动备份（见下文）

---

## 💡 使用技巧

### 1. 定时自动备份

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点自动备份
0 2 * * * /var/www/mirror/scripts/backup.sh >> /var/log/mirror-backup.log 2>&1
```

### 2. 备份到远程服务器

```bash
# 备份并自动上传
bash backup.sh
scp /path/to/backup.tar.gz user@remote:/backups/
```

### 3. 迁移脚本的交互模式

`migrate-all.sh` 提供交互式向导，支持以下模式：

1. **香港服务器迁移** - 迁移 Mirror 主站
2. **广州服务器迁移** - 迁移 VioletTeam 加速节点
3. **双服务器完整迁移** - 同时迁移两台服务器（保持独立）
4. **合并到单服务器** - 将两台服务器合并到一台
5. **仅备份** - 只备份不迁移
6. **仅恢复** - 使用已有备份恢复

### 4. 验证脚本测试项

`migrate-verify.sh` 会执行以下测试：

**香港服务器（18项测试）**:
- 系统服务（Node.js, MySQL, Redis, Nginx, PM2）
- 项目文件（目录、环境变量、依赖）
- API 接口（健康检查、前端、GitHub、Docker）
- 数据库连接（MySQL, Redis）
- SSL 证书
- 系统资源（磁盘、内存）

**广州服务器（14项测试）**:
- 系统服务（Python, Nginx, GitHub Proxy）
- 项目文件（前端、Python 脚本、配置）
- API 接口（健康检查、GitHub 代理、Docker Registry）
- SSL 证书
- 系统资源（磁盘、内存）

---

## ⚠️ 注意事项

### 运行权限

- 部署脚本需要 `sudo` 权限
- 迁移脚本部分操作需要 `sudo`
- 备份脚本建议使用 `sudo` 确保完整备份

### 脚本执行

```bash
# 确保脚本有执行权限
chmod +x script-name.sh

# 执行脚本
bash script-name.sh
# 或
./script-name.sh
```

### 安全建议

1. **备份文件保护**: 备份文件包含敏感信息（数据库密码、JWT密钥等），请妥善保管
2. **SSL 证书**: 迁移 SSL 证书需要 root 权限，建议在新服务器重新申请
3. **环境变量**: 迁移后检查 `.env` 文件，确保配置正确
4. **防火墙**: 新服务器记得配置防火墙规则

---

## 🐛 故障排查

### 问题 1: 脚本执行失败

```bash
# 检查脚本权限
ls -l script-name.sh

# 添加执行权限
chmod +x script-name.sh
```

### 问题 2: MySQL 连接失败

```bash
# 检查 MySQL 服务
sudo systemctl status mysql

# 测试数据库连接
mysql -u mirror -p mirror -e "SELECT 1;"
```

### 问题 3: Nginx 配置错误

```bash
# 测试配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

### 问题 4: PM2 服务异常

```bash
# 查看 PM2 日志
pm2 logs mirror-api --lines 100

# 重启服务
pm2 restart mirror-api
```

---

## 📚 相关文档

- [DEPLOYMENT.md](../DEPLOYMENT.md) - 完整部署文档
- [MIGRATION_QUICK_START.md](../MIGRATION_QUICK_START.md) - 快速迁移指南
- [TWO_SERVER_MIGRATION.md](../TWO_SERVER_MIGRATION.md) - 双服务器迁移
- [MIGRATION_CHECKLIST.md](../MIGRATION_CHECKLIST.md) - 迁移检查清单

---

## 📞 技术支持

如有问题，请联系：
- **QQ**: 1494458927
- **项目地址**: https://github.com/violettoolssite/twoProxy

---

**最后更新**: 2025-12-20

