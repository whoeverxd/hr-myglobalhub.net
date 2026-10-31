const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const employees = require('../src/controllers/employees.controller');
const payoutMethods = require('../src/services/payout-methods.service');
const payrollEngine = require('../src/services/payroll-engine.service');
const bankingRails = require('../src/services/banking-rails.service');

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);
const HR = { id: 'usr_pm_hr', name: 'HR Reviewer', role: 'hr', employeeId: 'MGH-HR-X' };
const ADMIN = { id: 'usr_pm_admin', name: 'Admin', role: 'admin' };
const PM = { id: 'usr_pm_pm', name: 'Some PM', role: 'pm', employeeId: 'MGH-PM-X' };
const made = [];
const make = (extra = {}) => {
  const e = employees.createEmployee({ name: 'Pay Test', email: `pay-${uniq()}@example.test`, title: 'Dev', dept: 'Engineering', entity: 'MGH Dominicana SRL', etype: 'Full-Time', rate: 10, ...extra });
  made.push(e.id);
  return e;
};
const me = (emp) => ({ id: 'usr-' + emp.id, name: emp.name, role: 'employee', employeeId: emp.id });
const BANK = { bank_name: 'Banco BHD León', account_type: 'Ahorro', account_number: '00012345678', holder: 'Pay Test', holder_id: '40212345678' };
const BINANCE = { currency: 'USDC', network: 'BSC', address: '0x1111111111111111111111111111111111111111' };
const USDC_BASE = { currency: 'USDC', network: 'Base', address: '0x2222222222222222222222222222222222222222' };

test.after(() => { for (const id of made) { try { employees.purgeEmployee(id, ADMIN, '127.0.0.1', { confirm: id }); } catch (_) {} } });

test('Employee registers payout data → pending; HR verifies it and it becomes the primary payroll pays 100% to', () => {
  const emp = make();
  const m = payoutMethods.create(emp.id, { type: 'binance', details: BINANCE }, me(emp));
  assert.equal(m.status, 'pending');
  assert.equal(payoutMethods.primaryFor(emp.id), null, 'nothing is paid to unverified data');

  assert.throws(() => payoutMethods.verify(m.id, me(emp)), (e) => e.status === 403, 'an employee cannot verify');
  assert.throws(() => payoutMethods.reject(m.id, '', HR), (e) => e.status === 400, 'a rejection needs a reason');
  const v = payoutMethods.verify(m.id, HR);
  assert.equal(v.status, 'verified');
  assert.equal(v.isPrimary, true, 'the first verified method becomes primary');

  const calc = payrollEngine.calculateEmployeePeriodPayroll(db.getOne('SELECT * FROM employees WHERE id = ?', [emp.id]), { regHours: 10 });
  assert.equal(calc.payoutDistribution.length, 1);
  const line = calc.payoutDistribution[0];
  assert.equal(line.percentage, 100);
  assert.equal(line.amount, calc.netPay);
  assert.equal(line.channel, 'manual', 'USDC on BSC has no file: manual payment');
  assert.equal(line.methodId, m.id);
  assert.ok(!JSON.stringify(line).includes(BINANCE.address), 'the run line only carries the masked address');
});

test('Editing verified data keeps paying the old destination until the change is verified', () => {
  const emp = make();
  const bank = payoutMethods.create(emp.id, { type: 'bank', details: BANK }, HR);
  assert.equal(bank.status, 'verified', 'HR registering someone else\'s data verifies it');
  assert.equal(payoutMethods.primaryFor(emp.id).id, bank.id);

  const change = payoutMethods.update(bank.id, { details: { ...BANK, account_number: '99998888777' } }, me(emp));
  assert.equal(change.status, 'pending');
  assert.equal(change.replacesId, bank.id);
  assert.equal(payoutMethods.primaryFor(emp.id).details.account_number, BANK.account_number, 'still the verified account');

  payoutMethods.verify(change.id, HR);
  const now = payoutMethods.primaryFor(emp.id);
  assert.equal(now.id, change.id);
  assert.equal(now.details.account_number, '99998888777');
  assert.equal(payoutMethods.list(emp.id, me(emp)).length, 1, 'the replaced method is gone');
});

