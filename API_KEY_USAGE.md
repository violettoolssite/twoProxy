# API Key 使用说明

## 📋 当前状态

API Key 功能已实现，但目前**尚未启用**。API Key 认证中间件已开发完成，但还没有实际的路由使用它。

## 🔧 已实现的功能

### 1. API Key 管理

- ✅ **获取 API Key**：`GET /api/user/api-key`
- ✅ **刷新 API Key**：`POST /api/user/api-key/refresh`
- ✅ **API Key 认证中间件**：`authenticateApiKey`

### 2. 认证机制

- ✅ 支持 Header 方式：`X-API-Key: your-api-key`
- ✅ 支持 Query 参数：`?api_key=your-api-key`
- ✅ Redis 缓存用户信息（5分钟）
- ✅ API 调用限制检查（如果配置了 `api_daily_limit`）

## 💡 计划中的用途

API Key 可以用于以下场景：

### 1. 程序化访问加速服务

```bash
# 使用 API Key 访问加速服务
curl -H "X-API-Key: your-api-key" \
  "https://mirror.yljdteam.com/api/accelerate?url=https://example.com/file.zip"
```

### 2. 自动化脚本集成

```python
import requests

api_key = "your-api-key"
headers = {"X-API-Key": api_key}

# 生成加速地址
response = requests.get(
    "https://mirror.yljdteam.com/api/download/generate",
    headers=headers,
    params={"url": "https://github.com/user/repo/releases/download/v1.0.0/app.zip"}
)
```

### 3. CI/CD 集成

```yaml
# GitHub Actions 示例
- name: Download via Mirror
  run: |
    curl -H "X-API-Key: ${{ secrets.MIRROR_API_KEY }}" \
      "https://mirror.yljdteam.com/api/download/generate?url=${{ env.DOWNLOAD_URL }}"
```

### 4. 流量统计 API

```bash
# 获取流量统计
curl -H "X-API-Key: your-api-key" \
  "https://mirror.yljdteam.com/api/user/traffic/stats"
```

## 🚀 建议添加的功能

### 1. 文件加速 API

```javascript
// POST /api/download/generate
// 使用 API Key 生成加速地址
{
  "url": "https://example.com/file.zip"
}
// 返回: { "acceleratedUrl": "https://mirror.yljdteam.com/file/..." }
```

### 2. GitHub 搜索 API

```javascript
// GET /api/github/search?q=keyword&page=1
// 使用 API Key 搜索 GitHub 仓库
```

### 3. Docker 镜像搜索 API

```javascript
// GET /api/docker/search?q=keyword&page=1
// 使用 API Key 搜索 Docker 镜像
```

### 4. 流量统计 API

```javascript
// GET /api/user/traffic/stats
// 使用 API Key 获取流量统计
```

### 5. 短信接码 API

```javascript
// POST /api/sms/get-phone
// 使用 API Key 获取手机号（替代 JWT Token）
```

## 📝 当前限制

1. **未启用**：API Key 认证中间件已实现，但没有路由使用它
2. **无文档**：缺少 API 使用文档和示例
3. **无限制**：如果启用，需要配置 API 调用限制

## 🔄 启用步骤

如果需要启用 API Key 功能，需要：

1. **创建 API 路由**
   ```javascript
   // api/src/routes/api.js
   const { authenticateApiKey } = require('../middleware/auth');
   
   router.get('/download/generate', authenticateApiKey, async (req, res) => {
     // 生成加速地址的逻辑
   });
   ```

2. **注册路由**
   ```javascript
   // api/src/app.js
   const apiRoutes = require('./routes/api');
   app.use('/api/v1', apiRoutes);
   ```

3. **更新文档**
   - 添加 API 使用文档
   - 提供代码示例
   - 说明认证方式

## 💬 用户提示

在用户中心页面，当前显示：
> "API Key 用于程序调用，请妥善保管，不要泄露给他人"

但实际上 API Key 目前**还不能使用**。建议：

1. **暂时隐藏**：如果暂时不启用，可以隐藏 API Key 部分
2. **更新提示**：说明"功能开发中"或"即将推出"
3. **启用功能**：实现上述建议的功能，让 API Key 真正可用

---

**最后更新**: 2025-12-20  
**状态**: API Key 功能已实现但未启用

