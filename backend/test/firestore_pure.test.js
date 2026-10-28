const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const firebaseService = require('../src/services/firebase.service');
const firestoreAdapter = require('../src/db/adapters/firestore.adapter');

// These tests hit the PRODUCTION Firestore project (hr-myglobalhub-net) and its local cache file. They never run
// in the normal suite; run them by hand only with ALLOW_FIRESTORE_IN_TESTS=true (see CLAUDE.md).
const LIVE = { skip: process.env.ALLOW_FIRESTORE_IN_TESTS === 'true' ? false : 'production Firestore test (set ALLOW_FIRESTORE_IN_TESTS=true to run)' };

test('Firestore Pure: Verify Cloud Firestore credentials and connection', LIVE, async () => {
  assert.ok(firebaseService.isConfigured(), 'Firebase credentials must be configured');
  const conn = await firebaseService.testConnection();
  assert.equal(conn.configured, true, 'Firebase credentials must be properly configured');
  assert.equal(conn.projectId, 'hr-myglobalhub-net', 'Target project must be hr-myglobalhub-net');
  if (!conn.connected) {
    assert.ok(conn.error.includes('Quota exceeded') || conn.error.includes('RESOURCE_EXHAUSTED'));
  }
});

test('Firestore Pure: Native Collection API (set, get, update, delete)', LIVE, async () => {
  const testCol = firestoreAdapter.collection('test_sandbox');
  const testId = 'test_item_' + Date.now();

  // Insert / Set
  const created = await testCol.set(testId, {
    name: 'Unit Test Item',
    active: true,
    amount: 1500.5,
  });
  assert.equal(created.id, testId);
  assert.equal(created.name, 'Unit Test Item');

  // Get
  const fetched = await testCol.get(testId);
  assert.ok(fetched);
  assert.equal(fetched.name, 'Unit Test Item');

  // Update
  await testCol.update(testId, { amount: 2000.0, status: 'Approved' });
  const updated = await testCol.get(testId);
  assert.equal(updated.amount, 2000.0);
  assert.equal(updated.status, 'Approved');

  // Delete
  const delRes = await testCol.delete(testId);
  assert.equal(delRes.deleted, true);
});

test('Firestore Pure: SQL-to-Firestore Query Translation & Filters', LIVE, async () => {
  await firestoreAdapter.init();

  // Query employees collection
  const employees = firestoreAdapter.query('SELECT id, name, role FROM employees');
  assert.ok(Array.isArray(employees), 'Must return an array of employees');
  assert.ok(employees.length > 0, 'Employees collection must contain documents');

  // Query single with WHERE
  const first = employees[0];
  const found = firestoreAdapter.getOne('SELECT * FROM employees WHERE id = ?', [first.id]);
  assert.ok(found);
  assert.equal(found.id, first.id);

  // WHERE with LOWER()
  const user = firestoreAdapter.getOne('SELECT * FROM users WHERE LOWER(email) = ?', ['joshua@myglobalhub.net']);
  assert.ok(user, 'User with lowercase email must be found in Firestore');
  assert.equal(user.name, 'Joshua Hernandez');

  // Aggregate COUNT(*)
  const countRow = firestoreAdapter.getOne('SELECT COUNT(*) as total FROM employees');
  assert.ok(countRow);
  assert.equal(typeof countRow.total, 'number');
  assert.ok(countRow.total >= employees.length);
});

test('Firestore Pure: Mutation execution (INSERT, UPDATE, DELETE)', LIVE, async () => {
  const testId = 'audit_test_' + Date.now();

  // Execute INSERT
  const insertRes = firestoreAdapter.execute(
    'INSERT INTO audit_logs (id, actor, action, entity_type, ip_address) VALUES (?, ?, ?, ?, ?)',
    [testId, 'Test Runner', 'FIRESTORE_VERIFY', 'system', '127.0.0.1']
  );
  assert.equal(insertRes.changes, 1);

  // Verify getOne
  const log = firestoreAdapter.getOne('SELECT * FROM audit_logs WHERE id = ?', [testId]);
  assert.ok(log);
  assert.equal(log.action, 'FIRESTORE_VERIFY');

  // Execute UPDATE
  firestoreAdapter.execute('UPDATE audit_logs SET action = ? WHERE id = ?', ['FIRESTORE_VERIFY_UPDATED', testId]);
  const updatedLog = firestoreAdapter.getOne('SELECT * FROM audit_logs WHERE id = ?', [testId]);
  assert.equal(updatedLog.action, 'FIRESTORE_VERIFY_UPDATED');

  // Execute DELETE
  firestoreAdapter.execute('DELETE FROM audit_logs WHERE id = ?', [testId]);
  const deletedLog = firestoreAdapter.getOne('SELECT * FROM audit_logs WHERE id = ?', [testId]);
  assert.equal(deletedLog, null);
});
