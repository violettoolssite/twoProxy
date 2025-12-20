# 短信接码使用次数限制说明

## 概述

由于短信接码服务成本较高，系统已实现使用次数限制功能：
- **默认免费额度**：每个用户 3 次
- **用完后提示**：引导用户发电支持
- **增加额度**：发电后可增加使用次数

## 功能特性

### 1. 使用次数跟踪

系统为每个用户记录：
- `sms_usage_count`: 已使用次数
- `sms_usage_limit`: 使用次数限制（默认 3）
- `sms_last_used_at`: 最后使用时间

### 2. 前端显示

- **剩余次数提示**：蓝色提示框显示"剩余次数：X / 3"
- **用完提示**：黄色警告框，引导用户发电
- **发电链接**：直接跳转到感谢名单页面

### 3. 后端限制

- 每次获取手机号前检查剩余次数
- 使用次数用完后拒绝请求
- 返回友好的提示信息

## 数据库迁移

### 方法 1：使用 SQL 文件（推荐）

```bash
mysql -u root -p mirror < /var/www/mirror/api/src/scripts/add-sms-fields-manual.sql
```

### 方法 2：手动执行 SQL

登录 MySQL 后执行：

```sql
USE mirror;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS sms_usage_count INT UNSIGNED DEFAULT 0 COMMENT '短信接码已使用次数',
ADD COLUMN IF NOT EXISTS sms_usage_limit INT UNSIGNED DEFAULT 3 COMMENT '短信接码使用次数限制',
ADD COLUMN IF NOT EXISTS sms_last_used_at TIMESTAMP NULL COMMENT '短信接码最后使用时间';

CREATE INDEX IF NOT EXISTS idx_sms_usage ON users(sms_usage_count, sms_usage_limit);
```

## 增加用户额度

### 场景：用户发电后增加使用次数

#### 方案 1：增加限额（推荐）

```sql
-- 为指定用户增加10次使用额度
UPDATE users 
SET sms_usage_limit = sms_usage_limit + 10 
WHERE email = 'user@example.com';
```

#### 方案 2：设置固定额度

```sql
-- 设置用户总额度为20次
UPDATE users 
SET sms_usage_limit = 20 
WHERE email = 'user@example.com';
```

#### 方案 3：重置使用次数

```sql
-- 清零使用次数（慎用）
UPDATE users 
SET sms_usage_count = 0 
WHERE email = 'user@example.com';
```

### 批量操作

```sql
-- 为所有用户增加5次额度
UPDATE users SET sms_usage_limit = sms_usage_limit + 5;

-- 查看所有用户的使用情况
SELECT 
  email,
  sms_usage_count AS used,
  sms_usage_limit AS `limit`,
  (sms_usage_limit - sms_usage_count) AS remaining,
  sms_last_used_at AS last_used
FROM users
WHERE sms_usage_count > 0 OR sms_usage_limit > 3
ORDER BY sms_usage_count DESC;
```

## 发电金额与使用次数对应关系（建议）

| 发电金额 | 增加次数 | 说明 |
|---------|---------|------|
| 10 元 | 10 次 | 基础支持 |
| 20 元 | 25 次 | 优惠支持 |
| 50 元 | 100 次 | 标准支持 |
| 100 元 | 300 次 | 高级支持 |
| 500 元 | 无限 | 设置为 999999 |

示例：

```sql
-- 用户发电10元，增加10次
UPDATE users SET sms_usage_limit = sms_usage_limit + 10 WHERE email = 'user@example.com';

-- 用户发电100元，增加300次
UPDATE users SET sms_usage_limit = sms_usage_limit + 300 WHERE email = 'vip@example.com';

-- 用户发电500元，设置为无限
UPDATE users SET sms_usage_limit = 999999 WHERE email = 'super@example.com';
```

## API 说明

### 1. 查询使用情况

```
GET /api/sms/usage
Authorization: Bearer {token}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "used": 1,
    "limit": 3,
    "remaining": 2,
    "lastUsedAt": "2025-12-20T05:30:00.000Z"
  }
}
```

### 2. 获取手机号（带次数检查）

```
GET /api/sms/get-phone?sid=cursor
Authorization: Bearer {token}
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "phone": "19261656307",
    "message": "获取成功"
  },
  "usage": {
    "used": 2,
    "limit": 3,
    "remaining": 1
  }
}
```

**次数用完响应：**
```json
{
  "success": false,
  "message": "您已使用完3次免费额度，如觉得好用请发电支持，为您的账号开启更多使用次数",
  "usage": {
    "used": 3,
    "limit": 3,
    "remaining": 0
  }
}
```

## 前端提示文案

### 剩余次数提示（蓝色）

```
剩余次数：2 / 3
💝 发电支持
```

### 用完提示（黄色）

```
⚠️ 您已使用完免费额度

该功能成本较高，每个用户免费使用3次。如果觉得好用，欢迎发电支持，
我们将为您的账号开启对应金额的使用次数。

提示：联系方式见感谢名单页面
```

## 监控和统计

### 查看使用统计

```sql
-- 今日使用情况
SELECT 
  COUNT(DISTINCT user_id) AS active_users,
  SUM(CASE WHEN sms_last_used_at >= CURDATE() THEN 1 ELSE 0 END) AS today_usage
FROM users
WHERE sms_usage_count > 0;

-- 使用次数分布
SELECT 
  sms_usage_count AS used_count,
  COUNT(*) AS user_count
FROM users
WHERE sms_usage_count > 0
GROUP BY sms_usage_count
ORDER BY sms_usage_count DESC;

-- 用完额度的用户
SELECT 
  email,
  sms_usage_count,
  sms_usage_limit,
  sms_last_used_at
FROM users
WHERE sms_usage_count >= sms_usage_limit
ORDER BY sms_last_used_at DESC;
```

## 注意事项

1. **数据库迁移**：请先执行数据库迁移，添加必要的字段
2. **API重启**：修改代码后需要重启API服务：`pm2 restart mirror-api`
3. **缓存刷新**：前端已更新版本号为 `v=20250155`，用户需刷新页面
4. **联系方式**：确保感谢名单页面包含联系方式（QQ: 1494458927）
5. **发电记录**：建议保留发电记录，方便追溯和审核

## 故障排查

### 问题1：用户提示未登录

**原因**：Token 过期或未登录  
**解决**：引导用户登录

### 问题2：使用次数不更新

**原因**：数据库字段未添加  
**解决**：执行数据库迁移脚本

### 问题3：显示"网络错误"

**原因**：API服务未重启或认证失败  
**解决**：检查API服务状态，查看日志 `pm2 logs mirror-api`

## 维护建议

1. **定期查看**：每周检查使用统计，了解用户活跃度
2. **及时处理**：用户发电后及时增加额度
3. **记录保存**：保留发电记录和额度增加记录
4. **用户反馈**：收集用户对定价的反馈，适当调整
5. **成本核算**：定期核算成本，确保可持续运营

