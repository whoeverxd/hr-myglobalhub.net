const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const routes = require('../src/routes');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

test('Leave flow: employee request (frontend payload) is stored and visible to reviewers until decided', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  // This request is this test's own data. Leaving it behind used to be invisible; now that an overlapping
  // request is refused, the leftover from the previous run makes the next one fail.
  const db = require('../src/db');
  const clean = () => db.execute(
    `DELETE FROM leave_requests WHERE employee_id = 'MGH-1043' AND from_date = '2025-09-08' AND to_date = '2025-09-09'`
  );
  clean();
  t.after(() => { clean(); server.close(); });
  const login = async (email) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.equal(r.status, 200);
    const d = await r.json();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${d.token}` };
  };
  const emp = await login('zain@myglobalhub.net'); // contractor MGH-1043
  const admin = await login('edwin@myglobalhub.net'); // admin

  // Exactly what the Leave screen sends (empId/name are forced to the caller by the backend for employees)
  let r = await fetch(`${base}/leave`, { method: 'POST', headers: emp, body: JSON.stringify({ empId: 'MGH-1043', name: 'Zain Rondon', type: 'Personal', fromDate: '2025-09-08', toDate: '2025-09-09', reason: 'Trámite' }) });
  assert.equal(r.status, 201);
  const created = await r.json();
  assert.equal(created.status, 'Pending Supervisor');

  r = await fetch(`${base}/leave`, { headers: admin });
  assert.ok((await r.json()).some((l) => l.id === created.id), 'reviewer sees the new request');
  r = await fetch(`${base}/leave`, { headers: emp });
  assert.ok((await r.json()).every((l) => l.emp === 'MGH-1043'), 'employee only sees their own');

  // Employee may cancel their own pending request, but not approve it
  r = await fetch(`${base}/leave/${created.id}/review`, { method: 'PATCH', headers: emp, body: JSON.stringify({ action: 'approve' }) });
  assert.equal(r.status, 403);
  r = await fetch(`${base}/leave/${created.id}/review`, { method: 'PATCH', headers: admin, body: JSON.stringify({ action: 'approve' }) });
  assert.equal((await r.json()).status, 'Pending HR');
  r = await fetch(`${base}/leave/${created.id}/review`, { method: 'PATCH', headers: admin, body: JSON.stringify({ action: 'approve' }) });
  assert.equal((await r.json()).status, 'Approved');
});

test('Leave: translated types are stored canonically, unpaid stays unpaid, overlapping requests are refused', async (t) => {
  const db = require('../src/db');
  const leave = require('../src/controllers/leave.controller');
  const timesheets = require('../src/controllers/timesheets.controller');
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const EMP = 'MGH-1043';
  const clean = () => db.execute(`DELETE FROM leave_requests WHERE employee_id = ? AND from_date >= '2025-10-01' AND to_date <= '2025-10-15'`, [EMP]);
  clean();
  t.after(() => { clean(); server.close(); });
  const r0 = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'zain@myglobalhub.net', password: 'Password123!' }) });
  const emp = { 'Content-Type': 'application/json', Authorization: `Bearer ${(await r0.json()).token}` };
  const post = (body) => fetch(`${base}/leave`, { method: 'POST', headers: emp, body: JSON.stringify({ empId: EMP, ...body }) });

  // The on-screen label "Sin goce de sueldo" is stored as Unpaid and reported as not paid
  let r = await post({ type: 'Sin goce de sueldo', fromDate: '2025-10-06', toDate: '2025-10-07' });
  assert.equal(r.status, 201);
  const unpaid = await r.json();
  assert.equal(unpaid.type, 'Unpaid');
  assert.equal(unpaid.paid, false);
  assert.equal(db.getOne('SELECT type FROM leave_requests WHERE id = ?', [unpaid.id]).type, 'Unpaid');

  // Same days again (only the type changed) → refused, nothing saved
  r = await post({ type: 'Vacaciones', fromDate: '2025-10-07', toDate: '2025-10-09' });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, new RegExp(unpaid.id));
  assert.equal(db.query(`SELECT id FROM leave_requests WHERE employee_id = ? AND from_date >= '2025-10-01' AND to_date <= '2025-10-15'`, [EMP]).length, 1);

  assert.equal((await post({ type: 'Nope', fromDate: '2025-10-13', toDate: '2025-10-13' })).status, 400);
  assert.equal((await post({ type: 'Vacation', fromDate: '2025-10-13', toDate: '2025-10-10' })).status, 400);

  // Cancelling it (as the employee) frees the dates; the history records the employee
  r = await fetch(`${base}/leave/${unpaid.id}/review`, { method: 'PATCH', headers: emp, body: JSON.stringify({ action: 'cancel' }) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).history.slice(-1)[0].role, 'Employee');
  r = await post({ type: 'Vacaciones', fromDate: '2025-10-06', toDate: '2025-10-07' });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).type, 'Vacation');

  // Payroll: a legacy row stored with the Spanish label is NOT paid leave
  db.execute(`DELETE FROM leave_requests WHERE employee_id = ? AND from_date >= '2025-10-01' AND to_date <= '2025-10-15'`, [EMP]);
  db.execute(`INSERT INTO leave_requests (id, employee_id, employee_name, type, from_date, to_date, status, history_json) VALUES (?, ?, 'Zain', 'Sin goce de sueldo', '2025-10-08', '2025-10-08', 'Approved', '[]')`, ['LV-T-UNPAID-' + Date.now(), EMP]);
  assert.equal(timesheets.computeHours(EMP, 'PP-2025-19').pto, 0);
  assert.equal(leave.isPaidLeave('Vacaciones'), true);
});
