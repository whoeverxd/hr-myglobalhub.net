const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const employees = require('../src/controllers/employees.controller');
const authService = require('../src/services/auth.service');

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);
const PM = { id: 'usr_rm_pm', name: 'PM Actor', role: 'pm', employeeId: 'MGH-PM-X' };
const ADMIN = { id: 'usr_rm_admin', name: 'Admin Actor', role: 'admin' };
const make = (extra = {}) => {
  const email = `rm-${uniq()}@example.test`;
  const emp = employees.createEmployee({ firstName: 'Rm', lastName: 'Test', fullName: 'Rm Test', name: 'Rm Test', email, title: 'Developer', dept: 'Engineering', entity: 'MGH Dominicana SRL', etype: 'Full-Time', rate: 10, ...extra });
  return { emp, email };
};

test('Delete cascades over operational data and the login', () => {
  const { emp, email } = make();
  db.execute(`INSERT INTO daily_activities (id, employee_id, date, hours, jira_key, work_type, description) VALUES (?, ?, '2026-10-01', 4, 'ARW-1', 'Desarrollo', 'x')`, ['act-' + uniq(), emp.id]);
  db.execute(`INSERT INTO timesheets (id, employee_id, employee_name, period_id, status, step_index, regular_hours, overtime_hours, pto_hours, holiday_hours, total_hours, history_json) VALUES (?, ?, 'Rm', 'PP-2026-19', 'Draft', 0, 4, 0, 0, 0, 4, '[]')`, ['TS-PP-2026-19-' + emp.id, emp.id]);
  const user = db.getOne('SELECT id FROM users WHERE LOWER(email) = ?', [email]);
  authService.authenticateUser(email, emp.initialPassword); // opens a session

  const preview = employees.employeeRemovalPreview(emp.id, PM);
  assert.equal(preview.canDelete, true);
  assert.equal(preview.willDelete.activities, 1);
  assert.equal(preview.willDelete.timesheets, 1);
  assert.equal(preview.willDelete.login, email);

  const r = employees.deleteEmployee(emp.id, PM);
  assert.equal(r.deleted, true);
  assert.equal(db.getOne('SELECT id FROM employees WHERE id = ?', [emp.id]) || null, null);
  assert.equal(db.query('SELECT id FROM daily_activities WHERE employee_id = ?', [emp.id]).length, 0);
  assert.equal(db.query('SELECT id FROM timesheets WHERE employee_id = ?', [emp.id]).length, 0);
  assert.equal(db.getOne('SELECT id FROM users WHERE id = ?', [user.id]) || null, null);
  assert.equal(db.query('SELECT token FROM sessions WHERE user_id = ?', [user.id]).length, 0);
});

test('Payroll history blocks the delete; deactivate keeps the records and disables the login', () => {
  const { emp, email } = make();
  db.execute(`INSERT INTO timesheets (id, employee_id, employee_name, period_id, status, step_index, regular_hours, overtime_hours, pto_hours, holiday_hours, total_hours, history_json) VALUES (?, ?, 'Rm', 'PP-2026-18', 'Paid', 2, 80, 0, 0, 0, 80, '[]')`, ['TS-PP-2026-18-' + emp.id, emp.id]);
  const preview = employees.employeeRemovalPreview(emp.id, ADMIN);
  assert.equal(preview.canDelete, false);
  assert.match(preview.blockers.join(' '), /paid timesheet/);
  assert.throws(() => employees.deleteEmployee(emp.id, ADMIN), (e) => e.status === 409 && /deactivate/.test(e.message));

  employees.deactivateEmployee(emp.id, ADMIN);
  assert.equal(db.getOne('SELECT status FROM employees WHERE id = ?', [emp.id]).status, 'Terminated');
  assert.equal(db.query('SELECT id FROM timesheets WHERE employee_id = ?', [emp.id]).length, 1, 'history kept');
  assert.equal(Number(db.getOne('SELECT is_active FROM users WHERE LOWER(email) = ?', [email]).is_active), 0);
  assert.equal(authService.authenticateUser(email, emp.initialPassword), null, 'cannot sign in any more');
});

test('Who may remove: PM only team accounts, never yourself; employees cannot', () => {
  const { emp } = make();
  assert.throws(() => employees.employeeRemovalPreview(emp.id, { id: 'x', name: 'E', role: 'employee' }), (e) => e.status === 403);
  assert.throws(() => employees.employeeRemovalPreview(emp.id, { ...PM, employeeId: emp.id }), (e) => e.status === 400);

  const hr = make({ systemRole: 'hr' });
  assert.throws(() => employees.employeeRemovalPreview(hr.emp.id, PM), (e) => e.status === 403, 'a PM cannot remove HR');
  assert.equal(employees.employeeRemovalPreview(hr.emp.id, ADMIN).canDelete, true, 'an admin can');
  employees.deleteEmployee(hr.emp.id, ADMIN);
  employees.deleteEmployee(emp.id, ADMIN);
});
