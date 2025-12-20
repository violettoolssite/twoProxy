# SMS号码自动释放机制

## 问题背景

### 多用户并发问题

好助码平台对单个账号**同时持有的未释放号码**有数量限制。当多个用户同时使用短信接码服务时，可能出现：

**问题场景**:
```
用户A: 获取号码 138****5678 (未释放)
用户B: 获取号码 138****4321 (未释放)
用户C: 获取号码 138****8765 (未释放)
...
达到平台限制后:
用户N: 获取号码 → ❌ [错误] 取号已超限A
```

### 问题根源

1. **所有用户共用同一个好助码账号**
2. **用户获取号码后可能忘记手动释放**
3. **用户关闭页面，号码仍占用配额**
4. **号码一直占用，直到平台超时（约30分钟）**

## 解决方案

### 1. 数据库追踪

新增字段记录用户当前持有的号码：

| 字段 | 类型 | 说明 |
|------|------|------|
| `sms_current_phone` | VARCHAR(20) | 用户当前持有的号码 |
| `sms_phone_acquired_at` | TIMESTAMP | 号码获取时间 |

### 2. 自动释放机制

**定时任务**: 每5分钟执行一次

**释放条件**: 号码获取时间超过15分钟

**释放流程**:
```
1. 查询所有持有号码超过15分钟的用户
2. 逐个调用好助码API释放号码
3. 清除数据库中的号码记录
4. 记录释放日志
```

### 3. 实时更新

**获取号码时**:
- 记录号码到 `sms_current_phone`
- 记录获取时间到 `sms_phone_acquired_at`

**手动释放时**:
- 调用API释放号码
- 清除数据库记录

**自动释放时**:
- 定时任务检测超时号码
- 自动调用API释放
- 清除数据库记录

## 部署步骤

### 步骤1: 执行数据库迁移

```bash
mysql -u root -p mirror < /var/www/mirror/api/src/scripts/add-sms-phone-tracking.sql
```

### 步骤2: 重启API服务

```bash
cd /var/www/mirror/api
pm2 restart mirror-api
```

### 步骤3: 验证定时任务

查看日志，确认定时任务已启动：

```bash
pm2 logs mirror-api | grep "SMS Auto-Release"
```

预期输出：
```
[SMS Auto-Release] 定时任务已启动，每5分钟执行一次
[SMS Auto-Release] 开始检查超时号码...
[SMS Auto-Release] 没有需要释放的号码
```

## 工作原理

### 时间线示例

```
00:00 - 用户A获取号码 138****5678
        数据库记录: sms_current_phone=138****5678, acquired_at=00:00
        
00:05 - 定时任务执行，检查超时号码
        判断: 00:00 距现在 5分钟 < 15分钟 → 不释放
        
00:10 - 定时任务执行，检查超时号码
        判断: 00:00 距现在 10分钟 < 15分钟 → 不释放
        
00:15 - 定时任务执行，检查超时号码
        判断: 00:00 距现在 15分钟 = 15分钟 → 不释放
        
00:20 - 定时任务执行，检查超时号码
        判断: 00:00 距现在 20分钟 > 15分钟 → ✅ 自动释放
        调用API: cancelRecv(138****5678)
        清除记录: sms_current_phone=NULL, acquired_at=NULL
```

### 用户体验

**正常使用（5分钟内）**:
1. 用户获取号码
2. 用户收到验证码
3. 用户手动点击"释放号码"
4. 号码立即可供其他用户使用

**忘记释放（超过15分钟）**:
1. 用户获取号码
2. 用户离开页面/忘记释放
3. 15分钟后，定时任务自动释放
4. 号码可供其他用户使用

## 监控和管理

### 查看当前持有号码的用户

```sql
SELECT 
  email,
  sms_current_phone AS phone,
  sms_phone_acquired_at AS acquired_at,
  TIMESTAMPDIFF(MINUTE, sms_phone_acquired_at, NOW()) AS holding_minutes
FROM users
WHERE sms_current_phone IS NOT NULL
ORDER BY sms_phone_acquired_at;
```

