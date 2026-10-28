const {
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
  hydrationStatus,
  getAdapter,
  getDialect,
  DB_PATH,
} = require('./connection');
const { initSchema } = require('./schema');
const { seedDatabaseIfEmpty } = require('./seeder');

// Bootstrapping
if (getDialect() === 'sqlite') {
  initSchema();
  const shouldSkipSeed = process.env.SKIP_SEED === 'true' || process.env.AUTO_SEED === 'false';
  if (!shouldSkipSeed) {
    seedDatabaseIfEmpty();
  }
} else if (getDialect() === 'firestore') {
  // Automatically hydrate cache from Cloud Firestore
  initDatabase().catch((err) => {
    console.warn('[db] Firestore initialization notice:', err.message);
  });
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
  hydrationStatus,
  getAdapter,
  getDialect,
  DB_PATH,
};
