const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');
const timesheets = require('../src/controllers/timesheets.controller');
const activities = require('../src/controllers/activities.controller');
const leave = require('../src/controllers/leave.controller');
const periods = require('../src/controllers/periods.controller');
const employees = require('../src/controllers/employees.controller');
const workflows = require('../src/controllers/workflows.controller');
const engine = require('../src/services/payroll-engine.service');
const { buildPeriods } = require('../src/payroll');
const { todayLocal } = require('../src/utils/today');

const LUIS = 'MGH-1044';
const ADMIN_ACTOR = { id: 'U-consistency-test', role: 'admin', name: 'Test Admin' };

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

function rangeOf(periodId) {
  return buildPeriods(Number(periodId.slice(3, 7))).find((p) => p.id === periodId);
}

// Wipe everything a test period may hold, so each scenario starts clean (the test DB is shared by the suites)
function resetPeriod(periodId, empId = LUIS) {
  const r = rangeOf(periodId);
  db.execute('DELETE FROM timesheets WHERE period_id = ?', [periodId]);
  db.execute('DELETE FROM daily_activities WHERE employee_id = ? AND date >= ? AND date <= ?', [empId, r.start, r.end]);
  db.execute('DELETE FROM leave_requests WHERE employee_id = ? AND to_date >= ? AND from_date <= ?', [empId, r.start, r.end]);
  db.execute('DELETE FROM payroll_run_items WHERE run_id = ?', [`PR-${periodId}`]);
  db.execute('DELETE FROM payroll_runs WHERE id = ?', [`PR-${periodId}`]);
  db.execute(`UPDATE pay_periods SET status = 'Open', is_locked = 0 WHERE id = ?`, [periodId]);
}

// An approved sheet ready to be paid
function approvedSheet(periodId, empId = LUIS, hours = 10) {
  db.execute(
    `INSERT INTO timesheets (id, employee_id, employee_name, period_id, status, step_index, regular_hours, overtime_hours, pto_hours, holiday_hours, total_hours, history_json)
     VALUES (?, ?, ?, ?, 'Approved', 2, ?, 0, 0, 0, ?, '[]')`,
    [`TS-${periodId}-${empId}`, empId, empId, periodId, hours, hours]
  );
}

