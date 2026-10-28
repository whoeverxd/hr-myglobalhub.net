const db = require('../db');
const { round2 } = require('../utils/money');
const { calculateTaxDeductions, DEFAULT_CONFIG } = require('./tax-rules.service');
const { logAction } = require('../controllers/audit.controller');

/**
 * Calculates payroll for an individual employee for a single cycle
 */
function calculateEmployeePeriodPayroll(employee, {
  regHours = 80,
  otHours = 0,
  ptoHours = 0,
  adjustments = [],
} = {}) {
  const rate = Number(employee.rate) || 0;
  const regularPay = round2(regHours * rate);
  const overtimePay = round2(otHours * rate * 1.5);
  const ptoPay = round2(ptoHours * rate);

  // Group adjustments
  let adjAddition = 0;
  let adjDeduction = 0;
  const adjDetails = [];

  for (const a of adjustments) {
    const amt = Number(a.amt) || 0;
    if (amt >= 0) {
      adjAddition = round2(adjAddition + amt);
    } else {
      adjDeduction = round2(adjDeduction + Math.abs(amt));
    }
    adjDetails.push({
      id: a.id,
      type: a.type,
      kind: a.kind,
      amount: amt,
      status: a.status,
    });
  }

  const grossPay = round2(regularPay + overtimePay + ptoPay + adjAddition);

  // Calculate tax and statutory deductions
  const taxCalc = calculateTaxDeductions({
    grossPay,
    frequency: employee.freq || 'Bi-Weekly',
    taxProfile: employee.tax || '',
    entity: employee.entity || '',
    location: employee.loc || '',
    isExempt: Boolean(employee.type && (/Exempt|Contractor/i.test(employee.type) || /Exempt|Contractor/i.test(employee.tax || ''))),
  });

  const allDeductions = [...taxCalc.lines];
  if (adjDeduction > 0) {
    allDeductions.push({
      label: 'Payroll Adjustments (Deducciones previas)',
      code: 'ADJ_DEDUCTION',
      rate: 'Fixed',
      amount: adjDeduction,
      statutory: false,
    });
  }

  const totalDeductions = round2(allDeductions.reduce((sum, d) => sum + d.amount, 0));
  const netPay = round2(grossPay - totalDeductions);

  // Payout Allocation (e.g. 80% Bank, 20% Coinbase / Chase)
  const cryptoAlloc = Number(employee.crypto_alloc || employee.cryptoAlloc || 0);
  const mainAlloc = Math.max(0, 100 - cryptoAlloc);

  const mainAmount = round2(netPay * (mainAlloc / 100));
  const secondaryAmount = round2(netPay - mainAmount); // Exact remainder to balance 100%

  const payoutDistribution = [
    {
      rail: employee.pmethod || 'Bank Deposit',
      target: employee.bank || 'Primary Bank Account',
      accountMasked: employee.acct || '••••0000',
      percentage: mainAlloc,
      amount: mainAmount,
    },
  ];

  if (cryptoAlloc > 0) {
    payoutDistribution.push({
      rail: employee.crypto_network ? `Coinbase (${employee.crypto_network})` : 'Secondary Account',
      target: employee.crypto_asset || 'USDC',
      accountMasked: employee.crypto_wallet ? `${employee.crypto_wallet.slice(0, 6)}…${employee.crypto_wallet.slice(-4)}` : 'Wallet',
      percentage: cryptoAlloc,
      amount: secondaryAmount,
    });
  }

  return {
    employeeId: employee.id,
    name: employee.name,
    role: employee.role,
    department: employee.dept,
    entity: employee.entity,
    rate,
    hours: {
      regular: regHours,
      overtime: otHours,
      pto: ptoHours,
      total: round2(regHours + otHours + ptoHours),
    },
    earnings: {
      regular: regularPay,
      overtime: overtimePay,
      pto: ptoPay,
      adjustments: adjAddition,
      grossPay,
    },
    deductions: {
      lines: allDeductions,
      total: totalDeductions,
    },
    netPay,
    payoutDistribution,
    adjustments: adjDetails,
  };
}

/**
 * Calculates or previews a complete payroll run for a period and optional entity
 */
