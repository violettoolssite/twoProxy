# CDN 域名配置问题修复指南

## 🐛 问题描述

配置 CDN 后，`mirror.violetteam.cloud` 访问时被错误地路由到了 `hunshcn/gh-proxy`（GitHub 仓库）。

## 🔍 问题原因

Nginx 配置中有一个通用的 GitHub 代理规则：

```nginx
location ~ ^/([^/]+/[^/]+)(/.*)?$ {
```

这个规则会匹配所有 `owner/repo` 格式的路径，包括 `hunshcn/gh-proxy`。当访问 `mirror.violetteam.cloud/hunshcn/gh-proxy` 时，会被这个规则匹配，然后代理到 `https://github.com/hunshcn/gh-proxy`。

## ✅ 解决方案

### 方案 1: 更新排除列表（推荐）

在 Nginx 配置的 GitHub 代理规则中，添加更多排除项：

```nginx
# 排除已知的非 GitHub 路径
if ($owner_repo ~ ^(css|js|file|assets|api|user|admin|_next|static|favicon\.ico|github|search|v2|gh|sponsors|hunshcn|gh-proxy|violetteam|mirror)) {
    break;
}
```

### 方案 2: 为 mirror.violetteam.cloud 创建专门配置

1. **复制配置文件**
   ```bash
   sudo cp /var/www/mirror/deploy/nginx-mirror-violetteam.conf.example /etc/nginx/sites-enabled/mirror-violetteam.conf
   ```

2. **申请 SSL 证书**
   ```bash
   sudo certbot --nginx -d mirror.violetteam.cloud
   ```

3. **测试配置**
   ```bash
   sudo nginx -t
   ```

4. **重载 Nginx**
   ```bash
   sudo systemctl reload nginx
   ```

### 方案 3: 调整 location 规则顺序

确保更具体的规则（如 `/api/`, `/user/`, `/admin/`）在通用 GitHub 代理规则之前：

```nginx
# 这些规则必须在 GitHub 代理规则之前
location ^~ /api/ { ... }
location ^~ /user/ { ... }
location ^~ /admin/ { ... }

# GitHub 代理规则放在最后
location ~ ^/([^/]+/[^/]+)(/.*)?$ { ... }
```

## 🔧 修复步骤

### 步骤 1: 备份当前配置

```bash
sudo cp /etc/nginx/sites-enabled/mirror.conf /etc/nginx/sites-enabled/mirror.conf.bak
```

### 步骤 2: 更新排除列表

编辑 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-enabled/mirror.conf
```

找到 GitHub 代理规则，更新排除列表：

```nginx
# 修改前
if ($owner_repo ~ ^(css|js|file|assets|_next|static|favicon\.ico|github|search|v2)) {
    break;
}

# 修改后
if ($owner_repo ~ ^(css|js|file|assets|api|user|admin|_next|static|favicon\.ico|github|search|v2|gh|sponsors|hunshcn|gh-proxy|violetteam|mirror)) {
    break;
}
```

### 步骤 3: 测试并重载

```bash
# 测试配置
sudo nginx -t

# 如果测试通过，重载 Nginx
sudo systemctl reload nginx
```

### 步骤 4: 验证修复

```bash
# 测试主页
curl -I https://mirror.violetteam.cloud/

# 应该返回 index.html，而不是 GitHub 代理页面
```

## 📝 完整的排除列表建议

建议排除以下路径，避免误匹配：

```
css|js|file|assets|api|user|admin|_next|static|favicon\.ico|github|search|v2|gh|sponsors|hunshcn|gh-proxy|violetteam|mirror|sponsors|email|sms
```

## ⚠️ 注意事项

1. **CDN 回源配置**: 确保 CDN 回源到正确的源站
2. **DNS 配置**: 确保 `mirror.violetteam.cloud` 的 DNS 记录正确
3. **SSL 证书**: 确保为 `mirror.violetteam.cloud` 申请了 SSL 证书
4. **测试验证**: 修复后务必测试所有功能是否正常

## 🔍 调试方法

如果问题仍然存在，可以使用以下方法调试：

```bash
# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log | grep mirror.violetteam.cloud

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 测试特定路径
curl -v https://mirror.violetteam.cloud/
curl -v https://mirror.violetteam.cloud/api/health
```

## 📞 技术支持

如有问题，请联系：
- **QQ**: 1494458927

---

**最后更新**: 2025-12-20

