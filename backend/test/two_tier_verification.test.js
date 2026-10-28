const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { login } = require('../src/services/auth.service');
const activitiesController = require('../src/controllers/activities.controller');
const timesheetsController = require('../src/controllers/timesheets.controller');
const payrollEngine = require('../src/services/payroll-engine.service');
const storageService = require('../src/services/storage.service');

test('Protocolo de Doble Verificación: 1. PM audita actividades vs horas -> 2. Dueño/Admin autoriza y ejecuta pago', async () => {
  const empId = 'MGH-1044';
  const periodId = 'PP-2025-13'; // 1–15 July 2025 (no leave/holiday fixtures for this employee)
  const date1 = '2025-07-01';
  const date2 = '2025-07-04';

  // 0. Limpieza inicial
  db.execute('DELETE FROM timesheets WHERE employee_id = ? AND period_id = ?', [empId, periodId]);
  db.execute('DELETE FROM daily_activities WHERE employee_id = ? AND date >= ? AND date <= ?', [empId, '2025-07-01', '2025-07-15']);
  db.execute('DELETE FROM payroll_runs WHERE period_id = ?', [periodId]);

  // 1. Colaborador registra dos actividades con entregables
  const ev1 = storageService.saveFile({
    originalName: 'arquitectura_sqlite.png',
    dataBase64: Buffer.from('Evidencia 1').toString('base64'),
    mimeType: 'image/png',
    category: 'evidences',
    user: 'Luis Rodriguez',
  });

  const act1 = activitiesController.createActivity({
    employeeId: empId,
    date: date1,
    jiraKey: 'MSH-214',
    jiraSummary: 'Implementación del backend relacional SQLite',
    hours: 4.0,
    workType: 'Desarrollo',
    description: 'Esquema ACID y persistencia de timesheets',
    files: [{ id: ev1.id, name: ev1.originalName, url: ev1.url }],
    links: [{ label: 'PR #42', url: 'https://github.com/mgh/payroll/pull/42' }],
  }, 'Luis Rodriguez');

  const act2 = activitiesController.createActivity({
    employeeId: empId,
    date: date2,
    jiraKey: 'MSH-215',
    jiraSummary: 'Conciliación de actividades vs horas',
    hours: 4.0,
    workType: 'Desarrollo',
    description: 'Endpoint y servicio de conciliación',
  }, 'Luis Rodriguez');

  assert.ok(act1.id);
  assert.ok(act2.id);

  // 2. Colaborador envía la hoja: sus 8 horas salen de las actividades registradas
  const ts = timesheetsController.ensureTimesheet(empId, periodId, 'Luis Rodriguez');
  const submittedTs = timesheetsController.submitTimesheet(ts.id, 'Luis Rodriguez');
  assert.equal(submittedTs.status, 'PM Review');
  assert.equal(submittedTs.stepIdx, 0);

  // 3. FASE 1: Rol PM (Joshua Hernandez) realiza la auditoría de horas vs actividades
  const reconciliation = timesheetsController.getTimesheetReconciliation(ts.id);
  assert.ok(reconciliation);
  assert.equal(reconciliation.reconciliation.totalTimesheetHours, 8.0);
  assert.equal(reconciliation.reconciliation.totalActivityHours, 8.0);
  assert.equal(reconciliation.reconciliation.varianceHours, 0);
  assert.equal(reconciliation.reconciliation.matchPercentage, 100);
  assert.equal(reconciliation.reconciliation.isCompliant, true);
  assert.equal(reconciliation.verificationProtocol.currentStep, 'PM_REVIEW');
  assert.equal(reconciliation.verificationProtocol.step1_pmReview.status, 'AWAITING_REVIEW');
  assert.equal(reconciliation.verificationProtocol.step2_ownerApproval.status, 'BLOCKED_BY_PM');

  // PM aprueba el paquete de horas y actividades
  const pmApproved = timesheetsController.approveTimesheet(
    ts.id,
    { comment: 'Actividades y PR #42 verificados en Jira MSH-214 y MSH-215', role: 'pm' },
    'Joshua Hernandez'
  );
  assert.equal(pmApproved.status, 'Owner Approval');
  assert.equal(pmApproved.stepIdx, 1);

  // 4. FASE 2: Rol Dueño / Admin (Edwin Montalvo) realiza la segunda revisión
  const reconPostPm = timesheetsController.getTimesheetReconciliation(ts.id);
  assert.equal(reconPostPm.verificationProtocol.currentStep, 'OWNER_APPROVAL');
  assert.equal(reconPostPm.verificationProtocol.step1_pmReview.status, 'APPROVED');
  assert.equal(reconPostPm.verificationProtocol.step2_ownerApproval.status, 'AWAITING_APPROVAL');

  // Dueño aprueba finalmente la hoja de tiempo
  const ownerApproved = timesheetsController.approveTimesheet(
    ts.id,
    { comment: 'Autorización ejecutiva aprobada para dispersión', role: 'admin' },
    'Edwin Montalvo'
  );
  assert.equal(ownerApproved.status, 'Approved');

  // 5. Verificación a nivel de corrida de nómina (Payroll Run)
  const run = payrollEngine.calculatePeriodPayroll({
    periodId,
    entity: 'All',
    saveAsRun: true,
    user: 'Joshua Hernandez',
  });
  assert.equal(run.status, 'Calculated');

  // PM otorga la primera aprobación de la corrida
  const pmRun = payrollEngine.pmApprovePayrollRun(run.id, 'Joshua Hernandez');
  assert.equal(pmRun.status, 'PM_Approved');
  assert.equal(pmRun.pmApprovedBy, 'Joshua Hernandez');

  // Dueño / Admin otorga la segunda aprobación y autoriza pago
  const ownerRun = payrollEngine.approvePayrollRun(run.id, 'Edwin Montalvo');
  assert.equal(ownerRun.status, 'Approved');
  assert.equal(ownerRun.ownerApprovedBy, 'Edwin Montalvo');

  // Verificar en base de datos
  const dbRun = db.getOne('SELECT * FROM payroll_runs WHERE id = ?', [run.id]);
  assert.equal(dbRun.status, 'Approved');
  assert.equal(dbRun.pm_approved_by, 'Joshua Hernandez');
  assert.equal(dbRun.owner_approved_by, 'Edwin Montalvo');
  assert.ok(dbRun.pm_approved_at);
  assert.ok(dbRun.owner_approved_at);

  // Limpieza
  storageService.deleteFile(ev1.id);
  activitiesController.deleteActivity(act1.id);
  activitiesController.deleteActivity(act2.id);
  db.execute('DELETE FROM timesheets WHERE id = ?', [ts.id]);
  db.execute('DELETE FROM payroll_runs WHERE id = ?', [run.id]);
});
