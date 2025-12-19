# YLJD Mirror 加速站 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/violettoolssite/twoProxy?style=social)](https://github.com/violettoolssite/twoProxy)

面向国内用户的 **GitHub / Docker / 通用文件加速** 完整解决方案。提供前端界面、后端 API、用户系统、临时邮箱等完整功能。

## 🌐 在线演示

**访问地址**：[https://mirror.yljdteam.com/](https://mirror.yljdteam.com/)

---

## ✨ 功能特性

### 🔧 核心功能

#### GitHub 加速
- ✅ 仓库搜索和浏览
- ✅ 文件下载加速
- ✅ Release 软件包加速
- ✅ Git Clone 镜像加速
- ✅ API 请求代理

#### Docker 加速
- ✅ Docker Hub 镜像代理
- ✅ 镜像搜索功能
- ✅ Registry 认证支持
- ✅ 流量统计和限制

#### 文件下载加速
- ✅ 任意 HTTPS 直链加速
- ✅ 脚本自动改写（如 Ollama 安装脚本）
- ✅ 自动 URL 转换
- ✅ 一键复制加速命令

### 🎯 扩展功能

#### 用户系统
- ✅ 用户注册/登录
- ✅ 邀请码系统
- ✅ 团队成员管理
- ✅ 个人子域名支持
- ✅ API Key 管理

#### 临时邮箱服务
- ✅ 一键生成临时邮箱
- ✅ 实时接收邮件
- ✅ 验证码自动识别
- ✅ 历史邮箱记录
- ✅ 多域名支持（logincursor.xyz 等）
- ✅ 支持 Cursor 注册

#### 管理功能
- ✅ 用户管理后台
- ✅ 流量统计
- ✅ 邀请码管理
- ✅ 感谢名单展示

---

## 📂 项目结构

```
twoProxy/
├── index.html              # 主页（SPA 入口）
├── user/                   # 用户中心
│   ├── index.html         # 用户登录/注册页面
│   └── user.js            # 用户逻辑
├── admin/                  # 管理后台
│   ├── index.html         # 管理员界面
│   └── admin.js           # 管理逻辑
├── css/                    # 样式文件
│   └── style.css          # 玻璃态 UI 风格
├── js/                     # 前端脚本
│   └── app.js             # 主应用逻辑（路由、API）
├── api/                    # 后端 API（Node.js + Express）
│   ├── src/
│   │   ├── app.js         # Express 服务器
│   │   ├── routes/        # API 路由
│   │   ├── config/        # 配置管理
│   │   ├── lib/           # 数据库和 Redis
│   │   └── scripts/       # 数据库初始化
│   └── package.json       # 依赖管理
├── deploy/                 # 部署配置
│   ├── nginx-hongkong.conf.example        # 香港服务器 Nginx
│   ├── nginx-guangzhou.conf.example       # 广州服务器 Nginx
│   ├── guangzhou-github-proxy.py          # GitHub 代理服务
│   ├── guangzhou-github-proxy.service     # systemd 服务
│   ├── guangzhou-requirements.txt         # Python 依赖
│   └── GUANGZHOU_DEPLOYMENT.md            # 广州服务器部署文档
├── scripts/                # 自动化脚本
│   ├── deploy.sh          # 一键部署脚本
│   ├── backup.sh          # 自动备份脚本
│   └── restore.sh         # 数据恢复脚本
├── cloudflare-email-worker.js  # Cloudflare Worker（邮箱服务）
├── sponsors.json.example       # 感谢名单数据示例
├── DEPLOYMENT.md               # 完整部署文档
├── TWO_SERVER_MIGRATION.md     # 双服务器迁移指南
├── MIGRATION_CHECKLIST.md      # 迁移检查清单
└── README.md                   # 项目说明（本文件）
```

---

## 🚀 快速开始

### 方式一：单服务器部署（推荐新手）

```bash
# 1. 克隆仓库
git clone https://github.com/violettoolssite/twoProxy.git
cd twoProxy

# 2. 运行一键部署脚本
sudo bash scripts/deploy.sh

# 3. 按照提示配置域名和 SSL 证书
sudo certbot --nginx -d your-domain.com

# 4. 访问网站
# 打开浏览器访问 https://your-domain.com
```

### 方式二：双服务器部署（推荐生产环境）

适用于需要更高性能和可靠性的场景。

#### 香港服务器（主站）
```bash
git clone https://github.com/violettoolssite/twoProxy.git
cd twoProxy
sudo bash scripts/deploy.sh
```

#### 广州服务器（加速节点）
```bash
git clone https://github.com/violettoolssite/twoProxy.git
cd twoProxy

# 安装 Python 依赖
sudo pip3 install -r deploy/guangzhou-requirements.txt

# 部署 GitHub 代理服务
sudo mkdir -p /opt/github-proxy
sudo cp deploy/guangzhou-github-proxy.py /opt/github-proxy/app.py
sudo cp deploy/guangzhou-github-proxy.service /etc/systemd/system/github-proxy.service

# 启动服务
sudo systemctl daemon-reload
sudo systemctl start github-proxy
sudo systemctl enable github-proxy

# 配置 Nginx
sudo cp deploy/nginx-guangzhou.conf.example /etc/nginx/sites-enabled/violetteam.conf
sudo nginx -t && sudo systemctl reload nginx
```

详细部署步骤请参考：
- 📄 [DEPLOYMENT.md](DEPLOYMENT.md) - 单服务器完整部署文档
- 📄 [TWO_SERVER_MIGRATION.md](TWO_SERVER_MIGRATION.md) - 双服务器部署和迁移指南
- 📄 [GUANGZHOU_DEPLOYMENT.md](deploy/GUANGZHOU_DEPLOYMENT.md) - 广州服务器专用文档

---

## 🏗️ 部署架构

### 单服务器架构
```
服务器 (your-domain.com)
├── Nginx (80/443)
│   ├── 前端静态页面
│   ├── API 反向代理 → 127.0.0.1:3000
│   ├── GitHub 代理
│   ├── Docker Hub 代理
│   └── 文件下载代理
├── Node.js API (3000)
│   ├── 用户认证
│   ├── 流量统计
│   └── 内部接口
├── MySQL
│   └── 用户数据、流量统计
└── Redis
    └── 会话缓存
```

### 双服务器架构（推荐）
```
香港服务器 (mirror.yljdteam.com)
├── 完整的 Mirror 加速站
├── 用户系统和管理后台
├── 临时邮箱服务（Cloudflare Worker）
└── 基础代理功能

广州服务器 (violetteam.cloud)
├── GitHub 文件加速（Python + Flask）
├── Docker Registry 镜像（腾讯云）
└── 专用加速节点
```

优点：
- ✅ **高可用性**：服务隔离，互不影响
- ✅ **高性能**：专用节点，负载分散
- ✅ **易扩展**：可独立扩容
- ✅ **故障隔离**：单点故障不影响整体

---

## 📖 使用说明

### GitHub 加速

#### 方式 1：搜索仓库
1. 访问主页，进入 GitHub 模块
2. 搜索仓库名（如 `ollama`）
3. 点击结果查看加速链接

#### 方式 2：直接转换 URL
```bash
# 原始 GitHub 文件 URL
https://github.com/ollama/ollama/releases/download/v0.1.0/ollama-linux-amd64

# 加速后的 URL
https://mirror.yljdteam.com/file/https/github.com/ollama/ollama/releases/download/v0.1.0/ollama-linux-amd64
```

#### 方式 3：Git Clone 加速
```bash
# 使用镜像站 Clone
git clone https://mirror.yljdteam.com/owner/repo.git
```

### Docker 加速

#### 配置镜像源
```bash
# 编辑 Docker 配置
sudo nano /etc/docker/daemon.json

# 添加镜像源
{
  "registry-mirrors": [
    "https://mirror.yljdteam.com"
  ]
}

# 重启 Docker
sudo systemctl restart docker
```

#### 单次使用
```bash
docker pull mirror.yljdteam.com/library/nginx:latest
```

### 临时邮箱使用

1. 访问 `https://mirror.yljdteam.com/#/email`
2. 点击"生成邮箱"或"随机生成"
3. 使用生成的邮箱地址注册服务
4. 点击"查看邮件"接收邮件
5. 支持自动识别验证码并一键复制

**支持的域名**：
- `logincursor.xyz` - 支持 Cursor 注册 ✅
- `email.logincursor.xyz`
- `vip.logincursor.xyz`
- `qxfy.store`
- `email.qxfy.store`
- `kami666.xyz`
- 等多个域名

---

## ⚙️ 配置说明

### 环境变量配置

复制示例配置文件：
```bash
cp api/src/config/env.example.js api/.env
```

编辑 `.env` 文件，配置以下关键项：

```env
# JWT 密钥（必须修改）
JWT_SECRET=your-random-secret-here

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=mirror
DB_PASSWORD=your-db-password
DB_NAME=mirror

# 域名配置
DOMAIN=mirror.yljdteam.com
BASE_URL=https://mirror.yljdteam.com

# 邮件配置（可选，用于找回密码）
SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_USER=noreply@example.com
SMTP_PASS=your-email-password
```

### Nginx 配置

配置文件位于 `deploy/` 目录：

- `nginx-hongkong.conf.example` - 香港服务器配置
- `nginx-guangzhou.conf.example` - 广州服务器配置

根据实际情况修改：
- `server_name` - 你的域名
- `ssl_certificate` - SSL 证书路径
- `proxy_pass` - 上游服务地址

---

## 🔒 安全建议

1. **修改默认密钥**
   - 生成强随机的 `JWT_SECRET`
   - 使用强密码保护数据库

2. **配置防火墙**
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. **启用 HTTPS**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

4. **限制 API 访问速率**
   - 已内置 rate limiting
   - 可在 Nginx 配置中调整

5. **定期备份**
   ```bash
   # 设置定时任务
   crontab -e
   # 添加: 0 2 * * * /var/www/mirror/scripts/backup.sh
   ```

---

## 🛠️ 开发和调试

### 前端开发

```bash
# 启动简单 HTTP 服务器
python3 -m http.server 8080

# 或使用 Node.js
npx http-server -p 8080
```

### 后端开发

```bash
cd api

# 安装依赖
npm install

# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

### 数据库初始化

```bash
cd api

# 初始化数据库表
npm run init-db
```

---

## 📊 监控和维护

### 查看服务状态

```bash
# PM2 状态
pm2 status

# 查看日志
pm2 logs mirror-api

# Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 性能监控

```bash
# 实时监控
pm2 monit

# 系统资源
htop
```

### 备份和恢复

```bash
# 备份
bash scripts/backup.sh

# 恢复
bash scripts/restore.sh BACKUP_DATE
```

---

## 💖 为爱发电

本项目完全免费开源，采用"为爱发电"模式运营。

### 为什么选择为爱发电？

我们相信：
- 💡 **知识应该自由传播** - 技术不应该被金钱束缚
- 🌍 **互联网应该开放共享** - 每个人都应该平等访问信息
- ❤️ **社区的力量是无穷的** - 你的支持是我们前进的动力

### 项目运营成本

为了维持项目运营，我们每月需要支付：
- 🖥️ **服务器费用**：香港服务器 + 广州服务器（约 ¥300-500/月）
- 🌐 **域名费用**：多个域名续费（约 ¥100-200/年）
- ⚡ **CDN 流量**：Cloudflare 等（约 ¥100-300/月）
- 📧 **邮件服务**：临时邮箱域名和服务（约 ¥50-100/月）
- ⏰ **开发时间**：功能开发、维护、优化（无价）

**月度总成本约：¥600-1000**

### 如何支持我们？

#### 💰 资金支持

如果这个项目帮助了您，欢迎赞助支持：

<table>
  <tr>
    <td align="center">
      <img src="api/pay.jpg" width="200" alt="微信赞赏码"><br>
      <b>微信赞赏</b>
    </td>
    <td align="center">
      <img src="api/alipay.jpg" width="200" alt="支付宝收款码"><br>
      <b>支付宝</b>
    </td>
  </tr>
</table>

**哪怕只有 ¥10，也是对我们最大的鼓励！** 🙏

每一笔赞助都会被用于：
- 服务器续费和升级
- 购买更多域名提供服务
- 开发新功能
- 改进用户体验

#### 🌐 域名赞助

如果您有**闲置域名**愿意免费提供给本站：
- 📧 **邮箱后缀域名**：扩展临时邮箱服务可用域名
- 🚀 **加速节点域名**：提供更多加速入口

**联系方式**：QQ: 1494458927

#### ⭐ 其他支持方式

- **Star 本项目** - 让更多人看到
- **分享给朋友** - 帮助更多人解决问题
- **提交 PR** - 改进代码和文档
- **报告 Bug** - 帮助我们发现问题
- **提出建议** - 告诉我们你的需求

### 感谢名单

所有赞助者都会被记录在 [感谢名单](https://mirror.yljdteam.com/#/sponsors) 中！

访问 `https://mirror.yljdteam.com/#/sponsors` 查看完整名单。

**感谢每一位支持者！你们的支持是我们继续前进的动力！** ❤️

---

## 🤝 贡献指南

欢迎贡献代码、文档或建议！

### 提交 Issue

- 🐛 **Bug 反馈**：详细描述问题和复现步骤
- 💡 **功能建议**：说明需求和使用场景
- 📖 **文档改进**：指出不清楚或错误的地方

### 提交 Pull Request

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用清晰的变量和函数命名
- 添加必要的注释
- 遵循现有代码风格
- 测试你的改动

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

这意味着：
- ✅ 可以自由使用、修改、分发
- ✅ 可以用于商业项目
- ✅ 可以二次开发
- ⚠️ 需要保留版权声明
- ⚠️ 作者不承担任何责任

---

## 🙏 致谢

感谢以下开源项目：

- [Express](https://expressjs.com/) - Node.js Web 框架
- [MySQL](https://www.mysql.com/) - 数据库
- [Redis](https://redis.io/) - 缓存
- [Nginx](https://nginx.org/) - Web 服务器
- [Flask](https://flask.palletsprojects.com/) - Python Web 框架
- [Cloudflare Workers](https://workers.cloudflare.com/) - 边缘计算平台

---

## 📞 联系我们

- **QQ**: 1494458927
- **GitHub Issues**: [提交问题](https://github.com/violettoolssite/twoProxy/issues)
- **GitHub Discussions**: [讨论交流](https://github.com/violettoolssite/twoProxy/discussions)

---

## ⚠️ 免责声明

1. 本项目仅供学习和研究使用
2. 使用本项目产生的任何问题，作者不承担责任
3. 请遵守相关法律法规，合理使用代理服务
4. 请勿用于任何违法用途

---

<div align="center">

**如果这个项目帮助了您，请给一个 ⭐️ Star！**

**如果您愿意支持我们，欢迎[赞助](#-资金支持)！**

Made with ❤️ by YLJD Team

</div>
