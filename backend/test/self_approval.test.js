// Nobody but the admin decides about their own money or their own leave.
// The same rule timesheets enforce in reviewStepError, on the two paths that were missing it.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');
const employees = require('../src/controllers/employees.controller');
const periods = require('../src/controllers/periods.controller');

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);

function server() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

const make = (systemRole) => {
  const email = `self-${uniq()}@example.test`;
  const name = 'Self ' + uniq();
  const emp = employees.createEmployee({
    firstName: 'Self', lastName: 'Test', fullName: name, name, email, title: 'Developer',
    dept: 'Engineering', entity: 'MGH Dominicana SRL', etype: 'Full-Time', rate: 10, systemRole,
  });
  return { emp, email };
};

test('A reviewer cannot post or approve a payroll adjustment on their own record', async (t) => {
  const srv = server();
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  t.after(() => srv.close());

  const pm = make('pm');
  const other = make();
  const admin = make('admin');
  const P = periods.listPeriods(2027).find((p) => !p.isLocked).id;

  const as = (who) => async (method, path, body) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-user-email': who },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };
  const callPm = as(pm.email);
  const callAdmin = as(admin.email);

  // The money path: posting is open to supervisors and up, approving to PM and up. That split means nothing
  // if the same person can be on both sides AND be the payee.
  let r = await callPm('POST', '/adjustments', { employeeId: pm.emp.id, periodId: P, type: 'Bonus', amt: 10000 });
  assert.equal(r.status, 403, 'a PM must not post an adjustment on their own record');
  assert.match(r.data.error, /your own record/);

  // Somebody else's adjustment is still their job
  r = await callPm('POST', '/adjustments', { employeeId: other.emp.id, periodId: P, type: 'Bonus', amt: 100 });
  assert.equal(r.status, 201, "posting on another employee's record is the PM's job");
  const theirs = r.data.id;
  r = await callPm('PATCH', `/adjustments/${theirs}`, { status: 'Approved' });
  assert.equal(r.status, 200, 'and approving it too');

  // Approving one that points at themselves is refused even when somebody else created it
  r = await callAdmin('POST', '/adjustments', { employeeId: pm.emp.id, periodId: P, type: 'Bonus', amt: 10000 });
  assert.equal(r.status, 201, 'an admin may post it');
  const mine = r.data.id;
  r = await callPm('PATCH', `/adjustments/${mine}`, { status: 'Approved' });
  assert.equal(r.status, 403, 'the payee must not be the one approving it');
  assert.match(r.data.error, /your own record/);
  r = await callAdmin('PATCH', `/adjustments/${mine}`, { status: 'Approved' });
  assert.equal(r.status, 200, 'the admin is the documented exception');

  db.execute('DELETE FROM payroll_adjustments WHERE id IN (?, ?)', [theirs, mine]);
  for (const x of [pm, other, admin]) employees.deleteEmployee(x.emp.id, { id: 'u', name: 'Cleanup', role: 'admin' });
});

test('A reviewer cannot approve their own leave request, but may still cancel it', async (t) => {
  const srv = server();
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  t.after(() => srv.close());

  const pm = make('pm');
  const as = (who) => async (method, path, body) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-user-email': who },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };
  const callPm = as(pm.email);

  const id = 'LV-self-' + uniq();
  db.execute(
    `INSERT INTO leave_requests (id, employee_id, employee_name, type, from_date, to_date, status, reason, history_json)
     VALUES (?, ?, ?, 'Vacaciones', '2027-03-01', '2027-03-05', 'Pending Supervisor', 'x', '[]')`,
    [id, pm.emp.id, pm.emp.name]
  );

  let r = await callPm('PATCH', `/leave/${id}/review`, { action: 'approve' });
  assert.equal(r.status, 403, 'a PM must not approve their own leave');
  assert.match(r.data.error, /your own leave request/);
  r = await callPm('PATCH', `/leave/${id}/review`, { action: 'reject' });
  assert.equal(r.status, 403, 'nor reject it');

  // Giving up your own request is yours to do
  r = await callPm('PATCH', `/leave/${id}/review`, { action: 'cancel' });
  assert.equal(r.status, 200, 'cancelling your own request stays allowed');
  assert.equal(db.getOne('SELECT status FROM leave_requests WHERE id = ?', [id]).status, 'Cancelled');

  db.execute('DELETE FROM leave_requests WHERE id = ?', [id]);
  employees.deleteEmployee(pm.emp.id, { id: 'u', name: 'Cleanup', role: 'admin' });
});
