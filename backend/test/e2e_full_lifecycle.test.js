const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { login } = require('../src/services/auth.service');
const activitiesController = require('../src/controllers/activities.controller');
const timesheetsController = require('../src/controllers/timesheets.controller');
const payrollEngine = require('../src/services/payroll-engine.service');
const bankingRailsService = require('../src/services/banking-rails.service');
const storageService = require('../src/services/storage.service');
const { getAuditLogs } = require('../src/controllers/audit.controller');

test('E2E Flujo 1: Colaborador registra actividad con evidencias -> Hoja de tiempo se totaliza -> Supervisor aprueba', async () => {
  const empId = 'MGH-1044';
  const periodId = 'PP-2025-10';
  const workDate = '2025-05-05';

  // Limpieza inicial idempotente
  db.execute('DELETE FROM timesheets WHERE employee_id = ? AND period_id = ?', [empId, periodId]);
  db.execute('DELETE FROM daily_activities WHERE employee_id = ? AND date >= ? AND date <= ?', [empId, '2025-05-01', '2025-05-15']);

  // 1. Empleado inicia sesion
  const loginResult = await login({
    email: 'luis@myglobalhub.net',
    password: 'Password123!',
    ip: '192.168.1.50',
  });
  assert.ok(loginResult.token, 'Debe generar token de sesion valido');
  assert.equal(loginResult.user.role, 'employee');

  // 2. Empleado adjunta evidencia multimedia
  const evidenceFile = storageService.saveFile({
    originalName: 'entregable_sprint.png',
    dataBase64: Buffer.from('Evidencia tecnica de arquitectura').toString('base64'),
    mimeType: 'image/png',
    category: 'evidences',
    user: loginResult.user.name,
    ip: '192.168.1.50',
  });
  assert.ok(evidenceFile.id);
  assert.ok(evidenceFile.url.startsWith('/api/uploads/'));

  // 3. Empleado registra actividad en #actDaily
  const activity = activitiesController.createActivity({
    employeeId: empId,
    date: workDate,
    jiraKey: 'MSH-215',
    jiraSummary: 'Módulo de registro por actividades y equivalencia',
    hours: 5.5,
    workType: 'Desarrollo',
    description: 'Implementación del flujo de equivalencia y pruebas de integración',
    files: [{ id: evidenceFile.id, name: evidenceFile.originalName, url: evidenceFile.url }],
    links: [{ label: 'PR #50', url: 'https://github.com/mgh/payroll/pull/50' }],
  }, loginResult.user.name, '192.168.1.50');

  assert.ok(activity.id);
  assert.equal(activity.hours, 5.5);

  // 4. Verificar hoja de tiempo garantizada y sincronizada
  const ts = timesheetsController.ensureTimesheet(empId, periodId, 'Luis Rodriguez');
  assert.ok(ts);
  assert.equal(ts.emp, empId);

  // 5. Enviar hoja de tiempo para aprobacion
  const submittedTs = timesheetsController.submitTimesheet(ts.id, loginResult.user.name, '192.168.1.50');
  assert.ok(submittedTs.status.includes('Review'));

  // 6. PM concilia horas vs actividades reportadas
  const reconciliation = timesheetsController.getTimesheetReconciliation(ts.id);
  assert.ok(reconciliation);
  assert.equal(reconciliation.reconciliation.totalActivityHours, 5.5);
  assert.equal(reconciliation.verificationProtocol.currentStep, 'PM_REVIEW');
  assert.equal(reconciliation.reconciliation.totalDeliverables, 1);

  // 7. Paso 1: PM Joshua aprueba la hoja de tiempo tras validar actividades
  const pmApprovedTs = timesheetsController.approveTimesheet(
    ts.id,
    { comment: 'Aprobado conforme a entregables y evidencias en Jira MSH-215', role: 'pm' },
    'Joshua Hernandez',
    '192.168.1.1'
  );
  assert.ok(['Owner Approval', 'Owner Approval Review', 'Approved'].includes(pmApprovedTs.status));

  // 8. Paso 2: Dueño / Admin Edwin realiza la segunda verificacion y aprueba para pago
  const ownerApprovedTs = timesheetsController.approveTimesheet(
    ts.id,
    { comment: 'Aprobación ejecutiva final para pago', role: 'admin' },
    'Edwin Montalvo',
    '192.168.1.1'
  );
  assert.equal(ownerApprovedTs.status, 'Approved');

  // 9. Auditoria de extremo a extremo
  const audits = getAuditLogs({ entityType: 'timesheet' });
  assert.ok(audits.some((a) => a.action === 'APPROVE_TIMESHEET'));

  // Limpieza
  storageService.deleteFile(evidenceFile.id);
  activitiesController.deleteActivity(activity.id);
  db.execute('DELETE FROM timesheets WHERE id = ?', [ts.id]);
});

