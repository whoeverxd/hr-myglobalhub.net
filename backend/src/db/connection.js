const path = require('path');
const firestoreAdapter = require('./adapters/firestore.adapter');
let sqliteAdapter = null;
let postgresAdapter = null;

const DB_PATH = process.env.DB_FILE || path.join(__dirname, '..', '..', 'data', 'payroll.db');

function getAdapter() {
  const client = (process.env.DATABASE_CLIENT || 'firestore').toLowerCase();
  if (client === 'postgres' || client === 'pg' || client === 'postgresql') {
    if (!postgresAdapter) postgresAdapter = require('./adapters/postgres.adapter');
    return postgresAdapter;
  }
  if (client === 'sqlite') {
    if (!sqliteAdapter) sqliteAdapter = require('./adapters/sqlite.adapter');
    return sqliteAdapter;
  }
  return firestoreAdapter;
}

function getDialect() {
  return getAdapter().dialect;
}

function getDb() {
  return getAdapter().getDb ? getAdapter().getDb() : null;
}

function getFirestore() {
  return firestoreAdapter.getFirestore();
}

function collection(name) {
  return firestoreAdapter.collection(name);
}

function initDatabase() {
  if (getAdapter().init) {
    return getAdapter().init();
  }
  return Promise.resolve();
}

function exec(sql) {
  return getAdapter().exec(sql);
}

function query(sql, params = []) {
  return getAdapter().query(sql, params);
}

function getOne(sql, params = []) {
  return getAdapter().getOne(sql, params);
}

function execute(sql, params = []) {
  return getAdapter().execute(sql, params);
}

function transaction(fn) {
  return getAdapter().transaction(fn);
}

function reset() {
  if (getAdapter().reset) {
    return getAdapter().reset();
  }
}

function flushPendingWrites() {
  if (getAdapter().flushPendingWrites) {
    return getAdapter().flushPendingWrites();
  }
  return Promise.resolve();
}

module.exports = {
  getDb,
  getFirestore,
  collection,
  initDatabase,
  exec,
  query,
  getOne,
  execute,
  transaction,
  reset,
  flushPendingWrites,
  getAdapter,
  getDialect,
  DB_PATH,
};
