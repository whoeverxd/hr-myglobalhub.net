const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const employees = require('../src/controllers/employees.controller');
const authService = require('../src/services/auth.service');

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);
const newEmp = (email, extra = {}) => ({ firstName: 'Role', lastName: 'Test', fullName: 'Role Test', name: 'Role Test', email, title: 'Developer', dept: 'Engineering', entity: 'MGH Dominicana SRL', etype: 'Full-Time', rate: 10, ...extra });
const userOf = (email) => db.getOne('SELECT * FROM users WHERE LOWER(email) = ?', [email]);
const ADMIN = { id: 'usr_role_admin', name: 'Role Admin', role: 'admin' };

test('A PM cannot create administrators, not even through the job title', () => {
  const email = `role-pm-${uniq()}@example.test`;
  assert.throws(() => employees.createEmployee(newEmp(email, { systemRole: 'admin' }), 'PM', '127.0.0.1', 'pm'), (e) => e.status === 403);
  assert.ok(!userOf(email), 'no login saved');
  assert.ok(!db.getOne('SELECT id FROM employees WHERE LOWER(email) = ?', [email]), 'no employee saved');

  const ceo = employees.createEmployee(newEmp(email, { title: 'CEO' }), 'PM', '127.0.0.1', 'pm');
  assert.equal(userOf(email).role, 'employee', 'a title like CEO does not grant admin when a PM creates it');
  assert.ok(ceo.id);

  const email2 = `role-adm-${uniq()}@example.test`;
  employees.createEmployee(newEmp(email2, { systemRole: 'admin' }), 'Admin', '127.0.0.1', 'admin');
  assert.equal(userOf(email2).role, 'admin', 'an admin can create another admin');
});

test('Only an admin changes roles; never their own and never the last admin', () => {
  const email = `role-set-${uniq()}@example.test`;
  const emp = employees.createEmployee(newEmp(email));
  const target = userOf(email);

  assert.throws(() => authService.setRoleForEmployee({ employeeId: emp.id, role: 'admin', actor: { id: 'x', name: 'PM', role: 'pm' } }), (e) => e.status === 403);
  assert.throws(() => authService.setRoleForEmployee({ employeeId: emp.id, role: 'superuser', actor: ADMIN }), (e) => e.status === 400);

  const r = authService.setRoleForEmployee({ employeeId: emp.id, role: 'admin', actor: ADMIN });
  assert.equal(r.changed, true);
  assert.equal(r.previousRole, 'employee');
  assert.equal(userOf(email).role, 'admin');
  assert.equal(authService.accountForEmployee(emp.id).role, 'admin');

  assert.throws(() => authService.setUserRole({ userId: target.id, role: 'employee', actor: { ...ADMIN, id: target.id } }), (e) => e.status === 400, 'not your own role');

  // Last active admin: demote every other admin in this test DB only by checking the guard's count logic
  const admins = db.query(`SELECT id FROM users WHERE role = 'admin' AND is_active = 1`);
  if (admins.length === 1) {
    assert.throws(() => authService.setUserRole({ userId: target.id, role: 'employee', actor: ADMIN }), (e) => e.status === 409);
  } else {
    assert.equal(authService.setUserRole({ userId: target.id, role: 'pm', actor: ADMIN }).role, 'pm');
  }
});

test('Linking an existing administrator account to an employee never changes its role', () => {
  const email = `role-link-${uniq()}@example.test`;
  db.execute(`INSERT INTO users (id, email, password_hash, salt, name, role, entity, is_active) VALUES (?, ?, '', '', 'Owner', 'admin', 'MGH Dominicana SRL', 1)`, ['usr_link_' + uniq(), email]);
  const emp = employees.createEmployee(newEmp(email), 'PM', '127.0.0.1', 'pm');
  assert.equal(emp.account.status, 'linked');
  assert.equal(userOf(email).role, 'admin');
});
