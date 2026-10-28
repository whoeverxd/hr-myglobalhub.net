const test = require('node:test');
const assert = require('node:assert/strict');
const { round2, toCents, fromCents, sumCents } = require('../src/utils/money');
const {
  calculateDominicanRepublicDeductions,
  calculateUnitedStatesDeductions,
  calculateUnitedKingdomDeductions,
  calculateTaxDeductions,
} = require('../src/services/tax-rules.service');
const {
  calculateEmployeePeriodPayroll,
  calculatePeriodPayroll,
} = require('../src/services/payroll-engine.service');

test('Money utilities: precision and exact cent handling', () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(10.555), 10.56);
  assert.equal(toCents(12.34), 1234);
  assert.equal(fromCents(1234), 12.34);
  assert.equal(sumCents(0.1, 0.2, 0.3), 0.6);
});

test('Dominican Republic: TSS and DGII ISR calculation', () => {
  const gross = 3000; // USD per bi-weekly period (26 periods/year)
  const deds = calculateDominicanRepublicDeductions(gross, 26);

  assert.equal(deds.length, 3);
  const sfs = deds.find((d) => d.code === 'TSS_SFS');
  const afp = deds.find((d) => d.code === 'TSS_AFP');
  const isr = deds.find((d) => d.code === 'DGII_ISR');

  // SFS 3.04% of 3000 = 91.20
  assert.equal(sfs.amount, 91.20);
  // AFP 2.87% of 3000 = 86.10
  assert.equal(afp.amount, 86.10);
  // ISR must be greater than 0 on $78,000 USD annual
  assert.ok(isr.amount > 0);
});

test('United States: FICA and Federal withholding calculation', () => {
  const gross = 4000;
  const deds = calculateUnitedStatesDeductions(gross, 26, 'Austin, TX');

  const ss = deds.find((d) => d.code === 'US_SOC_SEC');
  const med = deds.find((d) => d.code === 'US_MEDICARE');
  const fed = deds.find((d) => d.code === 'US_FED_TAX');

  // Social Security 6.2% of 4000 = 248.00
  assert.equal(ss.amount, 248.00);
  // Medicare 1.45% of 4000 = 58.00
  assert.equal(med.amount, 58.00);
  // Federal tax must be positive
  assert.ok(fed.amount > 0);
  // TX has 0 state income tax
  assert.equal(deds.some((d) => d.code === 'US_STATE_TAX'), false);
});

test('United Kingdom: PAYE and National Insurance calculation', () => {
  const gross = 5000;
  const deds = calculateUnitedKingdomDeductions(gross, 26);

  const paye = deds.find((d) => d.code === 'UK_PAYE');
  const ni = deds.find((d) => d.code === 'UK_NI');

  assert.ok(paye.amount > 0);
  assert.ok(ni.amount > 0);
});

test('Contractor Exempt profile: 0 statutory deductions', () => {
  const res = calculateTaxDeductions({
    grossPay: 5000,
    isExempt: true,
    taxProfile: 'Exempt — not subject to tax deductions',
  });

  assert.equal(res.isExempt, true);
  assert.equal(res.lines.length, 0);
  assert.equal(res.totalDeductions, 0);
});

test('Employee payroll calculation: gross, deductions, net, and payout split', () => {
  const employee = {
    id: 'MGH-1042',
    name: 'Carlos Mendez',
    role: 'Sr. Full Stack Developer',
    dept: 'Engineering',
    rate: 52.5,
    freq: 'Bi-Weekly',
    type: 'Contractor / Exempt',
    tax: 'Exempt',
    pmethod: 'Bank Deposit',
    bank: 'Banco BHD León',
    acct: '••••4821',
    crypto_alloc: 20,
    crypto_asset: 'USDC',
    crypto_network: 'Base',
    crypto_wallet: '0x1234567890abcdef1234567890abcdef12345678',
  };

  const payroll = calculateEmployeePeriodPayroll(employee, {
    regHours: 80,
    otHours: 6.5,
    ptoHours: 0,
    adjustments: [
      { id: 'MGH-1042', type: 'Q1 Performance Bonus', kind: 'bonus', amt: 5000, status: 'Approved' },
    ],
  });

  // Regular: 80 * 52.5 = 4200
  // Overtime: 6.5 * 52.5 * 1.5 = 511.88
  // Bonus: 5000
  // Gross: 4200 + 511.88 + 5000 = 9711.88
  assert.equal(payroll.earnings.regular, 4200);
  assert.equal(payroll.earnings.overtime, 511.88);
  assert.equal(payroll.earnings.adjustments, 5000);
  assert.equal(payroll.earnings.grossPay, 9711.88);
  assert.equal(payroll.netPay, 9711.88); // Exempt

  // Check 80% / 20% payout distribution split
  const bankSplit = payroll.payoutDistribution.find((p) => p.percentage === 80);
  const cryptoSplit = payroll.payoutDistribution.find((p) => p.percentage === 20);

  assert.ok(bankSplit);
  assert.ok(cryptoSplit);
  assert.equal(round2(bankSplit.amount + cryptoSplit.amount), payroll.netPay);
});

test('Period payroll run: math balance integrity (Gross - Deductions === Net)', () => {
  // Only approved timesheets are paid: give every active employee an approved sheet in its own period
  const db = require('../src/db');
  const periodId = 'PP-2025-19'; // 1–15 October 2025
  db.execute('DELETE FROM timesheets WHERE period_id = ?', [periodId]);
  const emps = db.query(`SELECT id, name FROM employees WHERE status != 'Terminated'`);
  emps.forEach((e) => db.execute(
    `INSERT INTO timesheets (id, employee_id, employee_name, period_id, status, step_index, regular_hours, overtime_hours, pto_hours, holiday_hours, total_hours, history_json)
     VALUES (?, ?, ?, ?, 'Approved', 2, 80, 4, 0, 0, 84, '[]')`,
    [`TS-${periodId}-${e.id}`, e.id, e.name, periodId]
  ));
  const run = calculatePeriodPayroll({
    periodId,
    entity: 'All',
    saveAsRun: false,
  });

  assert.equal(run.totalEmployees, emps.length);
  assert.equal(run.totalHours, emps.length * 84, 'hours come from the approved timesheets');
  assert.ok(run.totalGross > 0);
  assert.ok(run.totalDeductions > 0);
  assert.ok(run.totalNet > 0);

  const balanceDiff = Math.abs((run.totalGross - run.totalDeductions) - run.totalNet);
  assert.ok(balanceDiff < 0.01, `Mathematical discrepancy: diff is ${balanceDiff}`);
});
