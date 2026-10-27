const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const activitiesController = require('../src/controllers/activities.controller');
const { getAuditLogs } = require('../src/controllers/audit.controller');

test('Activities Domain: List, Create, and Delete activities in SQLite', () => {
  const empId = 'MGH-1042';
  const testDate = '2025-04-18';

  // 1. Create activity
  const created = activitiesController.createActivity({
    employeeId: empId,
    date: testDate,
    jiraKey: 'MSH-215',
    jiraSummary: 'Módulo de registro por actividades y equivalencia',
    hours: 3.5,
    workType: 'Desarrollo',
    description: 'Construcción del componente DailyActivities y endpoints backend',
    files: [{ name: 'screenshot.png', size: '1.2 MB', type: 'image' }],
    links: [{ label: 'PR #45', url: 'https://github.com/mgh/payroll/pull/45' }],
  }, 'Carlos Mendez');

  assert.ok(created.id);
  assert.equal(created.empId, empId);
  assert.equal(created.date, testDate);
  assert.equal(created.hours, 3.5);
  assert.equal(created.jiraKey, 'MSH-215');
  assert.equal(created.files.length, 1);
  assert.equal(created.links.length, 1);

  // 2. List activities for this employee and date
  const list = activitiesController.listActivities({ empId, date: testDate });
  assert.ok(list.length >= 1);
  const found = list.find((a) => a.id === created.id);
  assert.ok(found);
  assert.equal(found.hours, 3.5);
  assert.equal(found.workType, 'Desarrollo');

  // 3. Audit log verification
  const audits = getAuditLogs({ entityType: 'activity' });
  const audit = audits.find((a) => a.entity_id === created.id && a.action === 'CREATE_ACTIVITY');
  assert.ok(audit, 'Audit log should record CREATE_ACTIVITY');
  assert.equal(audit.actor, 'Carlos Mendez');

  // 4. Delete activity
  const delRes = activitiesController.deleteActivity(created.id, 'Carlos Mendez');
  assert.equal(delRes.ok, true);
  assert.equal(delRes.deleted, created.id);

  // 5. Verify deleted from list
  const listAfter = activitiesController.listActivities({ empId, date: testDate });
  assert.equal(listAfter.some((a) => a.id === created.id), false);

  // 6. Verify DELETE_ACTIVITY audit
  const deleteAudits = getAuditLogs({ entityType: 'activity' });
  const delAudit = deleteAudits.find((a) => a.entity_id === created.id && a.action === 'DELETE_ACTIVITY');
  assert.ok(delAudit, 'Audit log should record DELETE_ACTIVITY');
});

test('Activities Equivalence: Daily activity hours summation and comparison with punches', () => {
  const empId = 'MGH-1043';
  const testDate = '2025-04-29';

  // Limpiar actividades previas para aislar la prueba
  const prior = activitiesController.listActivities({ employeeId: empId, date: testDate });
  prior.forEach((a) => activitiesController.deleteActivity(a.id));

  // Registrar múltiples entregables que suman exactamente 8.0 horas
  const act1 = activitiesController.createActivity({
    employeeId: empId,
    date: testDate,
    jiraKey: 'CORE-108',
    jiraSummary: 'Database Sharding Pipeline',
    hours: 4.5,
    workType: 'Desarrollo',
    description: 'Particionado horizontal de tablas',
  });

  const act2 = activitiesController.createActivity({
    employeeId: empId,
    date: testDate,
    jiraKey: 'CORE-111',
    jiraSummary: 'Billing Event Stream',
    hours: 2.0,
    workType: 'Pruebas',
    description: 'Tests unitarios de streams',
  });

  const act3 = activitiesController.createActivity({
    employeeId: empId,
    date: testDate,
    jiraKey: 'ATLAS-398',
    jiraSummary: 'Sprint 24 Release Prep',
    hours: 1.5,
    workType: 'Reunión',
    description: 'Planificación de sprint',
  });

  // Resumen del día
  const summary = activitiesController.getActivitySummary(empId, testDate);
  assert.equal(summary.activityCount, 3);
  assert.equal(summary.totalHours, 8.0, 'La suma exacta de actividades (4.5 + 2.0 + 1.5) debe ser 8.0 horas');

  // Equivalencia: 8.0 horas de actividades equivalen exactamente a 8.0 horas de fichaje tradicional
  const standardWorkdayHours = 8.0;
  const variance = Math.abs(summary.totalHours - standardWorkdayHours);
  assert.equal(variance, 0, 'La jornada registrada por actividades cumple la meta de 8h sin discrepancia');

  // Limpieza
  activitiesController.deleteActivity(act1.id);
  activitiesController.deleteActivity(act2.id);
  activitiesController.deleteActivity(act3.id);
});

test('Activities Validation: Rejects missing empId, date, or invalid hours', () => {
  assert.throws(
    () => activitiesController.createActivity({ date: '2025-04-15', hours: 2 }),
    /employeeId and date are required/
  );

  assert.throws(
    () => activitiesController.createActivity({ employeeId: 'MGH-1042', hours: 2 }),
    /employeeId and date are required/
  );

  assert.throws(
    () => activitiesController.createActivity({ employeeId: 'MGH-1042', date: '2025-04-15', hours: 0 }),
    /hours must be a positive number/
  );

  assert.throws(
    () => activitiesController.createActivity({ employeeId: 'MGH-1042', date: '2025-04-15', hours: -3 }),
    /hours must be a positive number/
  );

  assert.throws(
    () => activitiesController.deleteActivity('NON-EXISTENT-ID'),
    /Activity not found/
  );
});
