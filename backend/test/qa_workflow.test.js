const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');
const { planProject } = require('../scripts/setup-qa-workflow');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

test('QA workflow: assignee → Listo para QA; another member → Completado or Bug encontrado (with a note)', async (t) => {
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
  const luis = await login('luis@myglobalhub.net'); // MGH-1044
  const zain = await login('zain@myglobalhub.net'); // MGH-1043

  const KEY = 'TQQ';
  db.execute('DELETE FROM project_tasks WHERE project_id IN (SELECT id FROM jira_projects WHERE key = ?)', [KEY]);
  db.execute('DELETE FROM project_statuses WHERE project_id IN (SELECT id FROM jira_projects WHERE key = ?)', [KEY]);
  db.execute('DELETE FROM project_members WHERE project_id IN (SELECT id FROM jira_projects WHERE key = ?)', [KEY]);
  db.execute('DELETE FROM jira_projects WHERE key = ?', [KEY]);
  assert.equal((await call(admin, 'POST', '/projects', { key: KEY, name: 'QA Test' })).status, 201);
  for (const id of ['MGH-1044', 'MGH-1043']) assert.equal((await call(admin, 'POST', `/projects/${KEY}/members`, { userId: id })).status, 201);

  const statuses = (await call(luis, 'GET', `/projects/${KEY}/statuses`)).data;
  assert.deepEqual(statuses.map((s) => s.name), ['Por hacer', 'En progreso', 'Listo para QA', 'Bug encontrado', 'Completado']);
  const ready = statuses.find((s) => s.qa_step === 'ready');
  const bug = statuses.find((s) => s.qa_step === 'bug');
  const done = statuses.find((s) => Number(s.is_done) === 1);

  // A task cannot be created already closed by its own assignee
  const own = (await call(luis, 'POST', `/projects/${KEY}/tasks`, { title: 'Login screen', statusId: done.id })).data;
  assert.notEqual(own.status_id, done.id);

  // Zain (not the assignee) cannot touch it before it is ready for QA
  assert.equal((await call(zain, 'PATCH', `/tasks/${own.id}/move`, { statusId: done.id })).status, 403);

  // Luis: "terminé" from #mytasks → Listo para QA, never Completado
  const finished = await call(luis, 'POST', `/tasks/${own.id}/complete`, { done: true });
  assert.equal(finished.status, 200);
  assert.equal(finished.data.status_id, ready.id);
  assert.equal((await call(luis, 'PATCH', `/tasks/${own.id}/move`, { statusId: done.id })).status, 403, 'nobody closes their own task');

  // It shows up in Zain's QA queue, not in Luis's
  assert.ok((await call(zain, 'GET', '/my/tasks')).data.qaQueue.some((x) => x.id === own.id));
  assert.ok(!(await call(luis, 'GET', '/my/tasks')).data.qaQueue.some((x) => x.id === own.id));

  // QA may only change the status of someone else's task
  assert.equal((await call(zain, 'PUT', `/tasks/${own.id}`, { statusId: done.id, title: 'hijacked' })).status, 403);
  // Bug encontrado needs a note
  assert.equal((await call(zain, 'PATCH', `/tasks/${own.id}/move`, { statusId: bug.id })).status, 400);
  const bugged = await call(zain, 'PATCH', `/tasks/${own.id}/move`, { statusId: bug.id, qaNote: 'El botón no valida el email' });
  assert.equal(bugged.status, 200);
  assert.equal(bugged.data.status_id, bug.id);
  assert.equal(bugged.data.qa_note, 'El botón no valida el email');
  assert.equal(bugged.data.qa_result, 'bug');

  // Back to Luis: fixes it and sends it again; Zain cannot close it from "Bug encontrado"
  assert.equal((await call(zain, 'PATCH', `/tasks/${own.id}/move`, { statusId: done.id })).status, 403);
  assert.equal((await call(luis, 'PATCH', `/tasks/${own.id}/move`, { statusId: ready.id })).status, 200);
  const passed = await call(zain, 'PATCH', `/tasks/${own.id}/move`, { statusId: done.id });
  assert.equal(passed.status, 200);
  assert.equal(passed.data.status_id, done.id);
  assert.equal(passed.data.qa_result, 'passed');

  // POST /tasks/:id/qa: same rules through the review endpoint
  const second = (await call(luis, 'POST', `/projects/${KEY}/tasks`, { title: 'Signup screen' })).data;
  assert.equal((await call(zain, 'POST', `/tasks/${second.id}/qa`, { result: 'passed' })).status, 409, 'not ready yet');
  await call(luis, 'POST', `/tasks/${second.id}/complete`, { done: true });
  assert.equal((await call(luis, 'POST', `/tasks/${second.id}/qa`, { result: 'passed' })).status, 403, 'not your own');
  assert.equal((await call(zain, 'POST', `/tasks/${second.id}/qa`, { result: 'bug' })).status, 400, 'bug needs a note');
  const viaQa = await call(zain, 'POST', `/tasks/${second.id}/qa`, { result: 'bug', note: 'Falta el mensaje de error' });
  assert.equal(viaQa.status, 200);
  assert.equal(viaQa.data.status_id, bug.id);

  // Admin may close any task, including their own
  const adminTask = (await call(admin, 'POST', `/projects/${KEY}/tasks`, { title: 'Admin task', own: true })).data;
  assert.equal((await call(admin, 'PATCH', `/tasks/${adminTask.id}/move`, { statusId: done.id })).status, 200);

  // A PM too: their own task to Listo para QA, Bug encontrado (with a note) or Completado, from any status
  const joshua = await login('joshua@myglobalhub.net'); // MGH-1042, pm
  const pmTask = (await call(joshua, 'POST', `/projects/${KEY}/tasks`, { title: 'PM task', own: true })).data;
  assert.equal(pmTask.assignee_id, 'MGH-1042');
  assert.equal((await call(joshua, 'PATCH', `/tasks/${pmTask.id}/move`, { statusId: ready.id })).status, 200);
  assert.equal((await call(joshua, 'PATCH', `/tasks/${pmTask.id}/move`, { statusId: bug.id, qaNote: 'Revisar textos' })).status, 200);
  assert.equal((await call(joshua, 'PATCH', `/tasks/${pmTask.id}/move`, { statusId: done.id })).status, 200, 'from Bug encontrado straight to Completado');
  const pmTask2 = (await call(joshua, 'POST', `/projects/${KEY}/tasks`, { title: 'PM task 2', own: true })).data;
  assert.equal((await call(joshua, 'POST', `/tasks/${pmTask2.id}/complete`, { done: true })).data.status_id, done.id, 'PM "terminé" closes it');
});

