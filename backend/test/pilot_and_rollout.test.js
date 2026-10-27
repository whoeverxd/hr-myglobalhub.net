const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const db = require('../src/db');
const reconciliationService = require('../src/services/reconciliation.service');
const signoffController = require('../src/controllers/signoff.controller');
const rolloutController = require('../src/controllers/rollout.controller');
const payrollEngine = require('../src/services/payroll-engine.service');

test('Parallel Pilot Cycle: Cent-by-cent audit against legacy baseline data', () => {
  const periodId = 'PP-2025-08';

  // 1. Calculate payroll for the period
  const run = payrollEngine.calculatePeriodPayroll({
    periodId,
    entity: 'All',
    saveAsRun: true,
    user: 'Marcus Calderon',
    ip: '127.0.0.1',
  });
  assert.ok(run.items.length > 0, 'Payroll run should contain items');

  // 2. Perform parallel reconciliation with exact matching baseline
  const legacyBaseline = run.items.map((item) => ({
    employeeId: item.employeeId,
    grossPay: item.earnings.grossPay,
    totalDeductions: item.deductions.total,
    netPay: item.netPay,
    regHours: item.hours.regular,
    otHours: item.hours.overtime,
  }));

  const report = reconciliationService.reconcileParallelRun({
    periodId,
    runId: run.id,
    legacyItems: legacyBaseline,
    user: 'Elena Rostova',
    ip: '127.0.0.1',
  });

  assert.equal(report.status, 'PASSED_CENT_ACCURACY', 'Should pass with 100% cent accuracy');
  assert.equal(report.parityRatePercent, 100, 'Parity rate should be 100%');
  assert.equal(report.discrepancyCount, 0, 'Should have 0 discrepancies');
  assert.equal(report.totalCentsDiscrepancy, 0, 'Total delta should be exactly $0.00');
  assert.equal(report.exactMatches, run.items.length, 'All evaluated employees must match legacy');

  // Verify audit entry exists
  const audits = reconciliationService.getReconciliationHistory(periodId);
  assert.ok(audits.length > 0, 'Audit log should record parallel reconciliation event');
  assert.equal(audits[0].actor, 'Elena Rostova');
});

test('Parallel Pilot Cycle: Variance detection on intentional discrepancy', () => {
  const periodId = 'PP-2025-08';
  const run = payrollEngine.calculatePeriodPayroll({ periodId, entity: 'All', saveAsRun: false });
  const firstEmp = run.items[0];

  // Intentionally introduce a $15.50 delta in legacy net pay for first employee
  const modifiedLegacy = run.items.map((item, idx) => ({
    employeeId: item.employeeId,
    grossPay: item.earnings.grossPay,
    totalDeductions: item.deductions.total,
    netPay: idx === 0 ? item.netPay + 15.5 : item.netPay,
  }));

  const report = reconciliationService.reconcileParallelRun({
    periodId,
    legacyItems: modifiedLegacy,
    user: 'Auditor Compliance',
    ip: '127.0.0.1',
  });

  assert.equal(report.status, 'VARIANCE_DETECTED', 'Status should flag detected variance');
  assert.ok(report.discrepancyCount >= 1, 'Should register at least 1 discrepancy');
  assert.equal(report.totalCentsDiscrepancy, 15.5, 'Total cents discrepancy must equal $15.50');
  assert.ok(report.parityRatePercent < 100, 'Parity rate must be less than 100%');
});