### 手动触发释放任务

如果需要立即释放所有超时号码：

```bash
# 进入Node.js控制台
cd /var/www/mirror/api
node

# 执行释放任务
const { autoReleaseExpiredPhones } = require('./src/jobs/sms-auto-release');
autoReleaseExpiredPhones();
```

### 查看释放日志

```bash
# 实时查看
pm2 logs mirror-api --lines 100 | grep "SMS Auto-Release"

# 筛选释放成功的记录
pm2 logs mirror-api --lines 1000 --nostream | grep "释放成功"

# 筛选释放失败的记录
pm2 logs mirror-api --lines 1000 --nostream | grep "释放失败"
```

## 配置说明

### 超时时间

当前设置为 **15分钟**，可在以下文件修改：

`api/src/jobs/sms-auto-release.js`:
```javascript
// 第72行
AND sms_phone_acquired_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
```

修改为其他时间（如10分钟）：
```javascript
AND sms_phone_acquired_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
```

### 检查频率

当前设置为 **每5分钟**检查一次，可修改：

`api/src/jobs/sms-auto-release.js`:
```javascript
// 第134行
setInterval(autoReleaseExpiredPhones, 5 * 60 * 1000);
```

修改为其他频率（如3分钟）：
```javascript
setInterval(autoReleaseExpiredPhones, 3 * 60 * 1000);
```

## 预期效果

### 优势

✅ **自动化管理**: 无需人工干预，自动释放超时号码
✅ **防止配额耗尽**: 确保号码及时释放，不影响其他用户
✅ **提高可用性**: 减少"取号已超限"错误的发生
✅ **用户友好**: 用户忘记释放也不会影响系统

### 统计预测

假设：
- 每天100个用户使用SMS
- 平均每人获取2个号码
- 30%用户忘记手动释放

**无自动释放**:
- 每天60个号码（30%×200）需等待平台超时（~30分钟）
- 高峰期极易达到平台限制

**有自动释放**:
- 15分钟后自动释放
- 号码循环利用更快
- 大幅降低"取号已超限"概率

## 故障排查

### 问题1: 定时任务未启动

**症状**: 日志中没有 `[SMS Auto-Release]` 相关输出

**检查**:
```bash
pm2 logs mirror-api | grep "定时任务"
```

**解决**: 重启API服务
```bash
pm2 restart mirror-api
```

### 问题2: 释放失败

**症状**: 日志显示 `释放失败`

**可能原因**:
1. 号码已被平台自动释放
2. API Token过期
3. 网络连接问题

**解决**: 检查好助码账号状态和API配置

### 问题3: 数据库字段不存在

**症状**: API错误 `Unknown column 'sms_current_phone'`

**解决**: 执行数据库迁移脚本

## 技术细节

### 代码结构

```
api/
├── src/
│   ├── jobs/
│   │   └── sms-auto-release.js    # 定时任务主逻辑
│   ├── routes/
│   │   └── sms.js                  # 获取/释放API（已更新）
│   └── app.js                      # 启动定时任务
└── scripts/
    └── add-sms-phone-tracking.sql  # 数据库迁移
```

### API更改

**GET /api/sms/get-phone**:
- 新增: 记录 `sms_current_phone` 和 `sms_phone_acquired_at`

**POST /api/sms/release-phone**:
- 新增: 清除 `sms_current_phone` 和 `sms_phone_acquired_at`

**新增定时任务**:
- 函数: `autoReleaseExpiredPhones()`
- 频率: 每5分钟
- 操作: 释放超过15分钟的号码

## 总结

此机制通过**数据库追踪 + 定时自动释放**的方式，有效解决了多用户并发时号码配额耗尽的问题，提升了服务的稳定性和用户体验。

**关键优势**:
- 🚀 自动化
- 🛡️ 防止配额耗尽
- 👥 支持多用户并发
- 📊 可监控和管理