test('Primary switching, deletion rules, validation and who sees what', () => {
  const emp = make();
  const bank = payoutMethods.create(emp.id, { type: 'bank', details: BANK }, HR);
  const paypal = payoutMethods.create(emp.id, { type: 'paypal', details: { email: 'Pay.Test@Example.com' }, primary: true }, me(emp));
  assert.equal(paypal.wantsPrimary, true);
  assert.equal(payoutMethods.primaryFor(emp.id).id, bank.id, 'a pending primary choice waits for verification');
  assert.throws(() => payoutMethods.remove(bank.id, me(emp)), (e) => e.status === 409, 'the verified primary cannot be deleted');
  payoutMethods.verify(paypal.id, HR);
  assert.equal(payoutMethods.primaryFor(emp.id).id, paypal.id);
  assert.equal(payoutMethods.primaryFor(emp.id).details.email, 'pay.test@example.com');
  payoutMethods.remove(bank.id, me(emp));

  // Validation per type
  assert.throws(() => payoutMethods.create(emp.id, { type: 'binance', details: { currency: 'USDC', network: 'Tron', address: '0xabc' } }, me(emp)), (e) => e.status === 400 && /Tron/.test(e.message));
  assert.throws(() => payoutMethods.create(emp.id, { type: 'western_union', details: { full_name: 'X' } }, me(emp)), (e) => e.status === 400 && /País/.test(e.message));
  assert.throws(() => payoutMethods.create(emp.id, { type: 'cash', details: {} }, me(emp)), (e) => e.status === 400);

  // Visibility: owner and reviewers full, PM masked, other employees refused; others cannot write
  assert.equal(payoutMethods.list(emp.id, HR)[0].details.email, 'pay.test@example.com');
  assert.equal(payoutMethods.list(emp.id, PM)[0].details.email, 'p***@example.com');
  const other = make();
  assert.throws(() => payoutMethods.list(emp.id, me(other)), (e) => e.status === 403);
  assert.throws(() => payoutMethods.create(emp.id, { type: 'paypal', details: { email: 'x@y.com' } }, me(other)), (e) => e.status === 403);
  assert.throws(() => payoutMethods.create(emp.id, { type: 'paypal', details: { email: 'x@y.com' } }, PM), (e) => e.status === 403);

  // HR cannot verify their own data; an admin can
  const hrEmp = make();
  const hrUser = { ...HR, employeeId: hrEmp.id };
  const own = payoutMethods.create(hrEmp.id, { type: 'paypal', details: { email: 'hr@example.com' } }, hrUser);
  assert.equal(own.status, 'pending', 'your own data always waits');
  assert.throws(() => payoutMethods.verify(own.id, hrUser), (e) => e.status === 403);
  assert.equal(payoutMethods.verify(own.id, ADMIN).status, 'verified');
});

