const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_FILE || path.join(__dirname, '..', '..', '..', 'data', 'payroll.db');

let instance = null;

function getDb() {
  if (!instance) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    instance = new DatabaseSync(DB_PATH);
    instance.exec('PRAGMA busy_timeout = 10000;');
    instance.exec('PRAGMA foreign_keys = ON;');
    instance.exec('PRAGMA journal_mode = WAL;');
  }
  return instance;
}

const sqliteAdapter = {
  dialect: 'sqlite',

  getDb,

  exec(sql) {
    return getDb().exec(sql);
  },

  query(sql, params = []) {
    const stmt = getDb().prepare(sql);
    return stmt.all(...params.map((p) => (p === undefined ? null : p)));
  },

  getOne(sql, params = []) {
    const stmt = getDb().prepare(sql);
    const row = stmt.get(...params.map((p) => (p === undefined ? null : p)));
    return row !== undefined ? row : null;
  },

  execute(sql, params = []) {
    const stmt = getDb().prepare(sql);
    return stmt.run(...params.map((p) => (p === undefined ? null : p)));
  },

  transaction(fn) {
    const db = getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      const result = fn();
      db.exec('COMMIT;');
      return result;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  reset() {
    if (instance) {
      try {
        instance.close();
      } catch (e) {
        // ignore
      }
      instance = null;
    }
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
  },
};

module.exports = sqliteAdapter;
