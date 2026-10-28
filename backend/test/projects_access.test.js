const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');
const employeesController = require('../src/controllers/employees.controller');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

test('Projects: members-only visibility, own tasks, PM assignment by employee, onboarding membership', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());
  const login = async (email, password = 'Password123!') => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(r.status, 200, 'login ' + email);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${(await r.json()).token}` };
  };
  const call = async (h, method, path, body) => {
    const r = await fetch(`${base}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };
  const admin = await login('edwin@myglobalhub.net');
  const luis = await login('luis@myglobalhub.net'); // MGH-1044, employee
  const zain = await login('zain@myglobalhub.net'); // MGH-1043, contractor

  // Fresh projects for this run
  for (const k of ['TQA', 'TQB']) {
    db.execute('DELETE FROM project_tasks WHERE project_id IN (SELECT id FROM jira_projects WHERE key = ?)', [k]);
    db.execute('DELETE FROM project_members WHERE project_id IN (SELECT id FROM jira_projects WHERE key = ?)', [k]);
    db.execute('DELETE FROM jira_projects WHERE key = ?', [k]);
  }
  assert.equal((await call(admin, 'POST', '/projects', { key: 'TQA', name: 'Test Project A' })).status, 201);
  assert.equal((await call(admin, 'POST', '/projects', { key: 'TQB', name: 'Test Project B' })).status, 201);
  assert.equal((await call(luis, 'POST', '/projects', { key: 'TQX', name: 'nope' })).status, 403, 'employees cannot create projects');

  // Members are employees; unknown ids are rejected
  assert.equal((await call(admin, 'POST', '/projects/TQA/members', { userId: 'MGH-9999' })).status, 400);
  assert.equal((await call(admin, 'POST', '/projects/TQA/members', { userId: 'MGH-1044', role: 'member' })).status, 201);
  assert.equal((await call(admin, 'POST', '/projects/TQA/members', { userId: 'MGH-1044', role: 'lead' })).status, 201, 're-adding updates the role');
  const members = (await call(admin, 'GET', '/projects/TQA/members')).data;
  assert.equal(members.filter((m) => m.user_id === 'MGH-1044').length, 1, 'no duplicate membership');

  // Luis only sees TQA
  const luisProjects = (await call(luis, 'GET', '/projects')).data.map((p) => p.key);
  assert.ok(luisProjects.includes('TQA'));
  assert.ok(!luisProjects.includes('TQB'));
  assert.equal((await call(luis, 'GET', '/projects/TQB/tasks')).status, 403);
  assert.equal((await call(luis, 'GET', '/projects/TQA/tasks')).status, 200);

  // Luis creates a task: it is assigned to him whatever he sends
  const own = await call(luis, 'POST', '/projects/TQA/tasks', { title: 'Checkout flow', assigneeName: 'Joshua Hernandez' });
  assert.equal(own.status, 201);
  assert.equal(own.data.assignee_id, 'MGH-1044');

  // PM/admin assigns by employee (also resolves legacy names to the employee id)
  const forZain = await call(admin, 'POST', '/projects/TQA/tasks', { title: 'Payments API', assigneeName: 'Zain Rondon' });
  assert.equal(forZain.data.assignee_id, 'MGH-1043');

  // Luis moves his own task, but cannot touch Zain's or reassign his own to someone else
  const statuses = (await call(luis, 'GET', '/projects/TQA/statuses')).data;
  const done = statuses.find((s) => s.is_done);
  assert.equal((await call(luis, 'PATCH', `/tasks/${own.data.id}/move`, { statusId: done.id })).status, 200);
  assert.equal((await call(luis, 'PATCH', `/tasks/${forZain.data.id}/move`, { statusId: done.id })).status, 403);
  assert.equal((await call(luis, 'PUT', `/tasks/${own.data.id}`, { assigneeId: 'MGH-1043' })).status, 403);
  assert.equal((await call(luis, 'DELETE', `/tasks/${own.data.id}`)).status, 403);

  // Zain is not a member of TQA: no access to its tasks, and search never leaks them
  assert.equal((await call(zain, 'GET', `/tasks/${forZain.data.id}`)).status, 403);
  const zainSearch = (await call(zain, 'GET', '/tasks/search?query=Payments&limit=50')).data;
  assert.ok(!zainSearch.some((x) => x.id === forZain.data.id));
  const mine = (await call(luis, 'GET', '/tasks/search?mine=1&limit=50')).data;
  assert.ok(mine.some((x) => x.id === own.data.id));
  assert.ok(mine.every((x) => x.assignee_id === 'MGH-1044'));

  // Onboarding: an employee created with projects becomes a member of them
  const email = `proj-onboard-${Date.now()}@example.test`;
  const emp = employeesController.createEmployee({ first: 'Onboard', last: 'Test', email, entity: 'MGH Dominicana SRL', dept: 'Engineering', role: 'Developer', etype: 'Full-time', rate: 30, projects: 'TQB, Test Project A' });
  const keys = db.query('SELECT jp.key FROM project_members pm JOIN jira_projects jp ON pm.project_id = jp.id WHERE pm.user_id = ?', [emp.id]).map((r) => r.key).sort();
  assert.deepEqual(keys, ['TQA', 'TQB']);
});
