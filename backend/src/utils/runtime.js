// Runtime guards shared by the middleware, routes and seeder.
// Everything here is secure by default: production needs NO environment variable to be safe.

// A test process: `node --test` sets NODE_TEST_CONTEXT, scripts/run-tests.js sets NODE_ENV=test.
function isTestProcess() {
  return Boolean(process.env.NODE_TEST_CONTEXT) || process.env.NODE_ENV === 'test';
}

// The token-less development login (x-user-email / x-user headers, default PM context) only exists
// in a test process or when explicitly enabled for local development. STRICT_AUTH=true disables it everywhere.
function devAuthAllowed() {
  if (process.env.STRICT_AUTH === 'true') return false;
  return process.env.ALLOW_DEV_AUTH === 'true' || isTestProcess();
}

// POST /api/dev/reset wipes and re-seeds the database: only on local SQLite, and only in tests or when enabled.
function devResetAllowed(dialect) {
  if (String(dialect || '').toLowerCase() !== 'sqlite') return false;
  return process.env.ALLOW_DEV_RESET === 'true' || isTestProcess();
}

// The demo seeder only ever writes to local SQLite. Firestore / Postgres hold real data.
function seedingAllowed(dialect) {
  return String(dialect || '').toLowerCase() === 'sqlite';
}

module.exports = { isTestProcess, devAuthAllowed, devResetAllowed, seedingAllowed };