test('1. Adjustments belong to one employee + period and are paid once', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());
  const r0 = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'edwin@myglobalhub.net', password: 'Password123!' }) });
  assert.equal(r0.status, 200);
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${(await r0.json()).token}` };
  const call = async (method, path, body) => {
    const r = await fetch(`${base}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };

  periods.listPeriods(2024);
  const P1 = 'PP-2024-03', P2 = 'PP-2024-05';
  resetPeriod(P1); resetPeriod(P2);
  db.execute(`DELETE FROM payroll_adjustments WHERE id LIKE 'ADJ-CONS-%' OR employee_id = ?`, [LUIS]);
  const luis = db.getOne('SELECT name FROM employees WHERE id = ?', [LUIS]);

  // Old payload (name only) is refused: no employee / period means it could be paid to anybody, any time
  let r = await call('POST', '/adjustments', { name: luis.name, type: 'Bonus', amt: 100 });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /employeeId y periodId requeridos/);
  r = await call('POST', '/adjustments', { empId: LUIS, periodId: 'not-a-period', type: 'Bonus', amt: 100 });
  assert.equal(r.status, 400);
  r = await call('POST', '/adjustments', { empId: 'NOPE-1', periodId: P1, type: 'Bonus', amt: 100 });
  assert.equal(r.status, 404);

  // New payload: both aliases accepted, the name comes from the employee record
  r = await call('POST', '/adjustments', { empId: LUIS, periodId: P1, type: 'Bonus', amt: 100 });
  assert.equal(r.status, 201);
  assert.equal(r.data.employeeId, LUIS);
  assert.equal(r.data.periodId, P1);
  assert.equal(r.data.name, luis.name);
  assert.equal(r.data.paidRunId, null);
  const adjP1 = r.data.id;
  r = await call('POST', '/adjustments', { employeeId: LUIS, period: P2, type: 'Deduction', amt: -40 });
  assert.equal(r.status, 201);
  const adjP2 = r.data.id;
  for (const id of [adjP1, adjP2]) assert.equal((await call('PATCH', `/adjustments/${id}`, { status: 'Approved' })).status, 200);

  // Legacy approved row (no employee_id) with Luis's name: never matched by name any more
  db.execute(
    `INSERT INTO payroll_adjustments (id, name, type, kind, amt, status) VALUES ('ADJ-CONS-LEGACY', ?, 'Old bonus', 'bonus', 999, 'Approved')`,
    [luis.name]
  );

  approvedSheet(P1);
  let run = engine.calculatePeriodPayroll({ periodId: P1, saveAsRun: true });
  let item = run.items.find((i) => i.employeeId === LUIS);
  assert.deepEqual(item.adjustments.map((a) => a.id), [adjP1], 'only the adjustment of this employee and this period');
  assert.equal(item.earnings.adjustments, 100);
  assert.ok(run.adjustmentsNotApplied.some((a) => a.id === 'ADJ-CONS-LEGACY' && /employee/i.test(a.reason)));

  engine.approvePayrollRun(run.id, 'Owner');
  engine.markPayrollRunPaid(run.id, 'Owner');
  assert.equal(db.getOne('SELECT paid_run_id FROM payroll_adjustments WHERE id = ?', [adjP1]).paid_run_id, run.id);
  assert.equal(db.getOne('SELECT paid_run_id FROM payroll_adjustments WHERE id = ?', [adjP2]).paid_run_id, null);
  // a paid adjustment can't change any more
  assert.equal((await call('PATCH', `/adjustments/${adjP1}`, { status: 'Rejected' })).status, 409);

  // Next period: only its own adjustment, never again the paid one (even if re-pointed at the period)
  db.execute('UPDATE payroll_adjustments SET period_id = ? WHERE id = ?', [P2, adjP1]);
  approvedSheet(P2);
  run = engine.calculatePeriodPayroll({ periodId: P2, saveAsRun: true });
  item = run.items.find((i) => i.employeeId === LUIS);
  assert.deepEqual(item.adjustments.map((a) => a.id), [adjP2]);
  db.execute('UPDATE payroll_adjustments SET period_id = ? WHERE id = ?', [P1, adjP1]);

  // A paid run's period can't receive new adjustments
  r = await call('POST', '/adjustments', { empId: LUIS, periodId: P1, type: 'Bonus', amt: 5 });
  assert.equal(r.status, 409);

  // The employee sees their adjustments by employee id, not by name
  const listed = require('../src/controllers/adjustments.controller').listAdjustments(LUIS, 'Somebody Else');
  assert.ok(listed.some((a) => a.id === adjP1) && listed.some((a) => a.id === adjP2));

  // Removal preview / refusal look the adjustments up by employee_id
  const preview = employees.employeeRemovalPreview(LUIS, ADMIN_ACTOR);
  assert.ok(preview.blockers.some((b) => /adjustment/.test(b)), preview.blockers.join(', '));
  assert.ok(preview.willDelete.pendingAdjustments >= 2);

  t.after(() => {
    db.execute(`DELETE FROM payroll_adjustments WHERE id IN (?, ?, 'ADJ-CONS-LEGACY')`, [adjP1, adjP2]);
    resetPeriod(P1); resetPeriod(P2);
  });
});

test('2. A returned sheet shows the hours a resubmission will freeze (PM cuts ignored, decisions kept)', () => {
  const P = 'PP-2024-07'; // 1–15 April 2024
  resetPeriod(P);
  const a1 = activities.createActivity({ empId: LUIS, date: '2024-04-01', hours: 8, jiraKey: 'ARW-1', description: 'Checkout' });
  const a2 = activities.createActivity({ empId: LUIS, date: '2024-04-02', hours: 6, jiraKey: 'ARW-2', description: 'Refactor' });
  const sheet = timesheets.ensureTimesheet(LUIS, P, 'Luis');
  assert.equal(timesheets.submitTimesheet(sheet.id, 'Luis').total, 14);
  timesheets.reviewActivity(sheet.id, a2.id, { approvedHours: 3, comment: 'Solo 3h justificadas' }, 'PM');
  timesheets.returnTimesheet(sheet.id, { comment: 'Corrige el martes' }, 'PM');

  const live = timesheets.listTimesheets({ empId: LUIS, periodId: P, live: true })[0];
  assert.equal(live.status, 'Returned');
  assert.equal(live.total, 14, 'live hours = what submit will freeze');
  // the PM's decision is still visible to the employee
  assert.equal(Number(db.getOne('SELECT approved_hours FROM daily_activities WHERE id = ?', [a2.id]).approved_hours), 3);
  assert.equal(timesheets.computeHours(LUIS, P).total, 11, 'reviewed hours by default');
  assert.equal(timesheets.computeHours(LUIS, P, { ignoreReview: true }).total, 14);

  assert.equal(timesheets.submitTimesheet(sheet.id, 'Luis').total, live.total);
  assert.ok(a1.id);
  resetPeriod(P);
});

