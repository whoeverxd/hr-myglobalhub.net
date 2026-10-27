const fs = require('fs');
const path = require('path');
const db = require('./index');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function adaptPostgresToSqlite(sql) {
  return sql
    .replace(/TIMESTAMPTZ/gi, 'TEXT')
    .replace(/NOW\(\)/gi, "(datetime('now'))")
    .replace(/JSONB/gi, 'TEXT')
    .replace(/BOOLEAN/gi, 'INTEGER')
    .replace(/\bFALSE\b/gi, '0')
    .replace(/\bTRUE\b/gi, '1')
    .replace(/DECIMAL\(\d+,\s*\d+\)/gi, 'REAL');
}

/**
 * Migration Manager for Enterprise Database Deployments
 */
class Migrator {
  constructor(database = db) {
    this.db = database;
  }

  /**
   * Ensure schema_migrations table exists
   */
  ensureMigrationTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  /**
   * List all migration files available on disk
   */
  getAvailableMigrations() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      return [];
    }
    const files = fs.readdirSync(MIGRATIONS_DIR);
    return files
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((filename) => {
        const version = filename.split('_')[0];
        return {
          version,
          filename,
          filepath: path.join(MIGRATIONS_DIR, filename),
        };
      });
  }

  /**
   * Get list of already applied migrations
   */
  getApplied() {
    this.ensureMigrationTable();
    const rows = this.db.query(`SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC`);
    return rows;
  }

  /**
   * Get pending migrations
   */
  getPending() {
    const applied = new Set(this.getApplied().map((m) => m.version));
    const available = this.getAvailableMigrations();
    return available.filter((m) => !applied.has(m.version));
  }

  /**
   * Run a single migration
   */
  runMigration(migration) {
    this.ensureMigrationTable();
    let sql = fs.readFileSync(migration.filepath, 'utf8');

    if (this.db.getDialect && this.db.getDialect() === 'sqlite') {
      sql = adaptPostgresToSqlite(sql);
    }

    this.db.transaction(() => {
      // Execute SQL migration script
      this.db.exec(sql);

      // Record in schema_migrations
      this.db.execute(
        `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'))`,
        [migration.version, migration.filename]
      );
    });

    return {
      version: migration.version,
      filename: migration.filename,
      status: 'applied',
    };
  }

  /**
   * Run all pending migrations in order
   */
  runAllPending() {
    const pending = this.getPending();
    const results = [];

    for (const mig of pending) {
      const res = this.runMigration(mig);
      results.push(res);
    }

    return {
      appliedCount: results.length,
      migrations: results,
    };
  }

  /**
   * Report migration status
   */
  getStatus() {
    const available = this.getAvailableMigrations();
    const applied = this.getApplied();
    const pending = this.getPending();

    return {
      dialect: this.db.getDialect ? this.db.getDialect() : 'sqlite',
      totalAvailable: available.length,
      appliedCount: applied.length,
      pendingCount: pending.length,
      applied,
      pending: pending.map((p) => p.filename),
    };
  }
}

const defaultMigrator = new Migrator();
defaultMigrator.Migrator = Migrator;

module.exports = defaultMigrator;
