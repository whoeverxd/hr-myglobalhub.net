const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const banks = require('../src/services/banks.service');
const payoutMethods = require('../src/services/payout-methods.service');
const employees = require('../src/controllers/employees.controller');

const ADMIN = { id: 'usr_bk_admin', name: 'Admin', role: 'admin' };
const HR = { id: 'usr_bk_hr', name: 'HR', role: 'hr', employeeId: 'MGH-HR-BK' };
const PM = { id: 'usr_bk_pm', name: 'PM', role: 'pm' };

test('Bank catalog: managed by admin/HR/finance; once it exists the "Banco" payout method must use it', () => {
  db.execute('DELETE FROM banks');
  const emp = employees.createEmployee({ name: 'Bank Test', email: `bank-${Date.now()}@example.test`, title: 'Dev', dept: 'Engineering', etype: 'Full-Time', rate: 10 });
  const me = { id: 'usr-' + emp.id, name: 'Bank Test', role: 'employee', employeeId: emp.id };
  const details = (bank_name) => ({ bank_name, account_type: 'Ahorro', account_number: '00012345678', holder: 'Bank Test' });
  try {
    // Empty catalog: any bank name is accepted (as before)
    const before = payoutMethods.create(emp.id, { type: 'bank', details: details('Banco Cualquiera') }, me);
    assert.equal(before.details.bank_name, 'Banco Cualquiera');

    assert.throws(() => banks.create({ name: 'Qik Banco Digital' }, PM), (e) => e.status === 403, 'a PM does not manage banks');
    const qik = banks.create({ name: '  Qik   Banco Digital ', swift: 'qikbdosx' }, ADMIN);
    assert.equal(qik.name, 'Qik Banco Digital');
    assert.equal(qik.swift, 'QIKBDOSX');
    assert.equal(qik.country, 'República Dominicana');
    assert.throws(() => banks.create({ name: 'qik banco digital' }, HR), (e) => e.status === 409, 'no duplicates (case-insensitive)');
    assert.throws(() => banks.create({ name: 'X', swift: 'ABC' }, HR), (e) => e.status === 400, 'SWIFT format');

    // Catalog in use: only its banks, spelled as in the catalog
    assert.throws(() => payoutMethods.create(emp.id, { type: 'bank', details: details('Banco Inventado') }, me), (e) => e.status === 400 && /no está en la lista/.test(e.message));
    const m = payoutMethods.create(emp.id, { type: 'bank', details: details('QIK BANCO DIGITAL') }, me);
    assert.equal(m.details.bank_name, 'Qik Banco Digital');

    // A deactivated bank is no longer offered for new methods, but an existing method keeps its bank on edit
    banks.update(qik.id, { active: false }, ADMIN);
    assert.equal(banks.list().some((b) => b.id === qik.id), false);
    assert.equal(banks.list({ includeInactive: true }).some((b) => b.id === qik.id), true);
    assert.throws(() => payoutMethods.create(emp.id, { type: 'bank', details: details('Qik Banco Digital') }, me), (e) => e.status === 400);
    const edited = payoutMethods.update(m.id, { details: { ...details('Qik Banco Digital'), holder: 'Bank T.' } }, me);
    assert.equal(edited.details.bank_name, 'Qik Banco Digital');
    assert.throws(() => banks.create({ name: 'Qik Banco Digital' }, ADMIN), (e) => e.status === 409 && /desactivado/.test(e.message));

    // The usual Dominican banks, once; Qik is not added twice
    const added = banks.addDominicanBanks(HR);
    assert.ok(added.includes('Banco Popular Dominicano') && !added.includes('Qik Banco Digital'));
    assert.deepEqual(banks.addDominicanBanks(HR), []);
  } finally {
    db.execute('DELETE FROM banks');
    employees.purgeEmployee(emp.id, ADMIN, '127.0.0.1', { confirm: emp.id });
  }
});
