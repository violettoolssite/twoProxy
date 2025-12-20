-- 短信接码功能数据库迁移（安全版本）
-- 使用存储过程检查字段是否存在，避免重复添加
-- 执行方式：mysql -u root -p mirror < add-sms-fields-safe.sql

USE mirror;

DELIMITER $$

-- 创建临时存储过程：添加字段（如果不存在）
DROP PROCEDURE IF EXISTS add_column_if_not_exists$$
CREATE PROCEDURE add_column_if_not_exists(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_definition VARCHAR(255)
)
BEGIN
  DECLARE column_exists INT DEFAULT 0;
  
  SELECT COUNT(*) INTO column_exists
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND COLUMN_NAME = p_column_name;
  
  IF column_exists = 0 THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table_name, ' ADD COLUMN ', p_column_name, ' ', p_column_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('✅ 已添加字段: ', p_column_name) AS result;
  ELSE
    SELECT CONCAT('⚠️  字段已存在，跳过: ', p_column_name) AS result;
  END IF;
END$$

-- 创建临时存储过程：添加索引（如果不存在）
DROP PROCEDURE IF EXISTS add_index_if_not_exists$$
CREATE PROCEDURE add_index_if_not_exists(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_columns VARCHAR(255)
)
BEGIN
  DECLARE index_exists INT DEFAULT 0;
  
  SELECT COUNT(*) INTO index_exists
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND INDEX_NAME = p_index_name;
  
  IF index_exists = 0 THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table_name, ' ADD INDEX ', p_index_name, ' (', p_index_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('✅ 已添加索引: ', p_index_name) AS result;
  ELSE
    SELECT CONCAT('⚠️  索引已存在，跳过: ', p_index_name) AS result;
  END IF;
END$$

DELIMITER ;

-- 执行迁移
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS '';
SELECT '🔧 开始执行数据库迁移...' AS '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS '';
SELECT '' AS '';

-- 添加字段
CALL add_column_if_not_exists('users', 'sms_usage_count', 'INT UNSIGNED DEFAULT 0 COMMENT "短信接码已使用次数"');
CALL add_column_if_not_exists('users', 'sms_usage_limit', 'INT UNSIGNED DEFAULT 3 COMMENT "短信接码使用次数限制（默认3次）"');
CALL add_column_if_not_exists('users', 'sms_last_used_at', 'TIMESTAMP NULL COMMENT "短信接码最后使用时间"');

-- 添加索引
CALL add_index_if_not_exists('users', 'idx_sms_usage', 'sms_usage_count, sms_usage_limit');

-- 清理临时存储过程
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DROP PROCEDURE IF EXISTS add_index_if_not_exists;

-- 显示结果
SELECT '' AS '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS '';
SELECT '✅ 迁移完成！' AS '';
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS '';
SELECT '' AS '';
SELECT '📋 配置说明：' AS '';
SELECT '  • 每个用户默认有 3 次免费使用额度' AS '';
SELECT '  • 如需为指定用户增加额度，可执行：' AS '';
SELECT '    UPDATE users SET sms_usage_limit = 10 WHERE email = "user@example.com";' AS '';
SELECT '' AS '';
SELECT '📊 查看用户使用情况：' AS '';
SELECT '    SELECT email, sms_usage_count AS used, sms_usage_limit AS `limit` FROM users LIMIT 5;' AS '';
SELECT '' AS '';

