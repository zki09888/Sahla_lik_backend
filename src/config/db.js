const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  waitForConnections: true,
  connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  namedPlaceholders: true,
  dateStrings: true,
  timezone: 'Z'
};

if (process.env.DATABASE_URL) {
  dbConfig.uri = process.env.DATABASE_URL;
} else {
  dbConfig.host = process.env.DB_HOST || 'localhost';
  dbConfig.port = process.env.DB_PORT || 3306;
  dbConfig.user = process.env.DB_USER || 'root';
  dbConfig.password = process.env.DB_PASSWORD || '';
  dbConfig.database = process.env.DB_NAME || 'sahlalik_db';
}

const pool = mysql.createPool(dbConfig);

async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('✅ Database connection pool established');
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  } finally {
    if (connection) connection.release();
  }
}

async function query(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (err) {
    console.error('Database query error:', err.message);
    throw err;
  }
}

async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  testConnection,
  query,
  transaction
};
