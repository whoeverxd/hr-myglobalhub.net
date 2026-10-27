const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const routes = require('../src/routes');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => {
    console.error('TEST SERVER ERROR:', err);
    res.status(err.status || 500).json({ error: err.message });
  });
  return http.createServer(app);
}

test('Access Cleanup: Employee role can only access their own data, PM and Admin see all', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  t.after(() => {
    server.close();
  });

  // 1. Login as Employee (Luis Rodriguez - MGH-1044)
  const empLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'luis@myglobalhub.net', password: 'Password123!' }),
  });
  assert.equal(empLoginRes.status, 200);
  const empLoginData = await empLoginRes.json();
  const empAuth = { Authorization: `Bearer ${empLoginData.token}` };
  assert.equal(empLoginData.user.role, 'employee');
  assert.equal(empLoginData.user.employeeId, 'MGH-1044');

  // Employee GET /api/employees returns only Luis's employee record
  const empListRes = await fetch(`${baseUrl}/employees`, { headers: empAuth });
  assert.equal(empListRes.status, 200);
  const empList = await empListRes.json();
  assert.ok(Array.isArray(empList));
  assert.equal(empList.length, 1);
  assert.equal(empList[0].id, 'MGH-1044');

  // Employee GET /api/employees/MGH-1042 (another employee) returns 403 Forbidden
  const otherEmpRes = await fetch(`${baseUrl}/employees/MGH-1042`, { headers: empAuth });
  assert.equal(otherEmpRes.status, 403, 'Employee must not be able to view other employees details');

  // Employee GET /api/employees/MGH-1044 (own employee record) returns 200 OK
  const ownEmpRes = await fetch(`${baseUrl}/employees/MGH-1044`, { headers: empAuth });
  assert.equal(ownEmpRes.status, 200);
  const ownEmp = await ownEmpRes.json();
  assert.equal(ownEmp.id, 'MGH-1044');

  // Employee GET /api/bootstrap returns filtered dataset (no other users' data)
  const empBootRes = await fetch(`${baseUrl}/bootstrap`, { headers: empAuth });
  assert.equal(empBootRes.status, 200);
  const empBoot = await empBootRes.json();
  assert.ok(Array.isArray(empBoot.timesheets));
  assert.ok(empBoot.timesheets.every((ts) => ts.emp === 'MGH-1044' || ts.employee_id === 'MGH-1044'));
  assert.ok(Array.isArray(empBoot.worklogs));
  assert.ok(empBoot.worklogs.every((w) => w.employeeId === 'MGH-1044'));
  assert.equal(empBoot.proofs.length, 0, 'Employees should not see company banking proofs');
  assert.equal(empBoot.contractors.length, 0, 'Employees should not see contractor records');

  // Employee cannot access contractor payments
  const empCtrRes = await fetch(`${baseUrl}/contractors`, { headers: empAuth });
  assert.equal(empCtrRes.status, 200);
  const empCtrList = await empCtrRes.json();
  assert.equal(empCtrList.length, 0);

  // Employee cannot view other employee's paystub
  const otherPaystubRes = await fetch(`${baseUrl}/payroll/paystub/MGH-1042/PP-2025-08`, { headers: empAuth });
  assert.equal(otherPaystubRes.status, 403);

  // Employee cannot view payroll runs
  const payrollRunsRes = await fetch(`${baseUrl}/payroll/runs`, { headers: empAuth });
  assert.equal(payrollRunsRes.status, 403);

  // 2. Login as Contractor (Zain Rondon - CTR-1043 / MGH-1043)
  const ctrLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'zain@myglobalhub.net', password: 'Password123!' }),
  });
  assert.equal(ctrLoginRes.status, 200);
  const ctrLoginData = await ctrLoginRes.json();
  const ctrAuth = { Authorization: `Bearer ${ctrLoginData.token}` };
  assert.equal(ctrLoginData.user.role, 'contractor');

  // Contractor GET /api/contractors returns only Zain's own contractor profile
  const ctrListRes = await fetch(`${baseUrl}/contractors`, { headers: ctrAuth });
  assert.equal(ctrListRes.status, 200);
  const ctrList = await ctrListRes.json();
  assert.ok(Array.isArray(ctrList));
  assert.equal(ctrList.length, 1);
  assert.equal(ctrList[0].name, 'Zain Rondon');

  // Contractor GET other contractor returns 403
  const otherCtrRes = await fetch(`${baseUrl}/contractors/CTR-9999`, { headers: ctrAuth });
  assert.equal(otherCtrRes.status, 403);

  // Contractor GET /api/employees returns only self
  const ctrEmpListRes = await fetch(`${baseUrl}/employees`, { headers: ctrAuth });
  assert.equal(ctrEmpListRes.status, 200);
  const ctrEmpList = await ctrEmpListRes.json();
  assert.equal(ctrEmpList.length, 1);
  assert.equal(ctrEmpList[0].id, 'MGH-1043');

  // 3. Login as PM (Joshua Hernandez - MGH-1042)
  const pmLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'joshua@myglobalhub.net', password: 'Password123!' }),
  });
  assert.equal(pmLoginRes.status, 200);
  const pmLoginData = await pmLoginRes.json();
  const pmAuth = { Authorization: `Bearer ${pmLoginData.token}` };
  assert.equal(pmLoginData.user.role, 'pm');

  // PM sees all employees
  const pmEmpListRes = await fetch(`${baseUrl}/employees`, { headers: pmAuth });
  assert.equal(pmEmpListRes.status, 200);
  const pmEmpList = await pmEmpListRes.json();
  assert.ok(pmEmpList.length > 1, 'PM must see all employees');

  // PM can view any employee details
  const pmViewOtherEmpRes = await fetch(`${baseUrl}/employees/MGH-1044`, { headers: pmAuth });
  assert.equal(pmViewOtherEmpRes.status, 200);

  // PM sees all contractors
  const pmCtrListRes = await fetch(`${baseUrl}/contractors`, { headers: pmAuth });
  assert.equal(pmCtrListRes.status, 200);
  const pmCtrList = await pmCtrListRes.json();
  assert.ok(pmCtrList.length >= 1, 'PM must see contractors');

  // PM can list payroll runs
  const pmRunsRes = await fetch(`${baseUrl}/payroll/runs`, { headers: pmAuth });
  assert.equal(pmRunsRes.status, 200);

  // PM bootstrap returns complete overview
  const pmBootRes = await fetch(`${baseUrl}/bootstrap`, { headers: pmAuth });
  assert.equal(pmBootRes.status, 200);
  const pmBoot = await pmBootRes.json();
  assert.ok(pmBoot.timesheets.length > 0);
  assert.ok(pmBoot.contractors.length > 0);

  // 4. Login as Admin
  const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@myglobalhub.net', password: 'AdminPassword123!' }),
  });
  assert.equal(adminLoginRes.status, 200);
  const adminLoginData = await adminLoginRes.json();
  const adminAuth = { Authorization: `Bearer ${adminLoginData.token}` };
  assert.equal(adminLoginData.user.role, 'admin');

  // Admin sees all employees
  const adminEmpListRes = await fetch(`${baseUrl}/employees`, { headers: adminAuth });
  assert.equal(adminEmpListRes.status, 200);
  const adminEmpList = await adminEmpListRes.json();
  assert.ok(adminEmpList.length > 1);
});