test('3. Terminated and Inactive employees get no auto-created sheets', () => {
  const P = 'PP-2024-09';
  db.execute('DELETE FROM timesheets WHERE period_id = ?', [P]);
  for (const [id, status] of [['TEST-TERM-1', 'Terminated'], ['TEST-INACT-1', 'Inactive']]) {
    db.execute('DELETE FROM employees WHERE id = ?', [id]);
    db.execute(
      `INSERT INTO employees (id, name, entity, dept, role, type, status) VALUES (?, ?, 'MGH Dominicana SRL', 'QA', 'Tester', 'Full-time', ?)`,
      [id, id, status]
    );
  }
  const rows = timesheets.listTimesheets({ periodId: P });
  assert.ok(rows.length > 0, 'active employees got their sheet');
  assert.ok(!rows.some((r) => r.emp === 'TEST-TERM-1' || r.emp === 'TEST-INACT-1'));
  // nor can they be added to a meeting
  assert.throws(
    () => activities.createMeeting({ empId: LUIS, date: '2024-05-06', hours: 1, workType: 'Reunión', description: 'Sync' }, ['TEST-INACT-1']),
    /inactive attendees/
  );
  db.execute('DELETE FROM timesheets WHERE period_id = ?', [P]);
  db.execute(`DELETE FROM employees WHERE id IN ('TEST-TERM-1', 'TEST-INACT-1')`);
});

test('4. Marking a run paid never re-opens a sealed period', () => {
  periods.listPeriods(2024);
  const P = 'PP-2024-11';
  resetPeriod(P);
  approvedSheet(P);
  const run = engine.calculatePeriodPayroll({ periodId: P, saveAsRun: true });
  engine.approvePayrollRun(run.id, 'Owner');
  db.execute(`UPDATE pay_periods SET status = 'Closed', is_locked = 1 WHERE id = ?`, [P]);
  assert.equal(engine.markPayrollRunPaid(run.id, 'Owner').status, 'Paid');
  const p = db.getOne('SELECT status, is_locked FROM pay_periods WHERE id = ?', [P]);
  assert.equal(p.status, 'Closed');
  assert.equal(Number(p.is_locked), 1);
  resetPeriod(P);
});

test('5. Only pending leave can be approved or rejected', () => {
  db.execute(`DELETE FROM leave_requests WHERE employee_id = ? AND from_date = '2024-05-20'`, [LUIS]);
  const req = leave.createLeaveRequest({ empId: LUIS, name: 'Luis', type: 'Personal', fromDate: '2024-05-20', toDate: '2024-05-20', reason: 'x' });
  assert.equal(leave.reviewLeaveRequest(req.id, { action: 'reject' }).status, 'Rejected');
  for (const action of ['approve', 'reject', 'cancel']) {
    assert.throws(() => leave.reviewLeaveRequest(req.id, { action }), (e) => e.status === 409);
  }
  const req2 = leave.createLeaveRequest({ empId: LUIS, name: 'Luis', type: 'Personal', fromDate: '2024-05-20', toDate: '2024-05-20', reason: 'y' });
  assert.equal(leave.reviewLeaveRequest(req2.id, { action: 'approve' }).status, 'Pending HR');
  assert.equal(leave.reviewLeaveRequest(req2.id, { action: 'approve' }).status, 'Approved');
  assert.throws(() => leave.reviewLeaveRequest(req2.id, { action: 'approve' }), (e) => e.status === 409);
  assert.throws(() => leave.reviewLeaveRequest(req2.id, { action: 'reject' }), (e) => e.status === 409);
  // an approved leave may still be cancelled
  assert.equal(leave.reviewLeaveRequest(req2.id, { action: 'cancel' }).status, 'Cancelled');
  db.execute(`DELETE FROM leave_requests WHERE employee_id = ? AND from_date = '2024-05-20'`, [LUIS]);
});