test('Formal Sign-off: Digital SHA-256 signatures across Payroll, Finance, and Compliance', () => {
  const periodId = 'PP-2025-08';

  // Clear existing signoffs for clean test isolation
  db.execute('DELETE FROM payroll_signoffs WHERE period_id = ?', [periodId]);

  let status = signoffController.getSignoffsForPeriod(periodId);
  assert.equal(status.isFullyApproved, false, 'Initial state should not be fully approved');
  assert.equal(status.signedCount, 0);
  assert.deepEqual(status.pendingDepartments, ['payroll', 'finance', 'compliance']);

  // 1. Sign-off by Payroll (Elena Rostova)
  const reqPayroll = {
    body: { periodId, department: 'payroll', notes: 'All 80 regular hours and OT verified against daily activities' },
    user: { name: 'Elena Rostova' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  let capturedRes = {};
  const resMock1 = {
    status: (code) => { capturedRes.code = code; return resMock1; },
    json: (data) => { capturedRes.data = data; },
  };
  signoffController.recordSignoff(reqPayroll, resMock1, (err) => { if (err) throw err; });

  assert.equal(capturedRes.code, 201);
  assert.ok(capturedRes.data.signoff.signatureHash, 'Must generate SHA-256 hash');
  assert.equal(capturedRes.data.signoff.signatureHash.length, 64);
  assert.equal(capturedRes.data.summary.signedCount, 1);
  assert.equal(capturedRes.data.summary.isFullyApproved, false);

  // 2. Sign-off by Finance (Marcus Calderon)
  const reqFinance = {
    body: { periodId, department: 'finance', notes: 'Tax retentions DGII, FICA and HMRC confirmed' },
    user: { name: 'Marcus Calderon' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  signoffController.recordSignoff(reqFinance, resMock1, (err) => { if (err) throw err; });
  assert.equal(capturedRes.data.summary.signedCount, 2);
  assert.equal(capturedRes.data.summary.isFullyApproved, false);

  // 3. Sign-off by Compliance (Auditor Compliance)
  const reqCompliance = {
    body: { periodId, department: 'compliance', notes: 'Legal labor laws and NACHA ACH disbursement rules compliant' },
    user: { name: 'Auditor Compliance' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  signoffController.recordSignoff(reqCompliance, resMock1, (err) => { if (err) throw err; });

  assert.equal(capturedRes.data.summary.signedCount, 3);
  assert.equal(capturedRes.data.summary.isFullyApproved, true, 'Period must be fully approved when all 3 sign');
  assert.equal(capturedRes.data.summary.pendingDepartments.length, 0);

  // Verify stored records in DB
  const inDb = db.query('SELECT * FROM payroll_signoffs WHERE period_id = ? ORDER BY department ASC', [periodId]);
  assert.equal(inDb.length, 3);
  assert.equal(inDb.find((s) => s.department === 'compliance').signed_by, 'Auditor Compliance');
  assert.equal(inDb.find((s) => s.department === 'finance').signed_by, 'Marcus Calderon');
  assert.equal(inDb.find((s) => s.department === 'payroll').signed_by, 'Elena Rostova');
});

test('Progressive Rollout: Multi-HQ stages configuration and staged activation', () => {
  // Reset for clean test isolation
  db.execute("UPDATE rollout_stages SET status = 'SCHEDULED_STAGE_2' WHERE org_id = 'MGH USA Inc.'");

  let capturedRes = {};
  const resMock = {
    json: (data) => { capturedRes.data = data; },
  };

  // 1. Get rollout status
  rolloutController.getRolloutStatus({}, resMock, (err) => { if (err) throw err; });
  const status = capturedRes.data;

  assert.ok(status.stages.length >= 3, 'Must have at least 3 stages (Dominicana, USA, UK)');
  assert.equal(status.activeHQ, 'Dominicana', 'Phase 1 active HQ must be Dominicana');

  const domStage = status.stages.find((s) => s.short === 'Dominicana');
  assert.equal(domStage.phase, 1);
  assert.equal(domStage.status, 'LIVE_ACTIVE');

  const usaStage = status.stages.find((s) => s.short === 'USA');
  assert.equal(usaStage.phase, 2);
  assert.equal(usaStage.status, 'SCHEDULED_STAGE_2');

  const ukStage = status.stages.find((s) => s.short === 'UK');
  assert.equal(ukStage.phase, 3);
  assert.equal(ukStage.status, 'SCHEDULED_STAGE_3');

  // 2. Advance USA stage to LIVE_ACTIVE
  const reqUpdate = {
    params: { orgId: 'MGH USA Inc.' },
    body: { status: 'LIVE_ACTIVE', description: 'Transición completada a producción en sede USA' },
    user: { name: 'Admin System' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };

  rolloutController.updateRolloutStage(reqUpdate, resMock, (err) => { if (err) throw err; });
  assert.equal(capturedRes.data.stage.status, 'LIVE_ACTIVE');
  assert.equal(capturedRes.data.stage.short, 'USA');

  // Verify audit log for rollout update
  const audit = db.getOne(
    `SELECT * FROM audit_logs WHERE action = 'HQ_ROLLOUT_STAGE_UPDATED' ORDER BY id DESC LIMIT 1`
  );
  assert.ok(audit, 'Audit log must record HQ rollout update');
  assert.equal(audit.actor, 'Admin System');

  // Revert back USA to SCHEDULED_STAGE_2 for idempotency
  db.execute(`UPDATE rollout_stages SET status = 'SCHEDULED_STAGE_2' WHERE org_id = 'MGH USA Inc.'`);
});
