const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

test('PUT /activities/:id edits an activity in place (owner, admin; never a meeting copy or a submitted sheet)', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());
  const login = async (email) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.equal(r.status, 200, 'login ' + email);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${(await r.json()).token}` };
  };
  const call = async (h, method, path, body) => {
    const r = await fetch(`${base}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };

  const date = '2025-12-03';
  const periodId = 'PP-2025-23'; // 1–15 Dec 2025
  const ids = ['MGH-1042', 'MGH-1044', 'MGH-1045'];
  const clean = () => {
    for (const id of ids) {
      db.execute('DELETE FROM timesheets WHERE employee_id = ? AND period_id = ?', [id, periodId]);
      db.execute('DELETE FROM daily_activities WHERE employee_id = ? AND date >= ? AND date <= ?', [id, '2025-12-01', '2025-12-15']);
    }
  };
  clean();
  t.after(clean);

  const pm = await login('joshua@myglobalhub.net');
  const luis = await login('luis@myglobalhub.net');
  const admin = await login('edwin@myglobalhub.net');

  const base0 = { date, hours: 2, jiraKey: 'GENERAL', jiraSummary: 'Trabajo', workType: 'Desarrollo', description: 'Primera version' };
  const created = await call(luis, 'POST', '/activities', base0);
  assert.equal(created.status, 201);
  const id = created.data.id;

  // Owner edits in place: same id, new values, files/links kept
  const files = [{ id: 'f1', name: 'captura.png', type: 'image', url: '/x.png', size: '1 MB' }];
  const r = await call(luis, 'PUT', `/activities/${id}`, { ...base0, hours: 3.5, description: 'Corregida', files, links: [{ url: 'https://example.com', label: 'Doc' }] });
  assert.equal(r.status, 200);
  assert.equal(r.data.id, id);
  assert.equal(r.data.hours, 3.5);
  const row = db.getOne('SELECT * FROM daily_activities WHERE id = ?', [id]);
  assert.equal(Number(row.hours), 3.5);
  assert.equal(row.description, 'Corregida');
  assert.equal(JSON.parse(row.evidences_json)[0].name, 'captura.png');
  assert.ok(db.query(`SELECT id FROM audit_logs WHERE action = 'ACTIVITY_UPDATED' AND entity_id = ?`, [id]).length > 0, 'audited');

  // Someone else's activity: 403 for a PM, allowed for admin (correction)
  assert.equal((await call(pm, 'PUT', `/activities/${id}`, { ...base0, hours: 1 })).status, 403);
  assert.equal((await call(admin, 'PUT', `/activities/${id}`, { ...base0, hours: 4 })).status, 200);
  assert.equal((await call(luis, 'PUT', '/activities/ACT-nope', base0)).status, 404);
  assert.equal((await call(luis, 'PUT', `/activities/${id}`, { ...base0, hours: 0 })).status, 400);

  // A meeting copy can't be edited (only deleted); the organizer edits only their own row
  const meeting = await call(pm, 'POST', '/activities', { ...base0, workType: 'Reunión', hours: 1, attendees: ['MGH-1045'] });
  assert.equal(meeting.status, 201);
  const copy = db.getOne('SELECT id FROM daily_activities WHERE meeting_id = ? AND employee_id = ?', [meeting.data.meeting.id, 'MGH-1045']);
  assert.equal((await call(admin, 'PUT', `/activities/${copy.id}`, { ...base0, hours: 5 })).status, 409, 'meeting copy, even for admin');
  const org = await call(pm, 'PUT', `/activities/${meeting.data.id}`, { ...base0, workType: 'Reunión', hours: 2 });
  assert.equal(org.status, 200);
  assert.equal(Number(db.getOne('SELECT hours FROM daily_activities WHERE id = ?', [copy.id]).hours), 1, 'attendee copy untouched');

  // Once the sheet left Draft/Returned: 409
  db.execute(`INSERT INTO timesheets (id, employee_id, employee_name, period_id, status) VALUES (?, ?, ?, ?, 'PM Review')`, [`TS-${periodId}-MGH-1044`, 'MGH-1044', 'Luis', periodId]);
  assert.equal((await call(luis, 'PUT', `/activities/${id}`, { ...base0, hours: 1 })).status, 409);
});
