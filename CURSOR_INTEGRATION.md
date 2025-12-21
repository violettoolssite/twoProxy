# YLJD Cursor 一键切换账号功能

## 📋 功能说明

YLJD Cursor 功能允许用户一键创建 Cursor 账号，使用 logincursor.xyz 邮箱自动注册并登录到 Cursor 软件中。

## ✨ 功能特性

- ✅ 自动生成随机邮箱（logincursor.xyz 域名）
- ✅ 自动生成随机用户名和密码
- ✅ 自动注册 Cursor 账号
- ✅ 自动登录并获取访问凭证
- ✅ 提供配置文件下载

## 🚀 使用流程

1. 访问网站，点击导航栏中的 "YLJD Cursor"
2. 点击"一键创建账号"按钮
3. 系统自动生成账号信息并尝试注册
4. 等待登录完成（可能需要邮箱验证）
5. 下载配置文件
6. 在 Cursor 软件中使用配置

## 🔧 技术实现

### 前端

- **页面位置**: `index.html` - `#/cursor` 路由
- **JavaScript**: `js/app.js` - Cursor 相关函数
- **主要函数**:
  - `createCursorAccount()` - 创建账号
  - `waitForCursorLogin()` - 等待登录完成
  - `copyCursorPassword()` - 复制密码
  - `downloadCursorConfig()` - 下载配置文件

### 后端 API

- **路由文件**: `api/src/routes/cursor.js`
- **API 端点**:
  - `POST /api/cursor/create-account` - 创建账号
  - `GET /api/cursor/check-login?email=xxx` - 检查登录状态
  - `POST /api/cursor/download-config` - 下载配置文件

### 账号信息生成

- **邮箱**: 使用 `logincursor.xyz` 域名，随机生成前缀
- **用户名**: 随机组合形容词+名词+数字（如 `swiftdev123`）
- **密码**: 12-16位，包含大小写字母、数字和特殊字符

## ⚠️ 重要配置

### Cursor API 端点

当前代码中使用的 Cursor API 端点需要根据实际情况调整：

```javascript
// api/src/routes/cursor.js
const CURSOR_API_BASE = process.env.CURSOR_API_BASE || 'https://api.cursor.com';
const CURSOR_REGISTER_URL = `${CURSOR_API_BASE}/auth/register`;
const CURSOR_LOGIN_URL = `${CURSOR_API_BASE}/auth/login`;
```

**需要确认**:
1. Cursor 的实际 API 地址
2. 注册接口的请求格式
3. 登录接口的请求格式
4. Token 的返回格式

### 环境变量

可以在 `.env` 文件中设置：

```bash
CURSOR_API_BASE=https://api.cursor.com
```

## 📝 配置文件格式

下载的配置文件为 JSON 格式：

```json
{
  "email": "random@logincursor.xyz",
  "username": "swiftdev123",
  "password": "RandomPass123!@#",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "createdAt": "2025-12-21T04:30:00.000Z",
  "note": "此配置文件由 YLJD Mirror 生成，请妥善保管"
}
```

## 🔐 安全注意事项

1. **账号信息存储**: 账号信息存储在内存中（Map），24小时后自动删除
2. **密码安全**: 生成的密码包含大小写字母、数字和特殊字符
3. **Token 保护**: Token 仅在配置文件中，请妥善保管
4. **使用限制**: 建议添加使用频率限制，防止滥用

## 🐛 已知问题

1. **API 端点**: 需要确认 Cursor 的实际 API 地址
2. **邮箱验证**: 可能需要邮箱验证才能完成登录
3. **错误处理**: 需要根据实际 API 响应调整错误处理逻辑

## 📚 相关文档

- [临时邮箱服务](EMAIL_COMPLIANCE.md)
- [API 文档](api/README.md)

## 🔄 后续优化

1. 使用 Redis 存储账号信息（替代内存 Map）
2. 添加使用频率限制
3. 支持批量创建账号
4. 添加账号管理功能
5. 集成到 Cursor 客户端（浏览器扩展或本地应用）

---

**最后更新**: 2025-12-21

