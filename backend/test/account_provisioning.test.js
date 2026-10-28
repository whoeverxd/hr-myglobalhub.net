const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');
const employees = require('../src/controllers/employees.controller');
const contractors = require('../src/controllers/contractors.controller');
const authService = require('../src/services/auth.service');

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);
const newEmp = (email, extra = {}) => ({ firstName: 'Acc', lastName: 'Test', fullName: 'Acc Test', name: 'Acc Test', email, title: 'Developer', dept: 'Engineering', entity: 'MGH Dominicana SRL', etype: 'Full-Time', rate: 10, ...extra });
const cleanup = (email) => {
  const u = db.getOne('SELECT id, employee_id FROM users WHERE LOWER(email) = ?', [email]);
  if (u) { try { db.execute('DELETE FROM sessions WHERE user_id = ?', [u.id]); } catch (_) {} db.execute('DELETE FROM users WHERE id = ?', [u.id]); }
  for (const e of db.query('SELECT id FROM employees WHERE LOWER(email) = ?', [email])) {
    try { db.execute('DELETE FROM project_members WHERE user_id = ?', [e.id]); } catch (_) {}
    try { db.execute('DELETE FROM contractors WHERE employee_id = ?', [e.id]); } catch (_) {}
    db.execute('DELETE FROM employees WHERE id = ?', [e.id]);
  }
};

test('A weak password typed by the administrator is rejected before anything is saved', () => {
  const email = `acc-weak-${uniq()}@example.test`;
  assert.throws(() => employees.createEmployee(newEmp(email, { password: '123' })), (e) => e.status === 400);
  assert.equal(db.getOne('SELECT id FROM employees WHERE LOWER(email) = ?', [email]), null, 'no employee left behind');
  assert.equal(db.getOne('SELECT id FROM users WHERE LOWER(email) = ?', [email]), null, 'no login left behind');
  assert.throws(() => contractors.createContractor({ name: 'Ctr Weak', role: 'Dev', email, password: 'abc' }), (e) => e.status === 400);
  cleanup(email);
});

test('Account status is reported: created, linked (existing Google login) and conflict', () => {
  const email = `acc-status-${uniq()}@example.test`;
  const created = employees.createEmployee(newEmp(email));
  assert.equal(created.account.status, 'created');
  assert.ok(created.initialPassword);

  // Same email for another employee → the other person's login is never taken over
  const other = employees.createEmployee(newEmp(email));
  assert.equal(other.account.status, 'conflict');
  assert.equal(other.account.linkedEmployeeId, created.id);
  assert.equal(db.getOne('SELECT employee_id FROM users WHERE LOWER(email) = ?', [email]).employee_id, created.id);
  cleanup(email);

  // Someone who signed in with Google first (login without employee) gets linked, no new password
  const gEmail = `acc-google-${uniq()}@example.test`;
  db.execute(`INSERT INTO users (id, email, password_hash, salt, name, role, entity, is_active) VALUES (?, ?, '', '', 'G User', 'employee', 'MGH Dominicana SRL', 1)`, ['usr_g_' + uniq(), gEmail]);
  const linked = employees.createEmployee(newEmp(gEmail));
  assert.equal(linked.account.status, 'linked');
  assert.equal(linked.initialPassword, undefined);
  assert.equal(db.getOne('SELECT employee_id FROM users WHERE LOWER(email) = ?', [gEmail]).employee_id, linked.id);
  cleanup(gEmail);
});

test('The temporary password must be replaced before the account can use the API', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, token, body) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };

  const email = `acc-force-${uniq()}@example.test`;
  const created = employees.createEmployee(newEmp(email));
  let r = await call('POST', '/auth/login', null, { email, password: created.initialPassword });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.mustChangePassword, true);
  const token = r.data.token;

  r = await call('GET', '/timesheets', token);
  assert.equal(r.status, 403);
  assert.equal(r.data.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await call('GET', '/auth/me', token)).data.user.mustChangePassword, true, '/auth/me still works');

  r = await call('POST', '/auth/password', token, { currentPassword: created.initialPassword, newPassword: 'MyOwnPassword2026' });
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/timesheets', token)).status, 200, 'unblocked after the change');
  assert.equal((await call('GET', '/auth/me', token)).data.user.mustChangePassword, false);
  assert.ok(authService.authenticateUser(email, 'MyOwnPassword2026'));
  assert.equal(authService.authenticateUser(email, created.initialPassword), null, 'the temporary password stops working');
  cleanup(email);
});