test('6. Every approval step recomputes: leave approved after submission is paid; manual adjustments are kept', () => {
  const P = 'PP-2024-13'; // 1–15 July 2024
  resetPeriod(P);
  activities.createActivity({ empId: LUIS, date: '2024-07-01', hours: 8, jiraKey: 'ARW-1', description: 'Work' });
  const sheet = timesheets.ensureTimesheet(LUIS, P, 'Luis');
  const submitted = timesheets.submitTimesheet(sheet.id, 'Luis');
  assert.equal(submitted.pto, 0);

  const l = leave.createLeaveRequest({ empId: LUIS, name: 'Luis', type: 'Vacation', fromDate: '2024-07-02', toDate: '2024-07-02', reason: 'x' });
  leave.reviewLeaveRequest(l.id, { action: 'approve' });
  leave.reviewLeaveRequest(l.id, { action: 'approve' });

  // PM approves without reviewing any activity: the approved leave day is counted
  const step1 = timesheets.approveTimesheet(sheet.id, { role: 'pm' }, 'PM');
  assert.equal(step1.pto, 8);
  assert.equal(step1.total, submitted.total + 8);

  // A reviewer's explicit hours adjustment at the owner step is not overwritten by the recompute
  timesheets.saveTimesheetHours(sheet.id, { ot: 1 }, 'Owner');
  const final = timesheets.approveTimesheet(sheet.id, { role: 'admin' }, 'Owner');
  assert.equal(final.status, 'Approved');
  assert.equal(final.ot, 1);
  resetPeriod(P);
});

test('7. "Today" is Santo Domingo time (UTC-4), not UTC', (t) => {
  assert.equal(todayLocal(new Date('2026-10-30T02:00:00Z')), '2026-10-29');
  assert.equal(todayLocal(new Date('2026-10-30T04:00:00Z')), '2026-10-30');
  const realNow = Date.now;
  t.after(() => { Date.now = realNow; });
  // 1 Jan 2025 02:00 UTC is still 31 Dec 2024 22:00 in Santo Domingo: the new year's first quincena hasn't started
  Date.now = () => Date.parse('2025-01-01T02:00:00Z');
  assert.equal(buildPeriods(2025).find((p) => p.id === 'PP-2025-01').status, 'Draft');
  assert.equal(periods.getCurrentPeriod().id, 'PP-2024-24');
});

test('8. Disabled workflow steps are skipped by submit and approve', (t) => {
  const org = workflows.getOrgConfig('MGH Dominicana SRL');
  const original = org.steps;
  t.after(() => workflows.updateOrgConfig(org.id, { steps: original }));
  workflows.updateOrgConfig(org.id, {
    steps: [
      { key: 'sup', label: 'Supervisor', role: 'supervisor', review: 'Supervisor Review', enabled: false },
      { key: 'pm', label: 'Supervisión PM', role: 'pm', review: 'Supervisión PM' },
      { key: 'hr', label: 'HR', role: 'hr', review: 'HR Review', enabled: false },
      { key: 'owner', label: 'Owner', role: 'admin', review: 'Aprobación Dueño' },
    ],
  });
  const P = 'PP-2024-15';
  resetPeriod(P);
  activities.createActivity({ empId: LUIS, date: '2024-08-01', hours: 8, jiraKey: 'ARW-1', description: 'Work' });
  const sheet = timesheets.ensureTimesheet(LUIS, P, 'Luis');
  assert.equal(timesheets.submitTimesheet(sheet.id, 'Luis').status, 'Supervisión PM');
  assert.equal(timesheets.approveTimesheet(sheet.id, { role: 'pm' }, 'PM').status, 'Aprobación Dueño');
  assert.equal(timesheets.approveTimesheet(sheet.id, { role: 'admin' }, 'Owner').status, 'Approved');
  resetPeriod(P);
});

test('A new adjustment is always born pending, whatever status the body sends', () => {
  const adjustments = require('../src/controllers/adjustments.controller');
  const P = 'PP-2024-07';
  resetPeriod(P);
  const adj = adjustments.createAdjustment({ employeeId: LUIS, periodId: P, type: 'Bono', amt: 100, status: 'Approved & Queued' });
  try {
    assert.equal(adj.status, 'Pending Approval');
  } finally {
    db.execute(`DELETE FROM payroll_adjustments WHERE id = ?`, [adj.id]);
  }
});