function calculatePeriodPayroll({
  periodId,
  entity = 'All',
  saveAsRun = false,
  user = 'System',
  ip = '127.0.0.1',
}) {
  const period = db.getOne(`SELECT * FROM pay_periods WHERE id = ?`, [periodId]);
  if (!period) {
    const err = new Error(`Pay period ${periodId} not found`);
    err.status = 404;
    throw err;
  }

  // An approved / paid run is final: corrections go through Payroll Adjustments in a later period
  const runIdCheck = `PR-${periodId}`;
  const existingRun = saveAsRun ? db.getOne(`SELECT status FROM payroll_runs WHERE id = ?`, [runIdCheck]) : null;
  if (existingRun && ['Approved', 'Paid'].includes(existingRun.status)) {
    const err = new Error(`Payroll run ${runIdCheck} is ${existingRun.status} and can no longer be recalculated`);
    err.status = 409;
    throw err;
  }

  // Pay ONLY what was approved: each employee's timesheet for the period that passed PM + owner review
  let empQuery = `SELECT * FROM employees WHERE status != 'Terminated'`;
  const empParams = [];
  if (entity && entity !== 'All') {
    empQuery += ` AND entity LIKE ?`;
    empParams.push(`%${entity}%`);
  }
  empQuery += ` ORDER BY name ASC`;
  const employees = db.query(empQuery, empParams);
  const sheets = {};
  db.query(`SELECT * FROM timesheets WHERE period_id = ?`, [periodId]).forEach((t) => { sheets[t.employee_id] = t; });

  // Only approved adjustments are paid
  const adjustments = db.query(`SELECT * FROM payroll_adjustments`).filter((a) => /^approved/i.test(String(a.status || '')));

  const items = [];
  const notIncluded = [];
  let totalHours = 0;
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  for (const emp of employees) {
    const ts = sheets[emp.id];
    if (!ts || !['Approved', 'Paid'].includes(ts.status)) {
      notIncluded.push({ employeeId: emp.id, name: emp.name, status: ts ? ts.status : 'No timesheet' });
      continue;
    }
    const empAdjs = adjustments.filter((a) => a.id === emp.id || a.name === emp.name);

    const calc = calculateEmployeePeriodPayroll(emp, {
      regHours: Number(ts.regular_hours) || 0,
      otHours: Number(ts.overtime_hours) || 0,
      // paid leave and paid holidays are both paid at the regular rate
      ptoHours: (Number(ts.pto_hours) || 0) + (Number(ts.holiday_hours) || 0),
      adjustments: empAdjs,
    });

    items.push(calc);

    totalHours = round2(totalHours + calc.hours.total);
    totalGross = round2(totalGross + calc.earnings.grossPay);
    totalDeductions = round2(totalDeductions + calc.deductions.total);
    totalNet = round2(totalNet + calc.netPay);
  }

  const runId = `PR-${periodId}`;

  const runSummary = {
    id: runId,
    periodId: period.id,
    year: period.year,
    periodNumber: period.period_number,
    entity: entity || 'My Global Hub Dominicana SRL',
    status: 'Calculated',
    currency: 'USD',
    totalEmployees: items.length,
    totalHours,
    totalGross,
    totalDeductions,
    totalNet,
    rulesVersion: DEFAULT_CONFIG.version,
    cutoffDate: period.cutoff,
    payDate: period.pay_date,
    items,
    // employees left out because their timesheet is not approved yet (shown to the owner before approving)
    notIncluded,
  };

  if (saveAsRun) {
    db.transaction(() => {
      // Upsert payroll run
      const existing = db.getOne(`SELECT id FROM payroll_runs WHERE id = ?`, [runId]);
      if (existing) {
        db.execute(
          `UPDATE payroll_runs
           SET total_employees = ?, total_hours = ?, total_gross = ?, total_deductions = ?,
               total_net = ?, rules_version = ?, status = 'Calculated', updated_at = datetime('now')
           WHERE id = ?`,
          [runSummary.totalEmployees, totalHours, totalGross, totalDeductions, totalNet, DEFAULT_CONFIG.version, runId]
        );
        db.execute(`DELETE FROM payroll_run_items WHERE run_id = ?`, [runId]);
      } else {
        db.execute(
          `INSERT INTO payroll_runs (
             id, period_id, year, period_number, entity, status, currency,
             total_employees, total_hours, total_gross, total_deductions, total_net, rules_version
           ) VALUES (?, ?, ?, ?, ?, 'Calculated', 'USD', ?, ?, ?, ?, ?, ?)`,
          [
            runId,
            period.id,
            period.year,
            period.period_number,
            runSummary.entity,
            runSummary.totalEmployees,
            totalHours,
            totalGross,
            totalDeductions,
            totalNet,
            DEFAULT_CONFIG.version,
          ]
        );
      }

      // Insert line items
      for (const item of items) {
        const itemId = `PRI-${runId}-${item.employeeId}`;
        db.execute(
          `INSERT INTO payroll_run_items (
             id, run_id, employee_id, employee_name, employee_role, rate,
             reg_hours, ot_hours, pto_hours, gross_pay, total_deductions, net_pay,
             deductions_json, adjustments_json, payout_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            runId,
            item.employeeId,
            item.name,
            item.role,
            item.rate,
            item.hours.regular,
            item.hours.overtime,
            item.hours.pto,
            item.earnings.grossPay,
            item.deductions.total,
            item.netPay,
            JSON.stringify(item.deductions.lines),
            JSON.stringify(item.adjustments),
            JSON.stringify(item.payoutDistribution),
          ]
        );
      }

      logAction({
        actor: user,
        action: 'PAYROLL_CALCULATED',
        entityType: 'payroll_run',
        entityId: runId,
        newValues: {
          periodId,
          totalEmployees: items.length,
          totalGross,
          totalNet,
        },
        ip,
      });
    });
  }

  return runSummary;
}

/**
 * PM First-tier Approval: Validates that contributor activities & hours have been audited
 */
function runOrThrow(runId, allowed, verb) {
  const run = db.getOne(`SELECT * FROM payroll_runs WHERE id = ?`, [runId]);
  if (!run) {
    const err = new Error(`Payroll run ${runId} not found`);
    err.status = 404;
    throw err;
  }
  if (!allowed.includes(run.status)) {
    const err = new Error(`Payroll run ${runId} is ${run.status}; it can only be ${verb} from ${allowed.join(' / ')}`);
    err.status = 409;
    throw err;
  }
  return run;
}

function pmApprovePayrollRun(runId, user = 'System', ip = '127.0.0.1') {
  const run = runOrThrow(runId, ['Calculated'], 'PM-approved');

  db.transaction(() => {
    db.execute(
      `UPDATE payroll_runs
       SET status = 'PM_Approved', pm_approved_by = ?, pm_approved_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
      [user, runId]
    );

    logAction({
      actor: user,
      action: 'PAYROLL_PM_APPROVED',
      entityType: 'payroll_run',
      entityId: runId,
      oldValues: { status: run.status },
      newValues: { status: 'PM_Approved', pmApprovedBy: user },
      ip,
    });
  });

  return { id: runId, status: 'PM_Approved', pmApprovedBy: user };
}

/**
 * Owner/Admin Second-tier Approval: Authorizes final payout, locking the run
 */
function approvePayrollRun(runId, user = 'System', ip = '127.0.0.1') {
  // Hours were already reviewed per timesheet (PM, then owner); this is the owner's sign-off on the money
  const run = runOrThrow(runId, ['Calculated', 'PM_Approved'], 'approved');
  if (!db.getOne(`SELECT id FROM payroll_run_items WHERE run_id = ?`, [runId])) {
    const err = new Error(`Payroll run ${runId} has no employees: approve their timesheets and recalculate first`);
    err.status = 409;
    throw err;
  }

  db.transaction(() => {
    db.execute(
      `UPDATE payroll_runs
       SET status = 'Approved',
           owner_approved_by = ?,
           owner_approved_at = datetime('now'),
           approved_by = ?,
           approved_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
      [user, user, runId]
    );

    // Update period status to Approved
    db.execute(
      `UPDATE pay_periods
       SET status = 'Approved', is_locked = 1, updated_at = datetime('now')
       WHERE id = ?`,
      [run.period_id]
    );

    logAction({
      actor: user,
      action: 'PAYROLL_RUN_APPROVED',
      entityType: 'payroll_run',
      entityId: runId,
      oldValues: { status: run.status },
      newValues: { status: 'Approved', approvedBy: user, ownerApprovedBy: user },
      ip,
    });
  });

  return { id: runId, status: 'Approved', approvedBy: user, ownerApprovedBy: user };
}

/**
 * Owner confirms the money left the bank: run → Paid, its timesheets → Paid, period → Paid.
 * Only an approved run can be paid; paid runs and sheets are final.
 */
function markPayrollRunPaid(runId, user = 'System', ip = '127.0.0.1') {
  const run = runOrThrow(runId, ['Approved'], 'marked paid');
  const empIds = db.query(`SELECT employee_id FROM payroll_run_items WHERE run_id = ?`, [runId]).map((r) => r.employee_id);
  const timesheetsController = require('../controllers/timesheets.controller'); // lazy: avoid a load-time cycle
  let sheets = 0;
  db.transaction(() => {
    db.execute(`UPDATE payroll_runs SET status = 'Paid', paid_at = datetime('now'), paid_by = ?, updated_at = datetime('now') WHERE id = ?`, [user, runId]);
    db.execute(`UPDATE pay_periods SET status = 'Paid', is_locked = 1, updated_at = datetime('now') WHERE id = ?`, [run.period_id]);
    sheets = timesheetsController.markPeriodPaid(run.period_id, empIds, user, runId);
    logAction({ actor: user, action: 'PAYROLL_RUN_PAID', entityType: 'payroll_run', entityId: runId, oldValues: { status: run.status }, newValues: { status: 'Paid', employees: empIds.length, timesheets: sheets }, ip });
  });
  return { id: runId, status: 'Paid', paidBy: user, employees: empIds.length, timesheetsPaid: sheets };
}

/**
 * List all saved payroll runs
 */
function listPayrollRuns() {
  return db.query(`SELECT * FROM payroll_runs ORDER BY created_at DESC`);
}

/**
 * Get full details of a saved payroll run including all items
 */
function getPayrollRunDetails(runId) {
  const run = db.getOne(`SELECT * FROM payroll_runs WHERE id = ?`, [runId]);
  if (!run) return null;

  const items = db.query(`SELECT * FROM payroll_run_items WHERE run_id = ? ORDER BY employee_name ASC`, [runId]);

  return {
    ...run,
    items: items.map((i) => ({
      ...i,
      deductions: JSON.parse(i.deductions_json || '[]'),
      adjustments: JSON.parse(i.adjustments_json || '[]'),
      payoutDistribution: JSON.parse(i.payout_json || '[]'),
    })),
  };
}

const ISSUED_RUN_STATUSES = ['Approved', 'Paid', 'Closed', 'Archived'];

/**
 * Pay stubs actually produced by saved payroll runs for one employee.
 * issuedOnly limits the result to runs that have been approved (what an employee may see).
 */
function listEmployeePaystubs(employeeId, { issuedOnly = true } = {}) {
  const items = db.query(`SELECT * FROM payroll_run_items WHERE employee_id = ?`, [employeeId]);
  const stubs = [];
  for (const i of items) {
    const run = db.getOne(`SELECT * FROM payroll_runs WHERE id = ?`, [i.run_id]);
    if (!run || (issuedOnly && !ISSUED_RUN_STATUSES.includes(run.status))) continue;
    const period = db.getOne(`SELECT * FROM pay_periods WHERE id = ?`, [run.period_id]) || {};
    stubs.push({
      id: i.id,
      runId: run.id,
      periodId: run.period_id,
      year: run.year,
      periodNumber: run.period_number,
      status: run.status,
      entity: run.entity,
      currency: run.currency || 'USD',
      startDate: period.start_date || null,
      endDate: period.end_date || null,
      payDate: period.pay_date || null,
      paidAt: run.paid_at || null,
      employeeId: i.employee_id,
      employeeName: i.employee_name,
      employeeRole: i.employee_role,
      rate: Number(i.rate) || 0,
      regHours: Number(i.reg_hours) || 0,
      otHours: Number(i.ot_hours) || 0,
      ptoHours: Number(i.pto_hours) || 0,
      grossPay: Number(i.gross_pay) || 0,
      totalDeductions: Number(i.total_deductions) || 0,
      netPay: Number(i.net_pay) || 0,
      deductions: JSON.parse(i.deductions_json || '[]'),
      adjustments: JSON.parse(i.adjustments_json || '[]'),
      payoutDistribution: JSON.parse(i.payout_json || '[]'),
    });
  }
  return stubs.sort((a, b) => (b.year - a.year) || (b.periodNumber - a.periodNumber));
}

module.exports = {
  calculateEmployeePeriodPayroll,
  calculatePeriodPayroll,
  pmApprovePayrollRun,
  approvePayrollRun,
  markPayrollRunPaid,
  listPayrollRuns,
  getPayrollRunDetails,
  listEmployeePaystubs,
};
