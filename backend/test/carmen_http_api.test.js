const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const routes = require('../src/routes');
const authService = require('../src/services/auth.service');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return http.createServer(app);
}

test('HTTP API: Integration test for Carmen routes and bootstrap', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  t.after(() => {
    server.close();
  });

  // 1. Authenticate to get Bearer token (Admin user)
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@myglobalhub.net', password: 'AdminPassword123!' }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.token);
  const authHeader = { Authorization: `Bearer ${loginData.token}` };

  // 2. GET /api/bootstrap returns enriched payload with organizations, holidays, leaveRequests, timesheets
  const bootRes = await fetch(`${baseUrl}/bootstrap`, { headers: authHeader });
  assert.equal(bootRes.status, 200);
  const bootData = await bootRes.json();
  assert.ok(Array.isArray(bootData.organizations), 'bootstrap must have organizations');
  assert.ok(Array.isArray(bootData.holidays), 'bootstrap must have holidays');
  assert.ok(Array.isArray(bootData.leaveRequests), 'bootstrap must have leaveRequests');
  assert.ok(Array.isArray(bootData.timesheets), 'bootstrap must have timesheets');
  assert.ok(Array.isArray(bootData.exceptions), 'bootstrap must have exceptions');

  // 3. GET /api/organizations
  const orgsRes = await fetch(`${baseUrl}/organizations`, { headers: authHeader });
  assert.equal(orgsRes.status, 200);
  const orgs = await orgsRes.json();
  assert.ok(orgs.length >= 3);

  // 4. POST /api/workflows/split-ot
  const splitRes = await fetch(`${baseUrl}/workflows/split-ot`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dailyHours: [8, 8, 8, 8, 8, 4],
      otConfig: { rule: 'weekly', weekly: 40 },
    }),
  });
  assert.equal(splitRes.status, 200);
  const split = await splitRes.json();
  assert.equal(split.total, 44);
  assert.equal(split.regular, 40);
  assert.equal(split.overtime, 4);

  // 5. GET /api/attendance/holidays
  const holRes = await fetch(`${baseUrl}/attendance/holidays`, { headers: authHeader });
  assert.equal(holRes.status, 200);
  const hols = await holRes.json();
  assert.ok(hols.length >= 10);

  // 6. GET /api/attendance/punches
  const punchRes = await fetch(`${baseUrl}/attendance/punches?empId=MGH-1042`, { headers: authHeader });
  assert.equal(punchRes.status, 200);
  const punches = await punchRes.json();
  assert.ok(Array.isArray(punches));

  // 7. GET /api/leave
  const leaveRes = await fetch(`${baseUrl}/leave`, { headers: authHeader });
  assert.equal(leaveRes.status, 200);
  const leaves = await leaveRes.json();
  assert.ok(Array.isArray(leaves));

  // 8. GET /api/timesheets
  const tsRes = await fetch(`${baseUrl}/timesheets`, { headers: authHeader });
  assert.equal(tsRes.status, 200);
  const timesheets = await tsRes.json();
  assert.ok(Array.isArray(timesheets));
});
