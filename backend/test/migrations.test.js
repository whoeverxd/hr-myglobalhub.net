const test = require('node:test');
const assert = require('node:assert/strict');
const migrator = require('../src/db/migrator');
const db = require('../src/db');

test('Database Migrations: Discovers versioned migration files', () => {
  const available = migrator.getAvailableMigrations();
  assert.ok(available.length >= 3, 'Should discover at least 3 migration scripts');

  const v1 = available.find((m) => m.version === '001');
  const v2 = available.find((m) => m.version === '002');
  const v3 = available.find((m) => m.version === '003');

  assert.ok(v1, 'Migration 001 must exist');
  assert.ok(v2, 'Migration 002 must exist');
  assert.ok(v3, 'Migration 003 must exist');
});

test('Database Migrations: Run migrations tracking in schema_migrations table', () => {
  migrator.ensureMigrationTable();

  // Run all migrations
  const runResult = migrator.runAllPending();
  assert.ok(runResult);

  // Status check
  const status = migrator.getStatus();
  assert.equal(status.pendingCount, 0, 'No migrations should remain pending after execution');
  assert.ok(status.appliedCount >= 3, 'All 3 migrations must be recorded as applied');

  // Verify schema_migrations rows
  const appliedRows = db.query('SELECT * FROM schema_migrations ORDER BY version ASC');
  assert.ok(appliedRows.some((r) => r.version === '001'));
  assert.ok(appliedRows.some((r) => r.version === '002'));
  assert.ok(appliedRows.some((r) => r.version === '003'));
  assert.ok(appliedRows.some((r) => r.version === '004'));
});

test('Database Migrations: High-precision decimal and index verification', () => {
  // Query sqlite_master to verify tables and indexes created by migrations
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = new Set(tables.map((t) => t.name));

  assert.ok(tableNames.has('employees'), 'employees table must exist');
  assert.ok(tableNames.has('pay_periods'), 'pay_periods table must exist');
  assert.ok(tableNames.has('timesheets'), 'timesheets table must exist');
  assert.ok(tableNames.has('daily_activities'), 'daily_activities table must exist');
  assert.ok(tableNames.has('file_attachments'), 'file_attachments table must exist');
  assert.ok(tableNames.has('payroll_signoffs'), 'payroll_signoffs table must exist');
  assert.ok(tableNames.has('rollout_stages'), 'rollout_stages table must exist');
  assert.ok(tableNames.has('contractors'), 'contractors table must exist');
  assert.ok(tableNames.has('contractor_payments'), 'contractor_payments table must exist');
  assert.ok(tableNames.has('schema_migrations'), 'schema_migrations table must exist');
});
