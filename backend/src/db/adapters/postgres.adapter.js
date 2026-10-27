/**
 * PostgreSQL Adapter for Managed Production Database
 * Provides parameter normalization (? to $1, $2, ...) and connection lifecycle
 */

function transformSql(sql) {
  let counter = 0;
  // Replace ? outside of quotes with $1, $2, ...
  return sql.replace(/\?/g, () => {
    counter += 1;
    return `$${counter}`;
  });
}

class PostgresAdapter {
  constructor(config = {}) {
    this.dialect = 'postgres';
    this.config = {
      connectionString: process.env.DATABASE_URL || config.connectionString,
      host: process.env.PG_HOST || config.host || 'localhost',
      port: Number(process.env.PG_PORT || config.port) || 5432,
      database: process.env.PG_DATABASE || config.database || 'mgh_payroll',
      user: process.env.PG_USER || config.user || 'postgres',
      password: process.env.PG_PASSWORD || config.password || '',
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
    this.pool = null;
  }

  transformSql(sql) {
    return transformSql(sql);
  }

  async getPool() {
    if (!this.pool) {
      try {
        const { Pool } = require('pg');
        this.pool = new Pool(this.config);
      } catch (err) {
        throw new Error(
          `PostgreSQL driver 'pg' is not installed or available: ${err.message}. Run 'npm install pg' for managed Postgres connectivity.`
        );
      }
    }
    return this.pool;
  }

  /**
   * Execute raw SQL string (e.g. DDL schema migrations)
   */
  async exec(sql) {
    const pool = await this.getPool();
    return pool.query(sql);
  }

  /**
   * Execute a SELECT query returning array of rows
   */
  async query(sql, params = []) {
    const pgSql = transformSql(sql);
    const pool = await this.getPool();
    const result = await pool.query(pgSql, params);
    return result.rows;
  }

  /**
   * Execute a SELECT query returning single row or null
   */
  async getOne(sql, params = []) {
    const pgSql = transformSql(sql);
    const pool = await this.getPool();
    const result = await pool.query(pgSql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Execute an INSERT/UPDATE/DELETE statement returning changes
   */
  async execute(sql, params = []) {
    const pgSql = transformSql(sql);
    const pool = await this.getPool();
    const result = await pool.query(pgSql, params);
    return {
      changes: result.rowCount,
      rowCount: result.rowCount,
    };
  }

  /**
   * Transaction runner with BEGIN / COMMIT / ROLLBACK
   */
  async transaction(fn) {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

const postgresAdapter = new PostgresAdapter();
postgresAdapter.PostgresAdapter = PostgresAdapter;
postgresAdapter.transformSql = transformSql;

module.exports = postgresAdapter;
