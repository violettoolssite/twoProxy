/**
 * 数据库初始化脚本
 * 运行方式：node src/scripts/init-db.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const config = require('../config');

const tables = [
  // 用户表
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    subdomain VARCHAR(50) UNIQUE,
    api_key VARCHAR(64) UNIQUE,
    status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_subdomain (subdomain),
    INDEX idx_api_key (api_key),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 订阅表
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    plan ENUM('free', 'basic', 'pro', 'enterprise') DEFAULT 'free',
    monthly_traffic_bytes BIGINT UNSIGNED DEFAULT 5368709120,
    bandwidth_limit_mbps INT UNSIGNED DEFAULT 5,
    concurrent_limit INT UNSIGNED DEFAULT 5,
    api_daily_limit INT DEFAULT 100,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    auto_renew BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_plan (plan),
    INDEX idx_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 流量统计表（按天聚合）
  `CREATE TABLE IF NOT EXISTS traffic_stats (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    date DATE NOT NULL,
    bytes_used BIGINT UNSIGNED DEFAULT 0,
    requests_count INT UNSIGNED DEFAULT 0,
    github_requests INT UNSIGNED DEFAULT 0,
    docker_requests INT UNSIGNED DEFAULT 0,
    file_requests INT UNSIGNED DEFAULT 0,
    UNIQUE KEY uk_user_date (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_date (date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 流量包表
  `CREATE TABLE IF NOT EXISTS traffic_packs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    bytes_total BIGINT UNSIGNED NOT NULL,
    bytes_used BIGINT UNSIGNED DEFAULT 0,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 支付订单表
  `CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    order_no VARCHAR(64) UNIQUE NOT NULL,
    order_type ENUM('subscription', 'traffic_pack', 'bandwidth_upgrade') NOT NULL,
    plan ENUM('free', 'basic', 'pro', 'enterprise') NULL,
    months INT UNSIGNED DEFAULT 1,
    amount_cents INT UNSIGNED NOT NULL,
    status ENUM('pending', 'paid', 'refunded', 'cancelled', 'expired') DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(128),
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_order_no (order_no),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 访问日志表（用于审计和详细统计）
  `CREATE TABLE IF NOT EXISTS access_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    subdomain VARCHAR(50),
    request_type ENUM('github', 'docker', 'file', 'api', 'other') DEFAULT 'other',
    request_path TEXT,
    request_method VARCHAR(10),
    response_code INT UNSIGNED,
    bytes_transferred BIGINT UNSIGNED DEFAULT 0,
    response_time_ms INT UNSIGNED,
    user_agent TEXT,
    ip_address VARCHAR(45),
    referer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_subdomain (subdomain),
    INDEX idx_created_at (created_at),
    INDEX idx_request_type (request_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 邀请码表
  `CREATE TABLE IF NOT EXISTS invite_codes (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(32) UNIQUE NOT NULL,
    created_by BIGINT UNSIGNED NULL,
    used_by BIGINT UNSIGNED NULL,
    bonus_traffic_bytes BIGINT UNSIGNED DEFAULT 0,
    bonus_days INT UNSIGNED DEFAULT 0,
    status ENUM('active', 'used', 'expired', 'disabled') DEFAULT 'active',
    expires_at TIMESTAMP NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_code (code),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 系统配置表
  `CREATE TABLE IF NOT EXISTS system_config (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

// 初始化系统配置
const initConfigs = [
  ['registration_enabled', 'true', '是否开放注册'],
  ['invite_only', 'false', '是否仅限邀请注册'],
  ['free_plan_enabled', 'true', '是否启用免费套餐'],
  ['maintenance_mode', 'false', '维护模式'],
  ['announcement', '', '系统公告'],
];

async function initDatabase() {
  console.log('[Init] Connecting to database...');

  // 先连接不指定数据库，创建数据库
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });

  console.log(`[Init] Creating database "${config.db.database}" if not exists...`);
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.query(`USE \`${config.db.database}\``);

  // 创建表
  for (let i = 0; i < tables.length; i++) {
    const sql = tables[i];
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || `table_${i}`;
    console.log(`[Init] Creating table: ${tableName}`);
    await connection.query(sql);
  }

  // 初始化系统配置
  console.log('[Init] Initializing system config...');
  for (const [key, value, desc] of initConfigs) {
    await connection.execute(
      `INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES (?, ?, ?)`,
      [key, value, desc]
    );
  }

  console.log('[Init] Database initialization complete!');
  await connection.end();
}

initDatabase().catch((err) => {
  console.error('[Init] Error:', err);
  process.exit(1);
});