test('setup-qa-workflow plan: renames the old defaults in place and adds Bug encontrado before Completado', () => {
  let n = 0;
  const steps = planProject({ key: 'X' }, [
    { id: 'a', name: 'To Do', position: 0, is_done: 0 },
    { id: 'b', name: 'In Progress', position: 1, is_done: 0 },
    { id: 'c', name: 'Code Review', position: 2, is_done: 0 },
    { id: 'd', name: 'Done', position: 3, is_done: 1 },
  ], () => 'new' + (++n));
  const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
  assert.equal(byId.a.name, 'Por hacer');
  assert.equal(byId.c.name, 'Listo para QA');
  assert.equal(byId.c.qa_step, 'ready');
  assert.equal(byId.d.name, 'Completado');
  assert.equal(byId.d.position, 4);
  const ins = steps.filter((s) => s.op === 'insert');
  assert.deepEqual(ins.map((s) => [s.name, s.qa_step, s.position]), [['Bug encontrado', 'bug', 3]]);
  // Already migrated → nothing to do
  assert.deepEqual(planProject({ key: 'X' }, [
    { id: 'a', name: 'Por hacer', position: 0 }, { id: 'c', name: 'Listo para QA', qa_step: 'ready', position: 1 },
    { id: 'e', name: 'Bug encontrado', qa_step: 'bug', position: 2 }, { id: 'd', name: 'Completado', is_done: 1, position: 3 },
  ]), []);
});
