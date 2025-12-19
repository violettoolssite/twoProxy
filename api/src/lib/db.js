const mysql = require('mysql2/promise');
const config = require('../config');

// 创建连接池
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// 封装查询方法
const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

// 获取单条记录
const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] || null;
};

// 插入并返回 insertId
const insert = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);
  return result.insertId;
};

// 更新/删除并返回 affectedRows
const update = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);
  return result.affectedRows;
};

// 事务支持
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  query,
  queryOne,
  insert,
  update,
  transaction,
};

