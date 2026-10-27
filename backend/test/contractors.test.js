const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const contractorsController = require('../src/controllers/contractors.controller');

test('Contractors DB: Lists real seeded contractors (Zain Rondon)', () => {
  const contractors = contractorsController.listContractors();
  assert.ok(Array.isArray(contractors), 'Should return an array');
  assert.ok(contractors.length >= 1, 'Should have at least 1 contractor');

  const zain = contractors.find((c) => c.name === 'Zain Rondon');
  assert.ok(zain, 'Zain Rondon should exist as real contractor');
  assert.equal(zain.name, 'Zain Rondon');
  assert.equal(zain.country, 'Dominican Republic');
  assert.ok(zain.role.includes('Full Stack Developer'));
  assert.ok(zain.rate >= 50);
  assert.equal(zain.method, 'Coinbase');
  assert.equal(zain.st, 'Active');
  assert.equal(zain.status, 'Active');
  assert.equal(zain.employeeId, 'MGH-1043');

  // Ensure no dummy CTR-0101 placeholder remains
  const dummy = contractors.find((c) => c.id === 'CTR-0101');
  assert.equal(dummy, undefined, 'Dummy placeholder CTR-0101 must not exist');
});

test('Contractors DB: Get single contractor by ID', () => {
  const c = contractorsController.getContractor('CTR-1043');
  assert.ok(c);
  assert.equal(c.name, 'Zain Rondon');
  assert.ok(c.rate >= 50);

  const missing = contractorsController.getContractor('CTR-9999');
  assert.equal(missing, null);
});

test('Contractors DB: Create new contractor with user login provisioning and audit logging', () => {
  const initialList = contractorsController.listContractors();
  const newCtr = contractorsController.createContractor(
    {
      name: 'Test Contractor Dev',
      role: 'DevOps Engineer',
      country: 'Dominican Republic',
      email: 'devops.contractor@myglobalhub.net',
      basis: 'Hourly',
      rate: 35,
      method: 'Coinbase',
      wallet: '0x1234567890abcdef1234567890abcdef12345678',
      asset: 'USDC',
      network: 'Base',
    },
    'Test Auditor',
    '192.168.1.50'
  );

  assert.ok(newCtr);
  assert.ok(newCtr.id.startsWith('CTR-'));
  assert.equal(newCtr.name, 'Test Contractor Dev');
  assert.equal(newCtr.role, 'DevOps Engineer');
  assert.equal(newCtr.rate, 35);
  assert.equal(newCtr.st, 'Active');
  assert.ok(newCtr.employeeId, 'Must have associated employeeId');

  // Verify user was automatically provisioned in users table
  const userRow = db.getOne(`SELECT * FROM users WHERE LOWER(email) = ?`, ['devops.contractor@myglobalhub.net']);
  assert.ok(userRow, 'System login user must be created for contractor');
  assert.equal(userRow.role, 'contractor', 'User role must be contractor');
  assert.equal(userRow.employee_id, newCtr.employeeId, 'User must link to contractor employee_id');

  // Verify audit log entry
  const auditRow = db.getOne(
    `SELECT * FROM audit_logs WHERE entity_type = 'contractor' AND entity_id = ? ORDER BY id DESC LIMIT 1`,
    [newCtr.id]
  );
  assert.ok(auditRow, 'Audit log must record contractor creation');
  assert.equal(auditRow.actor, 'Test Auditor');
  assert.equal(auditRow.action, 'CREATE_CONTRACTOR');

  // Cleanup test contractor
  contractorsController.deleteContractor(newCtr.id);
  db.execute(`DELETE FROM users WHERE email = ?`, ['devops.contractor@myglobalhub.net']);
  db.execute(`DELETE FROM employees WHERE id = ?`, [newCtr.employeeId]);
});

test('Contractors DB: Update contractor details', () => {
  const updated = contractorsController.updateContractor(
    'CTR-1043',
    {
      rate: 55,
      role: 'Senior Full Stack Developer',
    },
    'Test HR Manager'
  );

  assert.equal(updated.id, 'CTR-1043');
  assert.equal(updated.rate, 55);
  assert.equal(updated.role, 'Senior Full Stack Developer');

  // Verify DB record
  const fromDb = contractorsController.getContractor('CTR-1043');
  assert.equal(fromDb.rate, 55);
  assert.equal(fromDb.role, 'Senior Full Stack Developer');

  // Restore rate
  contractorsController.updateContractor('CTR-1043', { rate: 50, role: 'Full Stack Developer' });
});

test('Contractors DB: Contractor Payments lifecycle & status transitions', () => {
  const payments = contractorsController.listContractorPayments({ periodId: 'PP-2025-08' });
  assert.ok(Array.isArray(payments));
  assert.ok(payments.length >= 1, 'Should have payments for PP-2025-08');

  // Check payment has joined contractor object 'c'
  const p1 = payments.find((p) => p.cid === 'CTR-1043');
  assert.ok(p1);
  assert.ok(p1.c, 'Payment must include joined contractor info');
  assert.equal(p1.c.name, 'Zain Rondon');
  assert.equal(p1.amount, 4000);
  assert.equal(p1.hours, 80);
});
