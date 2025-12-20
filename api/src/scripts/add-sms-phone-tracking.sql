-- 添加SMS号码跟踪字段
-- 用于记录用户当前持有的号码，实现自动释放

USE mirror;

DELIMITER $$

-- 添加字段的存储过程
DROP PROCEDURE IF EXISTS add_sms_tracking_fields$$
CREATE PROCEDURE add_sms_tracking_fields()
BEGIN
  DECLARE column_exists INT DEFAULT 0;
  
  -- 检查 sms_current_phone 字段
  SELECT COUNT(*) INTO column_exists
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'sms_current_phone';
  
  IF column_exists = 0 THEN
    ALTER TABLE users ADD COLUMN sms_current_phone VARCHAR(20) NULL COMMENT '当前持有的短信接码号码';
    SELECT '✅ 已添加字段: sms_current_phone' AS result;
  ELSE
    SELECT '⚠️  字段已存在，跳过: sms_current_phone' AS result;
  END IF;
  
  -- 检查 sms_phone_acquired_at 字段
  SELECT COUNT(*) INTO column_exists
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'sms_phone_acquired_at';
  
  IF column_exists = 0 THEN
    ALTER TABLE users ADD COLUMN sms_phone_acquired_at TIMESTAMP NULL COMMENT '号码获取时间（用于自动释放）';
    SELECT '✅ 已添加字段: sms_phone_acquired_at' AS result;
  ELSE
    SELECT '⚠️  字段已存在，跳过: sms_phone_acquired_at' AS result;
  END IF;
  
  -- 添加索引
  SELECT COUNT(*) INTO column_exists
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_sms_phone';
  
  IF column_exists = 0 THEN
    ALTER TABLE users ADD INDEX idx_sms_phone (sms_current_phone, sms_phone_acquired_at);
    SELECT '✅ 已添加索引: idx_sms_phone' AS result;
  ELSE
    SELECT '⚠️  索引已存在，跳过: idx_sms_phone' AS result;
  END IF;
END$$

DELIMITER ;

-- 执行迁移
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS '';
SELECT '🔧 添加SMS号码跟踪字段...' AS '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS '';
SELECT '' AS '';

CALL add_sms_tracking_fields();

DROP PROCEDURE IF EXISTS add_sms_tracking_fields;

SELECT '' AS '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS '';
SELECT '✅ 迁移完成！' AS '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS '';
SELECT '' AS '';
SELECT '📋 新增字段说明：' AS '';
SELECT '  • sms_current_phone: 用户当前持有的号码' AS '';
SELECT '  • sms_phone_acquired_at: 号码获取时间' AS '';
SELECT '  • 超过15分钟未使用将自动释放' AS '';
SELECT '' AS '';