test('E2E Flujo 2: Finanzas procesa calculo de nomina -> Validacion fiscal y balance -> Dispersion bancaria NACHA y BHD', async () => {
  const periodId = 'PP-2025-08';

  // 1. Finanzas inicia sesion
  const financeLogin = await login({
    email: 'admin@myglobalhub.net',
    password: 'AdminPassword123!',
    ip: '10.0.0.1',
  });
  assert.ok(financeLogin.token);
  assert.equal(financeLogin.user.role, 'admin');

  // 2. Ejecutar corrida de calculo de nomina
  const run = payrollEngine.calculatePeriodPayroll({
    periodId,
    entity: 'All',
    saveAsRun: true,
    user: financeLogin.user.name,
    ip: '10.0.0.1',
  });

  assert.ok(run.id);
  assert.ok(run.totalEmployees >= 4);
  assert.ok(run.totalGross > 0);
  assert.ok(run.totalNet > 0);

  // 3. Balance matematico exacto: Total Bruto - Deducciones === Total Neto
  const mathBalance = Math.abs((run.totalGross - run.totalDeductions) - run.totalNet);
  assert.ok(mathBalance < 0.05, `Discrepancia matematica de balance: ${mathBalance}`);

  // 4. Finanzas aprueba corrida de nomina
  const approvedRun = payrollEngine.approvePayrollRun(run.id, financeLogin.user.name, '10.0.0.1');
  assert.equal(approvedRun.status, 'Approved');

  // 5. Generar archivo de dispersion electronica NACHA ACH para empleados de EE. UU.
  const nacha = bankingRailsService.generateNachaFile({ periodId });
  assert.equal(nacha.format, 'NACHA-ACH');
  assert.ok(nacha.totalEntries >= 1);
  assert.equal(nacha.recordsCount % 10, 0);

  // 6. Generar archivo de dispersion Banco BHD Leon para empleados de Rep. Dominicana
  const bhd = bankingRailsService.generateBhdFile({ periodId, currency: 'DOP' });
  assert.equal(bhd.format, 'BANCO-BHD-LEON');
  assert.ok(bhd.totalEntries >= 1);
  assert.ok(bhd.totalAmount > 0);

  // 7. Generar lote de liquidacion Base USDC en criptoactivos
  const usdcBatch = bankingRailsService.generateUsdcPayoutBatch({ periodId });
  assert.equal(usdcBatch.format, 'BASE-USDC-BATCH');
  assert.equal(usdcBatch.batchPayload.chainId, 8453);
  assert.ok(usdcBatch.batchPayload.transactions.length >= 1);

  // 8. Generar comprobante de pago oficial verifiable (Paystub)
  const paystub = bankingRailsService.generatePaystub({
    employeeId: 'MGH-1042',
    periodId,
  });
  assert.ok(paystub.paystubId);
  assert.ok(paystub.fingerprint);
  assert.ok(paystub.netPay > 0);
  assert.ok(paystub.deductions.lines.length >= 1);
});
