# CDN 边缘加速配置指南

本文档说明如何为 Mirror 加速站配置 CDN 边缘加速，提升全球访问速度。

## 📋 目录

- [CDN 加速方案](#cdn-加速方案)
- [Cloudflare CDN 配置](#cloudflare-cdn-配置)
- [腾讯云 CDN 配置](#腾讯云-cdn-配置)
- [阿里云 CDN 配置](#阿里云-cdn-配置)
- [注意事项](#注意事项)
- [性能优化建议](#性能优化建议)

---

## 🎯 CDN 加速方案

### 可以 CDN 加速的资源

| 资源类型 | 路径 | 缓存策略 | 说明 |
|---------|------|---------|------|
| **静态 CSS** | `/css/*` | 7天 | 样式文件，更新频率低 |
| **静态 JS** | `/js/*` | 7天 | JavaScript 文件，带版本号 |
| **图片资源** | `/favicon.*`, `/api/pay.jpg`, `/api/alipay.jpg` | 30天 | 图标和收款码 |
| **静态 HTML** | `/index.html`, `/user/index.html`, `/admin/index.html` | 1小时 | 主页面，需要短缓存 |
| **Manifest** | `/manifest.json` | 1天 | PWA 配置 |
| **Sponsors JSON** | `/sponsors.json` | 1小时 | 感谢名单数据 |

### 不能 CDN 加速的资源

| 资源类型 | 路径 | 原因 |
|---------|------|------|
| **API 请求** | `/api/*` | 需要实时处理，包含认证和数据库操作 |
| **用户中心** | `/user/*` | 需要认证，动态内容 |
| **管理后台** | `/admin/*` | 需要认证，动态内容 |
| **代理请求** | `/gh/*`, `/v2/*`, `/file/*` | 需要实时代理，动态内容 |

---

## ☁️ Cloudflare CDN 配置

### 方案 A: 使用 Cloudflare Pages（推荐静态资源）

适合：纯静态资源加速

**步骤**：

1. **准备静态资源**
   ```bash
   # 创建静态资源目录
   mkdir -p /var/www/mirror-static
   cp -r /var/www/mirror/css /var/www/mirror-static/
   cp -r /var/www/mirror/js /var/www/mirror-static/
   cp /var/www/mirror/favicon.* /var/www/mirror-static/
   cp /var/www/mirror/manifest.json /var/www/mirror-static/
   ```

2. **配置 Cloudflare Pages**
   - 登录 Cloudflare Dashboard
   - 进入 Pages → Create a project
   - 连接 GitHub 仓库或直接上传
   - 设置构建命令：无需构建（静态文件）
   - 设置输出目录：`/var/www/mirror-static`

3. **自定义域名**
   - 添加自定义域名：`static.mirror.yljdteam.com`
   - 配置 DNS 记录（自动完成）

4. **修改 HTML 引用**
   ```html
   <!-- 原引用 -->
   <link rel="stylesheet" href="./css/style.css?v=20250118" />
   <script src="./js/app.js?v=20250156"></script>
   
   <!-- CDN 引用 -->
   <link rel="stylesheet" href="https://static.mirror.yljdteam.com/css/style.css?v=20250118" />
   <script src="https://static.mirror.yljdteam.com/js/app.js?v=20250156"></script>
   ```

### 方案 B: 使用 Cloudflare CDN（全站加速）

适合：整个站点加速，包括动态内容

**步骤**：

1. **添加域名到 Cloudflare**
   - 登录 Cloudflare Dashboard
   - 添加站点：`mirror.yljdteam.com`
   - 按照提示修改 DNS 记录

2. **配置缓存规则**

   在 Cloudflare Dashboard → Rules → Page Rules 中添加：

   **规则 1: 静态资源长期缓存**
   ```
   URL: mirror.yljdteam.com/css/*
   设置：
   - Cache Level: Cache Everything
   - Edge Cache TTL: 7 days
   - Browser Cache TTL: 7 days
   ```

   **规则 2: JavaScript 文件**
   ```
   URL: mirror.yljdteam.com/js/*
   设置：
   - Cache Level: Cache Everything
   - Edge Cache TTL: 7 days
   - Browser Cache TTL: 7 days
   ```

   **规则 3: API 请求不缓存**
   ```
   URL: mirror.yljdteam.com/api/*
   设置：
   - Cache Level: Bypass
   - Disable Performance
   ```

   **规则 4: 代理请求不缓存**
   ```
   URL: mirror.yljdteam.com/gh/* OR mirror.yljdteam.com/v2/* OR mirror.yljdteam.com/file/*
   设置：
   - Cache Level: Bypass
   ```

3. **配置 SSL/TLS**
   - SSL/TLS 模式：Full (strict)
   - 自动 HTTPS 重定向：开启

4. **性能优化**
   - Auto Minify: 开启（CSS、JS、HTML）
   - Brotli 压缩：开启
   - HTTP/2: 开启
   - HTTP/3 (QUIC): 开启

---

## 🟢 腾讯云 CDN 配置

### 1. 创建 CDN 加速域名

1. 登录腾讯云控制台
2. 进入 CDN → 域名管理 → 添加域名
3. 配置信息：
   - **加速域名**: `mirror.yljdteam.com`
   - **源站类型**: 源站域名
   - **源站地址**: `mirror.yljdteam.com`（或源站 IP）
   - **加速区域**: 全球

### 2. 配置缓存规则

在 **缓存配置** → **节点缓存过期配置** 中添加：

| 文件类型 | 路径 | 缓存时间 |
|---------|------|---------|
| CSS | `/css/*` | 7天 |
| JS | `/js/*` | 7天 |
| 图片 | `*.jpg, *.png, *.svg, *.ico` | 30天 |
| HTML | `*.html` | 1小时 |
| API | `/api/*` | 不缓存 |

### 3. 配置回源规则

在 **回源配置** → **回源 Host** 中设置：
- 回源 Host: `mirror.yljdteam.com`

### 4. 配置 HTTPS

- 开启 HTTPS 加速
- 配置 SSL 证书（自动申请或上传已有证书）
- 开启 HTTP/2
- 开启强制跳转 HTTPS

---

## 🟡 阿里云 CDN 配置

### 1. 添加加速域名

1. 登录阿里云控制台
2. 进入 CDN → 域名管理 → 添加域名
3. 配置信息：
   - **加速域名**: `mirror.yljdteam.com`
   - **业务类型**: 全站加速
   - **源站信息**: 源站域名或 IP
   - **加速区域**: 全球

### 2. 配置缓存规则

在 **缓存配置** → **缓存过期时间** 中添加：

```
/css/*          → 7天
/js/*           → 7天
*.jpg, *.png    → 30天
*.html          → 1小时
/api/*          → 不缓存
```

### 3. 配置 HTTPS

- 开启 HTTPS 安全加速
- 配置 SSL 证书
- 开启 HTTP/2

---

## ⚠️ 注意事项

### 1. API 请求处理

**问题**: API 请求不能缓存，需要实时处理

**解决方案**:
- 在 CDN 规则中明确设置 `/api/*` 路径不缓存
- 使用 `Cache-Control: no-store, no-cache` 响应头
- 确保 API 请求直接回源到服务器

### 2. 认证和会话

**问题**: 用户登录状态需要保持

**解决方案**:
- Cookie 设置 `SameSite=None; Secure`
- 确保认证相关的 Cookie 不被 CDN 缓存
- API 请求携带认证 Token（JWT），不依赖 Cookie

### 3. 动态内容

**问题**: 代理请求（GitHub、Docker）需要实时处理

**解决方案**:
- `/gh/*`, `/v2/*`, `/file/*` 路径设置为不缓存
- 这些请求必须回源到服务器

### 4. 版本控制

**问题**: 静态资源更新后，CDN 可能仍返回旧版本

**解决方案**:
- 使用版本号参数：`style.css?v=20250118`
- 更新版本号后，CDN 会自动获取新版本
- 或者使用文件哈希：`style.abc123.css`

### 5. CORS 跨域

**问题**: 如果静态资源使用不同域名，可能遇到 CORS 问题

**解决方案**:
- 在 CDN 配置中添加 CORS 响应头
- 或者在源站 Nginx 配置 CORS

---

## 🚀 性能优化建议

### 1. 静态资源优化

```bash
# 压缩 CSS 和 JS
npm install -g clean-css-cli uglify-js
cleancss -o css/style.min.css css/style.css
uglifyjs js/app.js -o js/app.min.js -c -m
```

### 2. 图片优化

```bash
# 使用 WebP 格式
# 压缩图片大小
# 使用响应式图片
```

### 3. HTTP/2 和 HTTP/3

- 确保 CDN 支持 HTTP/2
- 如果支持，开启 HTTP/3 (QUIC)
- 提升多资源加载速度

### 4. 预加载关键资源

在 HTML 中添加：
```html
<link rel="preload" href="/css/style.css" as="style">
<link rel="preload" href="/js/app.js" as="script">
```

### 5. 使用 Service Worker（PWA）

```javascript
// 在 app.js 中添加 Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

---

## 📊 CDN 效果对比

### 不使用 CDN

- **首屏加载**: 500-1000ms（取决于用户地理位置）
- **静态资源**: 从源站加载，速度较慢
- **全球访问**: 差异较大

### 使用 CDN

- **首屏加载**: 100-300ms（边缘节点）
- **静态资源**: 从最近节点加载，速度快
- **全球访问**: 速度稳定，差异小

### 预期提升

- **静态资源加载速度**: 提升 50-80%
- **首屏渲染时间**: 减少 30-50%
- **全球访问体验**: 显著改善

---

## 🔧 实施步骤

### 阶段 1: 准备（1小时）

1. [ ] 选择 CDN 服务商（Cloudflare/腾讯云/阿里云）
2. [ ] 准备域名和 SSL 证书
3. [ ] 备份现有配置

### 阶段 2: 配置 CDN（2-4小时）

1. [ ] 添加域名到 CDN
2. [ ] 配置 DNS 记录
3. [ ] 配置缓存规则
4. [ ] 配置 HTTPS
5. [ ] 测试 CDN 加速效果

### 阶段 3: 优化（1-2小时）

1. [ ] 压缩静态资源
2. [ ] 优化图片
3. [ ] 配置预加载
4. [ ] 监控性能指标

### 阶段 4: 验证（1小时）

1. [ ] 测试静态资源加载
2. [ ] 测试 API 请求（确保不缓存）
3. [ ] 测试用户登录功能
4. [ ] 测试代理功能
5. [ ] 全球访问测试

---

## 📝 配置示例

### Cloudflare Workers（高级用法）

如果需要更精细的控制，可以使用 Cloudflare Workers：

```javascript
// worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 静态资源：从 Cloudflare 缓存获取
  if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
    return fetch(request, {
      cf: {
        cacheEverything: true,
        cacheTtl: 604800 // 7天
      }
    });
  }
  
  // API 请求：直接回源
  if (url.pathname.startsWith('/api/')) {
    return fetch(request, {
      cf: {
        cacheEverything: false
      }
    });
  }
  
  // 其他请求：默认处理
  return fetch(request);
}
```

---

## 🎯 推荐方案

### 方案 1: Cloudflare CDN（推荐）

**优点**:
- ✅ 免费套餐功能强大
- ✅ 全球节点多，速度快
- ✅ 配置简单
- ✅ 已在使用 Cloudflare（临时邮箱）

**缺点**:
- ⚠️ 免费套餐有流量限制
- ⚠️ 国内访问可能较慢

### 方案 2: 腾讯云 CDN

**优点**:
- ✅ 国内访问速度快
- ✅ 与腾讯云服务器配合好
- ✅ 价格合理

**缺点**:
- ⚠️ 需要付费
- ⚠️ 海外节点较少

### 方案 3: 混合方案（最佳）

**静态资源**: Cloudflare Pages（免费，全球加速）  
**动态内容**: 腾讯云 CDN（国内加速）  
**API 请求**: 直接回源到服务器

---

## 📞 技术支持

如有问题，请联系：
- **QQ**: 1494458927
- **项目地址**: https://github.com/violettoolssite/twoProxy

---

**最后更新**: 2025-12-20

