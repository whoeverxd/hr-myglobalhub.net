const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const authService = require('../src/services/auth.service');

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);

function makeEmployee(role = 'employee') {
  const empId = 'RST-' + uniq();
  const email = `reset-${uniq()}@example.test`;
  db.execute(
    `INSERT INTO employees (id, name, email, entity, dept, role, type) VALUES (?, ?, ?, 'MGH Dominicana SRL', 'Engineering', 'Contributor', 'Full-time')`,
    [empId, 'Reset Target', email]
  );
  const user = authService.ensureUserForEmployee({ email, name: 'Reset Target', role, employeeId: empId });
  return { empId, email, user };
}

const HR = { id: 'usr_hr_actor', name: 'HR Actor', role: 'hr' };

test('HR reset issues a one-time password, revokes sessions and forces a change', async () => {
  const { empId, email, user } = makeEmployee();
  await authService.changePassword({ userId: user.id, currentPassword: user.initialPassword, newPassword: 'Forgotten2024x' });
  const session = authService.authenticateUser(email, 'Forgotten2024x');
  assert.ok(authService.validateSession(session.token));

  const r = authService.resetPasswordForEmployee({ employeeId: empId, actor: HR });
  assert.equal(r.email, email);
  assert.ok(r.temporaryPassword.length >= 14);
  assert.equal(authService.authenticateUser(email, 'Forgotten2024x'), null, 'the old password stops working');
  assert.ok(authService.authenticateUser(email, r.temporaryPassword), 'the temporary password works');
  assert.equal(authService.validateSession(session.token), null, 'open sessions are signed out');
  assert.equal(authService.mustChangePassword(user.id), true, 'the user must replace it at sign-in');
});

test('Reset is limited to HR/admin/PM, never self, and only admins reset admins', () => {
  const { empId } = makeEmployee();
  for (const role of ['employee', 'contractor', 'supervisor', 'finance']) {
    assert.throws(() => authService.resetPasswordForEmployee({ employeeId: empId, actor: { id: 'x', name: 'X', role } }), (e) => e.status === 403);
  }

  const admin = makeEmployee('admin');
  assert.throws(() => authService.resetPasswordForEmployee({ employeeId: admin.empId, actor: HR }), (e) => e.status === 403);
  assert.ok(authService.resetPasswordForEmployee({ employeeId: admin.empId, actor: { id: 'usr_other_admin', name: 'Admin', role: 'admin' } }).temporaryPassword);

  const self = makeEmployee('hr');
  assert.throws(() => authService.resetPasswordForEmployee({ employeeId: self.empId, actor: { id: self.user.id, name: 'Self', role: 'hr' } }), (e) => e.status === 400);
});

test('Reset fails clearly for unknown employees and employees without a login', () => {
  assert.throws(() => authService.resetPasswordForEmployee({ employeeId: 'NOPE-' + uniq(), actor: HR }), (e) => e.status === 404);
  const empId = 'RST-' + uniq();
  db.execute(`INSERT INTO employees (id, name, entity, dept, role, type) VALUES (?, 'No Login', 'MGH Dominicana SRL', 'Ops', 'Contributor', 'Full-time')`, [empId]);
  assert.throws(() => authService.resetPasswordForEmployee({ employeeId: empId, actor: HR }), (e) => e.status === 404 && /no login/.test(e.message));
});

test('A PM resets team accounts (employee, contractor, supervisor) but not managers, HR, finance or admins', () => {
  const PM = { id: 'usr_pm_actor', name: 'PM Actor', role: 'pm' };
  for (const role of ['employee', 'contractor', 'supervisor']) {
    assert.ok(authService.resetPasswordForEmployee({ employeeId: makeEmployee(role).empId, actor: PM }).temporaryPassword, role);
  }
  for (const role of ['pm', 'hr', 'finance', 'admin']) {
    assert.throws(() => authService.resetPasswordForEmployee({ employeeId: makeEmployee(role).empId, actor: PM }), (e) => e.status === 403, role);
  }
});
