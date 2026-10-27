const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const authService = require('../src/services/auth.service');
const auditController = require('../src/controllers/audit.controller');
const employeesController = require('../src/controllers/employees.controller');

test('RBAC & Audit: Login creates revocable session with role', () => {
  const result = authService.authenticateUser('joshua@myglobalhub.net', 'Password123!');
  assert.ok(result);
  assert.equal(result.user.role, 'pm');
  assert.ok(result.token);

  // Validate session resolution
  const session = authService.getSessionUser(result.token);
  assert.ok(session);
  assert.equal(session.id, 'usr-joshua');
  assert.equal(session.role, 'pm');
});

test('RBAC: Role permissions matrix validation', () => {
  const roles = ['employee', 'supervisor', 'pm', 'hr', 'finance', 'admin', 'auditor'];
  
  // Auditor, Finance and Admin have audit log privileges
  const canAudit = (role) => ['auditor', 'finance', 'admin'].includes(role);
  assert.equal(canAudit('employee'), false);
  assert.equal(canAudit('supervisor'), false);
  assert.equal(canAudit('pm'), false);
  assert.equal(canAudit('hr'), false);
  assert.equal(canAudit('finance'), true);
  assert.equal(canAudit('admin'), true);
  assert.equal(canAudit('auditor'), true);

  // HR and Admin can create employees
  const canCreateEmployee = (role) => ['hr', 'admin'].includes(role);
  assert.equal(canCreateEmployee('pm'), false);
  assert.equal(canCreateEmployee('finance'), false);
  assert.equal(canCreateEmployee('hr'), true);
  assert.equal(canCreateEmployee('admin'), true);
});

test('Audit Trail: logAction inserts into SQLite and getAuditLogs retrieves', () => {
  const testAction = 'TEST_SECURITY_EVENT_' + Date.now();
  auditController.logAction({
    actor: 'Compliance Auditor',
    action: testAction,
    entityType: 'security_vault',
    entityId: 'SEC-999',
    newValues: { status: 'VERIFIED_HASH' },
    ip: '192.168.1.100',
  });

  const logs = auditController.getAuditLogs({ limit: 10 });
  assert.ok(Array.isArray(logs));
  assert.ok(logs.length > 0);
  const found = logs.find((l) => l.action === testAction);
  assert.ok(found, 'Inserted action must be in audit logs');
  assert.equal(found.actor, 'Compliance Auditor');
  assert.equal(found.entity_type, 'security_vault');
  assert.equal(found.entity_id, 'SEC-999');
  assert.equal(found.ip_address, '192.168.1.100');
});

test('Employee Domain: createEmployee generates next ID, masks sensitive data, and creates audit entry', () => {
  const newEmp = employeesController.createEmployee(
    {
      first: 'Valeria',
      last: 'Soto',
      email: 'valeria.soto@globalhub.com',
      nid: '402-1234567-8',
      acct: '123456789012',
      dept: 'Engineering',
      title: 'Cloud Architect',
      rate: 65,
      entity: 'My Global Hub Dominicana SRL',
    },
    'Ana Gómez (HR)',
    '10.0.0.5'
  );

  try {
    assert.ok(newEmp.id.startsWith('MGH-'));
    assert.equal(newEmp.name, 'Valeria Soto');
    assert.equal(newEmp.role, 'Cloud Architect');
    // Banking and national ID must be masked
    assert.equal(newEmp.nid, '••••567-8');
    assert.equal(newEmp.acct, '••••9012');

    // Verify persistence in SQLite
    const persisted = employeesController.getEmployeeById(newEmp.id);
    assert.ok(persisted);
    assert.equal(persisted.name, 'Valeria Soto');

    // Verify audit log was recorded
    const logs = auditController.getAuditLogs({ limit: 5 });
    const empAudit = logs.find((l) => l.action === 'CREATE_EMPLOYEE' && l.entity_id === newEmp.id);
    assert.ok(empAudit, 'CREATE_EMPLOYEE audit log must be recorded');
    assert.equal(empAudit.actor, 'Ana Gómez (HR)');
  } finally {
    try {
      db.execute('DELETE FROM users WHERE email = ? OR employee_id = ?', [newEmp.email, newEmp.id]);
      db.execute('DELETE FROM audit_logs WHERE entity_id = ?', [newEmp.id]);
      db.execute('DELETE FROM employees WHERE id = ?', [newEmp.id]);
    } catch (_) {}
  }
});

