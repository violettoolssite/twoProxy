# Mirror 加速站 - 后端 API

用户认证、订阅管理、流量统计、支付集成的后端服务。

## 快速开始

### 1. 安装依赖

```bash
cd /var/www/mirror/api
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# 复制示例配置
cp src/config/env.example.js .env

# 编辑配置
nano .env
```

必须配置的项目：
- `JWT_SECRET`: JWT 密钥，使用随机字符串
- `DB_PASSWORD`: MySQL 数据库密码
- `DB_NAME`: 数据库名称

### 3. 初始化数据库

确保 MySQL 已安装并运行，然后执行：

```bash
npm run init-db
```

### 4. 启动服务

开发模式（自动重启）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

### 5. 配置 Nginx

参考 `nginx.conf.example` 配置 Nginx 反向代理。

## API 接口

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| POST | `/api/auth/refresh` | 刷新 Token |
| POST | `/api/auth/change-password` | 修改密码 |

### 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/profile` | 获取用户信息 |
| PUT | `/api/user/profile` | 更新用户信息 |
| POST | `/api/user/subdomain` | 设置子域名 |
| GET | `/api/user/api-key` | 获取 API Key |
| POST | `/api/user/api-key/refresh` | 刷新 API Key |
| GET | `/api/user/traffic/stats` | 获取流量统计 |

### 订阅

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/subscription` | 获取当前订阅 |
| GET | `/api/subscription/plans` | 获取套餐列表 |
| POST | `/api/subscription/upgrade` | 升级套餐 |
| POST | `/api/subscription/toggle-auto-renew` | 切换自动续费 |

### 支付

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/payment/create` | 创建支付 |
| POST | `/api/payment/callback` | 支付回调 |
| GET | `/api/payment/status/:orderNo` | 查询订单状态 |
| GET | `/api/payment/orders` | 获取订单列表 |

### 内部接口（仅本机访问）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/internal/auth` | Nginx auth_request 鉴权 |
| POST | `/api/internal/log` | 记录请求日志 |
| GET | `/api/internal/check-traffic` | 检查用户流量 |

## 套餐配置

在 `src/config/index.js` 中配置套餐：

```javascript
plans: {
  free: {
    name: '免费版',
    price: 0,                                    // 单位：分
    monthlyTrafficBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    bandwidthLimitMbps: 5,                       // 5 Mbps
    concurrentLimit: 5,                          // 5 并发
    apiDailyLimit: 100,                          // 100 次/天
    hasSubdomain: false,                         // 无独立子域名
  },
  // ... 其他套餐
}
```

## 通配符 DNS 配置

在域名注册商添加 A 记录：

| 主机记录 | 记录类型 | 记录值 |
|---------|---------|--------|
| `*.mirror` | A | 服务器 IP |

## 通配符 SSL 证书

使用 acme.sh 获取通配符证书：

```bash
# 安装 acme.sh
curl https://get.acme.sh | sh

# 使用 DNS 验证获取证书（以阿里云为例）
export Ali_Key="your-access-key"
export Ali_Secret="your-access-secret"

acme.sh --issue --dns dns_ali \
  -d "*.mirror.yljdteam.com" \
  -d "mirror.yljdteam.com"

# 安装证书
acme.sh --install-cert -d "*.mirror.yljdteam.com" \
  --key-file /etc/letsencrypt/live/mirror.yljdteam.com/privkey.pem \
  --fullchain-file /etc/letsencrypt/live/mirror.yljdteam.com/fullchain.pem \
  --reloadcmd "systemctl reload nginx"
```

## 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/app.js --name mirror-api

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs mirror-api

# 重启服务
pm2 restart mirror-api
```

## 目录结构

```
api/
├── package.json
├── .env                    # 环境变量（需创建）
├── nginx.conf.example      # Nginx 配置示例
├── README.md
└── src/
    ├── app.js              # 主入口
    ├── config/
    │   ├── index.js        # 配置
    │   └── env.example.js  # 环境变量示例
    ├── lib/
    │   ├── db.js           # MySQL 封装
    │   └── redis.js        # Redis 封装
    ├── middleware/
    │   └── auth.js         # 认证中间件
    ├── routes/
    │   ├── auth.js         # 认证路由
    │   ├── user.js         # 用户路由
    │   ├── subscription.js # 订阅路由
    │   ├── payment.js      # 支付路由
    │   └── internal.js     # 内部接口
    └── scripts/
        └── init-db.js      # 数据库初始化
```

## 支付集成

目前支持 PayJS 支付，配置：

```env
PAYJS_MCHID=你的商户号
PAYJS_KEY=你的密钥
PAYJS_NOTIFY_URL=https://mirror.yljdteam.com/api/payment/callback
```

也可以集成其他支付平台（微信、支付宝官方），修改 `src/routes/payment.js` 即可。

## 安全建议

1. 生产环境务必更换 `JWT_SECRET`
2. 数据库使用强密码
3. 限制 MySQL 只允许本地连接
4. 使用防火墙限制端口访问
5. 定期备份数据库
6. 开启 HTTPS

