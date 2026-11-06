const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const employees = require('../src/controllers/employees.controller');

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);
const newEmp = (email, dob) => ({ first: 'Dob', last: 'Test', email, title: 'Developer', dept: 'Engineering', rate: 10, dob });
const cleanup = (email) => {
  const u = db.getOne('SELECT id FROM users WHERE LOWER(email) = ?', [email]);
  if (u) { try { db.execute('DELETE FROM sessions WHERE user_id = ?', [u.id]); } catch (_) {} db.execute('DELETE FROM users WHERE id = ?', [u.id]); }
  for (const e of db.query('SELECT id FROM employees WHERE LOWER(email) = ?', [email])) {
    try { db.execute('DELETE FROM project_members WHERE user_id = ?', [e.id]); } catch (_) {}
    db.execute('DELETE FROM employees WHERE id = ?', [e.id]);
  }
};

test('dobProblem: minors, future and impossible dates are refused; 18th birthday and empty are fine', () => {
  const today = '2026-11-05';
  assert.equal(employees.dobProblem('', today), '');
  assert.equal(employees.dobProblem(null, today), '');
  assert.equal(employees.dobProblem('2008-11-05', today), '', 'turns 18 today');
  assert.equal(employees.dobProblem('1990-01-31', today), '');
  assert.match(employees.dobProblem('2008-11-06', today), /menores de edad/, 'turns 18 tomorrow');
  assert.match(employees.dobProblem('2026-10-30', today), /menores de edad/);
  assert.match(employees.dobProblem('2027-01-01', today), /futura/);
  assert.match(employees.dobProblem('2001-02-30', today), /no es válida/);
  assert.match(employees.dobProblem('30/10/2001', today), /no es válida/);
  assert.match(employees.dobProblem('1900-01-01', today), /100 años/);
});

test('createEmployee refuses a minor before anything is saved', () => {
  const email = `dob-minor-${uniq()}@example.test`;
  const [y, m, d] = require('../src/utils/today').todayLocal().split('-');
  const minor = `${+y - 17}-${m}-${d}`;
  assert.throws(() => employees.createEmployee(newEmp(email, minor)), (e) => e.status === 400 && /menores de edad/.test(e.message));
  assert.equal(db.getOne('SELECT id FROM employees WHERE LOWER(email) = ?', [email]), null, 'no employee left behind');
  assert.equal(db.getOne('SELECT id FROM users WHERE LOWER(email) = ?', [email]), null, 'no login left behind');

  const adult = `${+y - 30}-${m}-01`;
  const created = employees.createEmployee(newEmp(email, adult));
  assert.equal(db.getOne('SELECT dob FROM employees WHERE id = ?', [created.id]).dob, adult);
  cleanup(email);
});
