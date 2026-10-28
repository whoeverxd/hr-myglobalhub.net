const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');
const contractorsController = require('../src/controllers/contractors.controller');

const PLACEHOLDERS = ['0x3aB858B5d06456EaFeEfa24e86895315B91a9F12', '0x3aB8…9F12', 'Banco BHD León', '2039485761', '+1 809 555 0192', '+1 555-0100', 'Feb 10, 2024'];

test('Contractor type never changes an existing login role', () => {
  // Joshua (MGH-1042) is pm; mark him as Contractor and run the sync (what every dashboard load does)
  const before = db.getOne(`SELECT type FROM employees WHERE id = 'MGH-1042'`);
  db.execute(`UPDATE employees SET type = 'Contractor' WHERE id = 'MGH-1042'`);
  try {
    contractorsController.listContractors();
    const roles = db.query(`SELECT role FROM users WHERE employee_id = 'MGH-1042'`).map((u) => u.role);
    assert.ok(roles.length > 0);
    assert.ok(roles.every((r) => r === 'pm'), 'pm stays pm: ' + roles.join(','));
  } finally {
    db.execute(`UPDATE employees SET type = ? WHERE id = 'MGH-1042'`, [before.type]);
    db.execute(`DELETE FROM contractors WHERE employee_id = 'MGH-1042'`);
  }
});

test('Synced contractor rows carry no invented payment or contact data', () => {
  const id = 'MGH-7701';
  db.execute(`DELETE FROM contractors WHERE employee_id = ?`, [id]);
  db.execute(`DELETE FROM users WHERE employee_id = ?`, [id]);
  db.execute(`DELETE FROM employees WHERE id = ?`, [id]);
  db.execute(
    `INSERT INTO employees (id, name, role, dept, type, entity, status, email) VALUES (?, 'Prueba Sync', 'Dev', '', 'Contractor', 'MGH Dominicana SRL', 'Active', 'prueba.sync@myglobalhub.net')`,
    [id]
  );
  try {
    contractorsController.listContractors();
    const c = db.getOne(`SELECT * FROM contractors WHERE employee_id = ?`, [id]);
    assert.ok(c, 'contractor row created');
    for (const v of Object.values(c)) assert.ok(!PLACEHOLDERS.includes(v), 'placeholder value found: ' + v);
    assert.equal(Number(c.rate), 0);
    const u = db.getOne(`SELECT role FROM users WHERE employee_id = ?`, [id]);
    assert.equal(u.role, 'employee', 'new login defaults to employee');
  } finally {
    db.execute(`DELETE FROM contractors WHERE employee_id = ?`, [id]);
    db.execute(`DELETE FROM users WHERE employee_id = ?`, [id]);
    db.execute(`DELETE FROM employees WHERE id = ?`, [id]);
  }
});

test('createContractor: no invented email/data; existing role kept', () => {
  const noEmail = contractorsController.createContractor({ name: 'Sin Correo Prueba', role: 'Designer' });
  try {
    assert.equal(noEmail.account.status, 'none');
    const emp = db.getOne(`SELECT * FROM employees WHERE id = ?`, [noEmail.employeeId]);
    assert.ok(!emp.email, 'no invented email');
    assert.ok(!emp.mgr && !emp.project, 'no invented manager/project');
    const row = db.getOne(`SELECT * FROM contractors WHERE id = ?`, [noEmail.id]);
    for (const v of Object.values(row)) assert.ok(!PLACEHOLDERS.includes(v), 'placeholder value found: ' + v);
  } finally {
    db.execute(`DELETE FROM contractors WHERE id = ?`, [noEmail.id]);
    db.execute(`DELETE FROM employees WHERE id = ?`, [noEmail.employeeId]);
  }
  // Linking an existing pm login keeps pm
  const linked = contractorsController.createContractor({ name: 'Joshua Hernandez', role: 'PM', email: 'joshua@myglobalhub.net', employeeId: 'MGH-1042' });
  try {
    assert.equal(db.getOne(`SELECT role FROM users WHERE LOWER(email) = 'joshua@myglobalhub.net'`).role, 'pm');
  } finally {
    db.execute(`DELETE FROM contractors WHERE id = ?`, [linked.id]);
  }
});

test('POST /contractor-payments is gone: payments go through payroll', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'edwin@myglobalhub.net', password: 'Password123!' }) });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${(await login.json()).token}` };
  const r = await fetch(`${base}/contractor-payments`, { method: 'POST', headers: h, body: JSON.stringify({ contractorId: 'CTR-1043', amount: 100 }) });
  assert.equal(r.status, 410);
  assert.match((await r.json()).error, /nómina/);
  assert.equal((await fetch(`${base}/contractor-payments`, { headers: h })).status, 200, 'history still readable');
});
