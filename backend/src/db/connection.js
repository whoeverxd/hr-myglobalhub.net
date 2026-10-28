const path = require('path');
const firestoreAdapter = require('./adapters/firestore.adapter');
let sqliteAdapter = null;
let postgresAdapter = null;

const DB_PATH = process.env.DB_FILE || path.join(__dirname, '..', '..', 'data', 'payroll.db');

// Any test process (node --test sets NODE_TEST_CONTEXT; the runner sets NODE_ENV=test) is pinned to local SQLite,
// whatever DATABASE_CLIENT / .env say. Production Firestore must never receive test data (see CLAUDE.md).
const IS_TEST = Boolean(process.env.NODE_TEST_CONTEXT) || process.env.NODE_ENV === 'test';

function getAdapter() {
  return adapterFor(IS_TEST ? 'sqlite' : process.env.DATABASE_CLIENT || 'firestore');
}

// Pure name → adapter mapping (no environment involved)
function adapterFor(name) {
  const client = String(name || 'firestore').toLowerCase();
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
  adapterFor,
  getDialect,
  DB_PATH,
};
