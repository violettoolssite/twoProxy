# CDN 配置文件说明

本目录包含 CDN 边缘加速相关的配置文件。

## 📂 文件说明

| 文件 | 说明 | 使用方法 |
|------|------|----------|
| `cloudflare-worker.js` | Cloudflare Workers 配置示例 | 部署到 Cloudflare Workers 实现精细缓存控制 |
| `nginx-cdn-optimization.conf` | Nginx 优化配置 | 添加到 Nginx 配置文件中，优化缓存头 |
| `../test-cdn.sh` | CDN 测试脚本 | 运行 `bash scripts/test-cdn.sh` 测试 CDN 效果 |

## 🚀 快速开始

### 1. 运行 CDN 配置脚本

```bash
cd /var/www/mirror/scripts
bash setup-cdn.sh cloudflare  # Cloudflare CDN
bash setup-cdn.sh tencent     # 腾讯云 CDN
bash setup-cdn.sh aliyun      # 阿里云 CDN
```

### 2. 应用 Nginx 优化配置（可选）

```bash
# 查看优化配置
cat deploy/cdn/nginx-cdn-optimization.conf

# 添加到 Nginx 配置
sudo nano /etc/nginx/sites-enabled/mirror.conf
# 复制相关配置到文件中

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 3. 测试 CDN 效果

```bash
bash scripts/test-cdn.sh
```

## 📖 详细文档

查看完整的 CDN 配置指南：
```bash
cat CDN_CONFIGURATION.md
```

## 💡 注意事项

1. **API 请求**: 必须设置为不缓存，确保实时处理
2. **代理请求**: GitHub、Docker 等代理请求不能缓存
3. **认证**: 用户登录相关的请求不能缓存
4. **版本控制**: 使用版本号参数（如 `?v=20250118`）确保更新生效

---

**最后更新**: 2025-12-20

