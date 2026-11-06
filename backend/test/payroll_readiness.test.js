const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');
const payoutMethods = require('../src/services/payout-methods.service');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

test('GET /payroll/readiness: sheets, payout readiness (no details), run and company bank ids from live data', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());
  const login = async (email) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.equal(r.status, 200, 'login ' + email);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${(await r.json()).token}` };
  };
  const get = async (h, path) => { const r = await fetch(base + path, { headers: h }); return { status: r.status, data: await r.json().catch(() => null) }; };
  const admin = await login('edwin@myglobalhub.net');
  const luis = await login('luis@myglobalhub.net'); // employee

  const P = 'PP-2099-01';
  const ids = ['MGH-1043', 'MGH-1044', 'MGH-1046'];
  db.execute('DELETE FROM timesheets WHERE period_id = ?', [P]);
  db.execute('DELETE FROM payroll_runs WHERE period_id = ?', [P]);
  if (!db.getOne('SELECT id FROM pay_periods WHERE id = ?', [P])) {
    db.execute(`INSERT INTO pay_periods (id, year, period_number, start_date, end_date, pay_date, cutoff, status) VALUES (?, 2099, 1, '2099-01-01', '2099-01-15', '2099-01-20', '2099-01-15', 'Open')`, [P]);
  }
  for (const id of ids) db.execute('DELETE FROM payout_methods WHERE employee_id = ? AND created_by = ?', [id, 'readiness-test']);
  const sheet = (emp, status) => db.execute(
    `INSERT INTO timesheets (id, employee_id, employee_name, period_id, status, step_index, regular_hours, overtime_hours, pto_hours, holiday_hours, total_hours)
     VALUES (?, ?, ?, ?, ?, 0, 40, 0, 0, 0, 40)`, [`ts-ready-${emp}`, emp, 'Persona ' + emp, P, status]);
  sheet('MGH-1043', 'Approved');
  sheet('MGH-1044', 'Approved');
  sheet('MGH-1046', 'Awaiting PM');

  assert.equal((await get(luis, `/payroll/readiness?periodId=${P}`)).status, 403);
  assert.equal((await get(admin, '/payroll/readiness')).status, 400);

  const r = (await get(admin, `/payroll/readiness?periodId=${P}`)).data;
  assert.equal(r.sheets.total, 3);
  assert.equal(r.sheets.approved, 2);
  assert.deepEqual(r.sheets.pending.map((s) => s.employeeId), ['MGH-1046']);
  assert.deepEqual(r.payout.map((p) => p.employeeId).sort(), ['MGH-1043', 'MGH-1044'], 'only people with an approved sheet');
  assert.ok(r.payout.every((p) => !('details' in p)), 'never payout details');
  assert.equal(r.run, null);

  // The readiness rule itself: verified primary → ready, only a pending one → pending, nothing → missing
  const now = new Date().toISOString();
  const add = (emp, status, primary) => db.execute(
    `INSERT INTO payout_methods (id, employee_id, type, details_json, is_primary, wants_primary, status, created_by, created_at, updated_at)
     VALUES (?, ?, 'bank', ?, ?, 0, ?, 'readiness-test', ?, ?)`,
    [`pm-ready-${emp}-${status}`, emp, JSON.stringify({ bank_name: 'Banco Test', account_type: 'Ahorro', account_number: '123456789', holder: 'Test' }), primary ? 1 : 0, status, now, now]);
  db.execute('DELETE FROM payout_methods WHERE employee_id IN (?, ?)', ['MGH-9901', 'MGH-9902']);
  add('MGH-9901', 'verified', true);
  add('MGH-9902', 'pending', false);
  const byEmp = Object.fromEntries(payoutMethods.readiness(['MGH-9901', 'MGH-9902', 'MGH-9903']).map((x) => [x.employeeId, x]));
  assert.equal(byEmp['MGH-9901'].status, 'ready');
  assert.equal(byEmp['MGH-9901'].channel, 'bank');
  assert.equal(byEmp['MGH-9902'].status, 'pending');
  assert.equal(byEmp['MGH-9903'].status, 'missing');

  db.execute('DELETE FROM payout_methods WHERE employee_id IN (?, ?)', ['MGH-9901', 'MGH-9902']);
  db.execute('DELETE FROM timesheets WHERE period_id = ?', [P]);
  db.execute('DELETE FROM pay_periods WHERE id = ?', [P]);
});
