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

test('Review flow: employee submits → PM comments & partially approves → owner-only second review → Approved', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());
  const login = async (email) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.equal(r.status, 200, 'login ' + email);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${(await r.json()).token}` };
  };
  const call = async (h, method, path, body) => {
    const r = await fetch(`${base}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };
  const luis = await login('luis@myglobalhub.net'); // MGH-1044 employee
  const pm = await login('joshua@myglobalhub.net'); // MGH-1042 pm
  const owner = await login('edwin@myglobalhub.net'); // admin / owner
  const empId = 'MGH-1044', periodId = 'PP-2025-23', sheet = `TS-${periodId}-${empId}`; // 1–15 December 2025
  db.execute('DELETE FROM timesheets WHERE id = ?', [sheet]);
  db.execute('DELETE FROM daily_activities WHERE employee_id = ? AND date >= ? AND date <= ?', [empId, '2025-12-01', '2025-12-15']);

  // 1. Employee logs work against tasks and submits
  const a1 = (await call(luis, 'POST', '/activities', { date: '2025-12-01', hours: 8, jiraKey: 'ARW-1', description: 'Checkout' })).data;
  const a2 = (await call(luis, 'POST', '/activities', { date: '2025-12-02', hours: 6, jiraKey: 'ARW-2', description: 'Refactor' })).data;
  await call(luis, 'POST', '/timesheets/ensure', { periodId });
  let r = await call(luis, 'POST', `/timesheets/${sheet}/submit`);
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 14);

  // 2. Employee cannot review their own sheet; the PM comments (persisted) and partially approves
  assert.equal((await call(luis, 'POST', `/timesheets/${sheet}/activities/${a2.id}/review`, { approvedHours: 6 })).status, 403);
  r = await call(pm, 'POST', `/timesheets/${sheet}/comments`, { comment: 'Revisando el refactor del martes' });
  assert.equal(r.status, 200);
  assert.ok(r.data.history.some((h) => h.type === 'comment' && /refactor/.test(h.comment)));
  assert.equal((await call(pm, 'POST', `/timesheets/${sheet}/activities/${a2.id}/review`, { approvedHours: 3 })).status, 400, 'reason required');
  r = await call(pm, 'POST', `/timesheets/${sheet}/activities/${a2.id}/review`, { approvedHours: 3, comment: 'Solo 3h justificadas en el PR' });
  assert.equal(r.status, 200);
  assert.equal(r.data.reviewStatus, 'partial');
  assert.equal((await call(pm, 'POST', `/timesheets/${sheet}/activities/${a1.id}/review`, { approvedHours: 8 })).data.reviewStatus, 'approved');

  // The employee sees the decision on their activities
  const mine = (await call(luis, 'GET', `/activities?dateFrom=2025-12-01&dateTo=2025-12-15`)).data;
  const reviewed = mine.find((x) => x.id === a2.id);
  assert.equal(reviewed.approvedHours, 3);
  assert.match(reviewed.reviewComment, /3h justificadas/);

  // 3. PM approves: the sheet now carries only the approved hours and moves to the owner step
  r = await call(pm, 'POST', `/timesheets/${sheet}/approve`, { comment: 'OK salvo el martes', role: 'pm' });
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 11);
  assert.ok(r.data.history.some((h) => /3h rechazadas/.test(h.comment || '')));

  // 4. The second review is the owner's alone
  assert.equal((await call(pm, 'POST', `/timesheets/${sheet}/approve`, { role: 'pm' })).status, 403);
  assert.equal((await call(pm, 'POST', `/timesheets/${sheet}/return`, { comment: 'x' })).status, 403);
  assert.equal((await call(pm, 'POST', `/timesheets/${sheet}/activities/${a1.id}/review`, { approvedHours: 1, comment: 'x' })).status, 403);
  r = await call(owner, 'POST', `/timesheets/${sheet}/approve`, { comment: 'Aprobado para pago', role: 'admin' });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'Approved');
  assert.equal(r.data.total, 11);

  // 5. Only the owner marks a payroll run as paid
  assert.equal((await call(pm, 'POST', `/payroll/runs/PR-${periodId}/paid`)).status, 403);
});
