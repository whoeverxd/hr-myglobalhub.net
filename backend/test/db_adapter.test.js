const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const postgresAdapter = require('../src/db/adapters/postgres.adapter');
const sqliteAdapter = require('../src/db/adapters/sqlite.adapter');

test('Database Adapter: Defaults to Firestore / respects dialect', () => {
  const currentDialect = db.getDialect();
  assert.ok(['firestore', 'sqlite'].includes(currentDialect));
  const row = db.getOne('SELECT 1 as num');
  assert.equal(row.num, 1);
});

test('Database Adapter: SQLite transaction execution and rollback', () => {
  db.execute("DELETE FROM employees WHERE id = 'FAIL-01'");

  // Test transaction commit
  const res = db.transaction(() => {
    return db.getOne('SELECT 42 as val');
  });
  assert.equal(res.val, 42);

  // Test transaction rollback on error
  assert.throws(() => {
    db.transaction(() => {
      db.execute("INSERT INTO employees (id, name, entity, dept, role, type) VALUES ('FAIL-01', 'Fail', 'Entity', 'Dept', 'Role', 'Full-time')");
      throw new Error('Intentional transaction error');
    });
  });

  const check = db.getOne("SELECT id FROM employees WHERE id = 'FAIL-01'");
  assert.equal(check, null, 'Rolled back record must not exist in DB');
});

test('PostgreSQL Adapter: Parameter normalization (? to $1, $2, ...)', () => {
  const sql1 = 'SELECT * FROM employees WHERE id = ? AND entity = ?';
  const transformed1 = postgresAdapter.transformSql(sql1);
  assert.equal(transformed1, 'SELECT * FROM employees WHERE id = $1 AND entity = $2');

  const sql2 = 'INSERT INTO worklogs (id, hrs, desc) VALUES (?, ?, ?)';
  const transformed2 = postgresAdapter.transformSql(sql2);
  assert.equal(transformed2, 'INSERT INTO worklogs (id, hrs, desc) VALUES ($1, $2, $3)');
});

test('Database Adapter: Dynamic adapter resolution via DATABASE_CLIENT env var', () => {
  const originalEnv = process.env.DATABASE_CLIENT;

  try {
    process.env.DATABASE_CLIENT = 'postgres';
    const adapter = db.getAdapter();
    assert.equal(adapter.dialect, 'postgres');

    process.env.DATABASE_CLIENT = 'firestore';
    const adapterFirestore = db.getAdapter();
    assert.equal(adapterFirestore.dialect, 'firestore');

    process.env.DATABASE_CLIENT = 'sqlite';
    const adapterSqlite = db.getAdapter();
    assert.equal(adapterSqlite.dialect, 'sqlite');
  } finally {
    process.env.DATABASE_CLIENT = originalEnv;
  }
});

test('Firestore Adapter: SQL Parsing for collections, filters, and mutations', () => {
  const firestoreAdapter = require('../src/db/adapters/firestore.adapter');

  // Test SELECT parsing
  const parsedSelect = firestoreAdapter.parseSql('SELECT * FROM employees WHERE id = ? ORDER BY name ASC LIMIT 10');
  assert.equal(parsedSelect.type, 'SELECT');
  assert.equal(parsedSelect.table, 'employees');
  assert.equal(parsedSelect.where, 'id = ?');
  assert.equal(parsedSelect.orderBy, 'name ASC');
  assert.equal(parsedSelect.limit, 10);

  // Test INSERT parsing
  const parsedInsert = firestoreAdapter.parseSql("INSERT INTO daily_activities (id, task, hrs) VALUES (?, ?, ?)");
  assert.equal(parsedInsert.type, 'INSERT');
  assert.equal(parsedInsert.table, 'daily_activities');
  assert.deepEqual(parsedInsert.columns, ['id', 'task', 'hrs']);

  // Test UPDATE parsing
  const parsedUpdate = firestoreAdapter.parseSql("UPDATE timesheets SET status = ?, updated_at = ? WHERE id = ?");
  assert.equal(parsedUpdate.type, 'UPDATE');
  assert.equal(parsedUpdate.table, 'timesheets');
  assert.equal(parsedUpdate.where, 'id = ?');
});