test('Payment files: bank method → BHD with its full account + holder cédula; USDC on Base → USDC batch; others → manual CSV', () => {
  const P = 'PP-2024-21', RUN = 'PR-' + P;
  const env = { MGH_BHD_COMPANY_ACCOUNT: process.env.MGH_BHD_COMPANY_ACCOUNT };
  process.env.MGH_BHD_COMPANY_ACCOUNT = '7001234567';
  const a = make(), b = make(), c = make();
  payoutMethods.create(a.id, { type: 'bank', details: { ...BANK, account_type: 'Corriente' } }, HR);
  payoutMethods.create(b.id, { type: 'coinbase', details: USDC_BASE }, HR);
  payoutMethods.create(c.id, { type: 'western_union', details: { full_name: 'Carla Ruiz', country: 'Venezuela', city: 'Caracas', document_type: 'Cédula', document_number: 'V12345678', phone: '+58 412 5550000' } }, HR);

  db.execute('DELETE FROM payroll_run_items WHERE run_id = ?', [RUN]);
  db.execute('DELETE FROM payroll_runs WHERE id = ?', [RUN]);
  db.execute(`INSERT OR IGNORE INTO pay_periods (id, year, period_number, start_date, end_date, pay_date, cutoff, status, is_locked) VALUES (?, 2024, 21, '2024-11-01', '2024-11-15', '2024-11-20', '2024-11-15T23:59', 'Approved', 0)`, [P]);
  db.execute(`INSERT INTO payroll_runs (id, period_id, year, period_number, entity, status) VALUES (?, ?, 2024, 21, 'MGH Dominicana SRL', 'Approved')`, [RUN, P]);
  for (const e of [a, b, c]) {
    const row = db.getOne('SELECT * FROM employees WHERE id = ?', [e.id]);
    const calc = payrollEngine.calculateEmployeePeriodPayroll(row, { regHours: 10 });
    db.execute(`INSERT INTO payroll_run_items (id, run_id, employee_id, employee_name, rate, reg_hours, gross_pay, total_deductions, net_pay, payout_json) VALUES (?, ?, ?, ?, 10, 10, ?, ?, ?, ?)`,
      ['PRI-' + RUN + '-' + e.id, RUN, e.id, e.name, calc.earnings.grossPay, calc.deductions.total, calc.netPay, JSON.stringify(calc.payoutDistribution)]);
  }
  try {
    const bhd = bankingRails.generateBhdFile({ periodId: P });
    assert.equal(bhd.totalEntries, 1, 'only the bank payee');
    assert.ok(bhd.content.includes('|CTE|00012345678|'), 'full account and account type from the method');
    assert.ok(bhd.content.includes('|40212345678|'), 'cédula of the account holder');

    const usdc = bankingRails.generateUsdcPayoutBatch({ periodId: P });
    assert.equal(usdc.totalEntries, 1);
    assert.equal(usdc.batchPayload.recipients[0].wallet, USDC_BASE.address);

    const manual = bankingRails.generateManualPayouts({ periodId: P });
    assert.equal(manual.totalEntries, 1);
    assert.ok(manual.content.includes('Western Union') && manual.content.includes('V12345678') && manual.content.includes('Caracas'));
  } finally {
    db.execute('DELETE FROM payroll_run_items WHERE run_id = ?', [RUN]);
    db.execute('DELETE FROM payroll_runs WHERE id = ?', [RUN]);
    db.execute('DELETE FROM pay_periods WHERE id = ?', [P]);
    if (env.MGH_BHD_COMPANY_ACCOUNT === undefined) delete process.env.MGH_BHD_COMPANY_ACCOUNT; else process.env.MGH_BHD_COMPANY_ACCOUNT = env.MGH_BHD_COMPANY_ACCOUNT;
  }
});

test('Add Employee payout data becomes verified methods with the full number (HR), pending when a PM enters it', () => {
  const byHr = employees.createEmployee({ name: 'Form Hire', email: `form-${uniq()}@example.test`, title: 'Dev', dept: 'Engineering', etype: 'Full-Time', rate: 10, bank: 'Banco Popular', acct: '123456789012', nid: '40211122233' }, 'HR Person', '127.0.0.1', 'hr');
  made.push(byHr.id);
  const p = payoutMethods.primaryFor(byHr.id);
  assert.ok(p, 'verified primary from the form');
  assert.equal(p.details.account_number, '123456789012', 'full number kept for the payment files');
  assert.equal(p.details.holder_id, '40211122233');

  const byPm = employees.createEmployee({ name: 'Pm Hire', email: `pmh-${uniq()}@example.test`, title: 'Dev', dept: 'Engineering', etype: 'Full-Time', rate: 10, bank: 'Banco Popular', acct: '123456789012' }, 'Some PM', '127.0.0.1', 'pm');
  made.push(byPm.id);
  assert.equal(payoutMethods.primaryFor(byPm.id), null);
  assert.equal(payoutMethods.list(byPm.id, HR)[0].status, 'pending');
});

test('Updating an employee without the crypto fields no longer wipes them', () => {
  const emp = make({ cbWallet: '0x3333333333333333333333333333333333333333', cbAsset: 'USDC', cbNetwork: 'Base', cbAlloc: 20 });
  employees.updateEmployee(emp.id, { phone: '+1 809 000 0000' });
  const row = db.getOne('SELECT crypto_wallet, crypto_alloc, crypto_asset, first_name FROM employees WHERE id = ?', [emp.id]);
  assert.equal(row.crypto_wallet, '0x3333333333333333333333333333333333333333');
  assert.equal(Number(row.crypto_alloc), 20);
  assert.equal(row.crypto_asset, 'USDC');
});
