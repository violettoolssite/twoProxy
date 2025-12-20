# CDN 缓存清除指南

## 🐛 问题说明

配置 CDN 后，`mirror.violetteam.cloud` 访问时显示错误的页面（GitHub 代理页面），这是因为 CDN 缓存了错误的响应。

## ✅ 已完成的修复

1. ✓ 更新 Nginx 配置，添加 `mirror.violetteam.cloud` 到 `server_name`
2. ✓ 更新 GitHub 代理规则的排除列表
3. ✓ Nginx 配置已重载

## 🔧 清除 CDN 缓存

### Cloudflare CDN

**方法 1: 通过 Dashboard（推荐）**

1. 登录 Cloudflare Dashboard: https://dash.cloudflare.com
2. 选择站点: `mirror.violetteam.cloud` 或相关域名
3. 进入 **Caching** → **Configuration**
4. 点击 **Purge Everything** 清除所有缓存
5. 或者选择 **Custom Purge**，输入要清除的 URL

**方法 2: 通过 API**

```bash
# 需要 Cloudflare API Token
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### 腾讯云 CDN

1. 登录腾讯云控制台: https://console.cloud.tencent.com
2. 进入 **CDN** → **缓存刷新**
3. 选择域名: `mirror.violetteam.cloud`
4. 选择刷新类型：
   - **URL 刷新**: 输入 `https://mirror.violetteam.cloud/`
   - **目录刷新**: 输入 `https://mirror.violetteam.cloud/`
5. 点击 **提交刷新**

### 阿里云 CDN

1. 登录阿里云控制台: https://ecs.console.aliyun.com
2. 进入 **CDN** → **刷新预热**
3. 选择域名: `mirror.violetteam.cloud`
4. 选择操作类型：
   - **URL 刷新**: 输入 `https://mirror.violetteam.cloud/`
   - **目录刷新**: 输入 `https://mirror.violetteam.cloud/`
5. 点击 **提交**

## 🔍 验证修复

### 方法 1: 使用无缓存头测试

```bash
curl -H "Cache-Control: no-cache" -H "Pragma: no-cache" \
  https://mirror.violetteam.cloud/ | head -20
```

应该返回我们的 `index.html` 内容，包含 "Mirror 加速站" 或 "YLJD 加速站"。

### 方法 2: 直接访问源站测试

```bash
# 替换为实际源站IP
curl -H "Host: mirror.violetteam.cloud" \
  http://源站IP/ | head -20
```

### 方法 3: 使用浏览器测试

1. 打开浏览器开发者工具（F12）
2. 进入 **Network** 标签
3. 勾选 **Disable cache**
4. 访问 `https://mirror.violetteam.cloud/`
5. 查看返回的 HTML 内容

## ⏱️ 等待缓存过期

如果无法立即清除缓存，可以等待缓存过期：

- **Cloudflare**: 默认缓存时间根据规则设置（通常几分钟到几小时）
- **腾讯云**: 根据缓存规则设置
- **阿里云**: 根据缓存规则设置

## 🚨 如果问题仍然存在

### 1. 检查 CDN 回源配置

确保 CDN 回源到正确的源站：
- 源站地址应该是 `mirror.yljdteam.com` 或源站 IP
- 回源 Host 应该是 `mirror.violetteam.cloud`

### 2. 检查 DNS 配置

```bash
# 检查 DNS 解析
dig mirror.violetteam.cloud
nslookup mirror.violetteam.cloud
```

### 3. 检查 Nginx 配置

```bash
# 验证 server_name 配置
sudo grep "server_name" /etc/nginx/sites-enabled/mirror.conf

# 应该包含: mirror.violetteam.cloud
```

### 4. 检查 SSL 证书

```bash
# 验证 SSL 证书
sudo certbot certificates | grep mirror.violetteam.cloud

# 如果没有证书，需要申请
sudo certbot --nginx -d mirror.violetteam.cloud
```

## 📝 快速修复命令

```bash
# 1. 验证 Nginx 配置
sudo nginx -t

# 2. 重载 Nginx
sudo systemctl reload nginx

# 3. 测试本地访问
curl -H "Host: mirror.violetteam.cloud" http://127.0.0.1/ | head -20

# 4. 清除 CDN 缓存（根据使用的 CDN 服务商）
# Cloudflare: 通过 Dashboard 或 API
# 腾讯云: 通过控制台
# 阿里云: 通过控制台
```

## 💡 预防措施

为了避免类似问题，建议：

1. **配置 CDN 缓存规则**
   - 主页 (`/`) 设置短缓存时间（1小时）
   - 静态资源设置长缓存时间（7-30天）
   - API 请求不缓存

2. **使用版本号参数**
   - CSS/JS 文件使用版本号：`style.css?v=20250118`
   - 更新时修改版本号，CDN 会自动获取新版本

3. **监控 CDN 缓存状态**
   - 定期检查 CDN 缓存命中率
   - 监控源站响应时间

---

**最后更新**: 2025-12-20

