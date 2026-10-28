const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

test('My timesheet rules: employee owns Draft, submission locks it, nobody edits others or approves themselves', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());

  const login = async (email) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.equal(r.status, 200, 'seeded login for ' + email);
    const d = await r.json();
    return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${d.token}` }, user: d.user };
  };
  const call = (auth, method, path, body) => fetch(`${base}${path}`, { method, headers: auth.headers, body: body ? JSON.stringify(body) : undefined });

  const emp = await login('luis@myglobalhub.net'); // MGH-1044, employee
  const pm = await login('joshua@myglobalhub.net'); // MGH-1042, pm
  const empId = emp.user.employeeId;
  const periodId = 'PP-2025-15'; // 1–15 August 2025
  db.execute('DELETE FROM timesheets WHERE employee_id IN (?, ?) AND period_id = ?', [empId, pm.user.employeeId, periodId]);
  db.execute('DELETE FROM daily_activities WHERE employee_id IN (?, ?) AND date >= ? AND date <= ?', [empId, pm.user.employeeId, '2025-08-01', '2025-08-15']);

  // Employee logs an activity while the period is Draft
  let r = await call(emp, 'POST', '/activities', { date: '2025-08-04', hours: 6, jiraKey: 'TRS-1', description: 'Treslog API' });
  assert.equal(r.status, 201);
  const act = await r.json();

  // A PM cannot write activities for somebody else
  r = await call(pm, 'POST', '/activities', { employeeId: empId, date: '2025-08-05', hours: 2, description: 'x' });
  assert.equal(r.status, 403);

  // Live preview of the draft (the view ensures the current sheet exists first)
  await call(emp, 'POST', '/timesheets/ensure', { periodId });
  r = await call(emp, 'GET', `/timesheets?periodId=${periodId}&live=1`);
  let sheets = await r.json();
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].reg + sheets[0].ot, 6);

  // Submit freezes hours and locks the period for the employee
  r = await call(emp, 'POST', `/timesheets/TS-${periodId}-${empId}/submit`);
  assert.equal(r.status, 200);
  r = await call(emp, 'POST', '/activities', { date: '2025-08-06', hours: 1, description: 'late' });
  assert.equal(r.status, 409, 'cannot add to a submitted quincena');
  r = await call(emp, 'DELETE', `/activities/${act.id}`);
  assert.equal(r.status, 409, 'cannot delete from a submitted quincena');

  // PM returns it with a reason → employee can edit again
  r = await call(pm, 'POST', `/timesheets/TS-${periodId}-${empId}/return`, { comment: 'Add the Friday deploy' });
  assert.equal(r.status, 200);
  r = await call(emp, 'POST', '/activities', { date: '2025-08-08', hours: 2, jiraKey: 'TRS-1', description: 'Deploy' });
  assert.equal(r.status, 201);

  // The PM's own timesheet cannot be approved by the PM
  r = await call(pm, 'POST', '/activities', { date: '2025-08-04', hours: 8, jiraKey: 'MGH-1', description: 'Planning' });
  assert.equal(r.status, 201);
  await call(pm, 'POST', '/timesheets/ensure', { empId: pm.user.employeeId, periodId });
  r = await call(pm, 'POST', `/timesheets/TS-${periodId}-${pm.user.employeeId}/submit`);
  assert.equal(r.status, 200);
  r = await call(pm, 'POST', `/timesheets/TS-${periodId}-${pm.user.employeeId}/approve`, { role: 'pm' });
  assert.equal(r.status, 403);
});

test('Pay periods are never created Closed by the calendar (only Open once started, else Draft)', () => {
  const { buildPeriods } = require('../src/payroll');
  const today = new Date().toISOString().slice(0, 10);
  for (const p of buildPeriods(Number(today.slice(0, 4)))) {
    assert.equal(p.status, p.start <= today ? 'Open' : 'Draft', p.id);
    assert.equal(p.locked, false, p.id);
  }
});
