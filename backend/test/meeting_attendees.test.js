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

test('Meeting attendees: a PM logs one meeting and it lands on every attendee sheet', async (t) => {
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

  const date = '2025-11-04';
  const periodId = 'PP-2025-21'; // 1–15 Nov 2025
  const ids = ['MGH-1042', 'MGH-1043', 'MGH-1044', 'MGH-1045'];
  for (const id of ids) {
    db.execute('DELETE FROM timesheets WHERE employee_id = ? AND period_id = ?', [id, periodId]);
    db.execute('DELETE FROM daily_activities WHERE employee_id = ? AND date >= ? AND date <= ?', [id, '2025-11-01', '2025-11-15']);
  }
  // Zain (contractor) already submitted this quincena (status = first review step) → must be skipped, not touched
  db.execute(
    `INSERT INTO timesheets (id, employee_id, employee_name, period_id, status) VALUES (?, ?, ?, ?, 'Supervisión PM')`,
    [`TS-${periodId}-MGH-1043`, 'MGH-1043', 'Zain', periodId]
  );
  t.after(() => db.execute('DELETE FROM timesheets WHERE id = ?', [`TS-${periodId}-MGH-1043`]));

  const pm = await login('joshua@myglobalhub.net');
  const luis = await login('luis@myglobalhub.net');
  const meeting = { date, hours: 1.5, jiraKey: 'GENERAL', jiraSummary: 'Reunion de avances', workType: 'Reunión', description: 'Seguimiento semanal' };

  // Guards
  assert.equal((await call(luis, 'POST', '/activities', { ...meeting, attendees: ['MGH-1045'] })).status, 403, 'employees cannot add attendees');
  assert.equal((await call(pm, 'POST', '/activities', { ...meeting, workType: 'Desarrollo', attendees: ['MGH-1044'] })).status, 400, 'only meetings take attendees');
  const unknown = await call(pm, 'POST', '/activities', { ...meeting, attendees: ['MGH-9999'] });
  assert.equal(unknown.status, 400, 'unknown attendee');
  assert.match(unknown.data.error, /MGH-9999/);
  assert.equal(db.query('SELECT id FROM daily_activities WHERE date = ?', [date]).length, 0, 'rejected calls create nothing');

  // Happy path: organizer + Luis + Lissandra created, Zain skipped; self and duplicates ignored
  const r = await call(pm, 'POST', '/activities', { ...meeting, attendees: ['MGH-1044', 'MGH-1045', 'MGH-1043', 'MGH-1044', 'MGH-1042'] });
  assert.equal(r.status, 201);
  assert.equal(r.data.empId, 'MGH-1042');
  assert.ok(r.data.meeting && /^MTG-/.test(r.data.meeting.id));
  assert.deepEqual([...r.data.meeting.created].sort(), ['MGH-1044', 'MGH-1045']);
  assert.equal(r.data.meeting.skipped.length, 1);
  assert.equal(r.data.meeting.skipped[0].employeeId, 'MGH-1043');
  assert.equal(r.data.meeting.skipped[0].status, 'Supervisión PM');
  assert.equal(r.data.meeting.skipped[0].periodId, periodId);

  const rows = db.query('SELECT employee_id, hours, meeting_id, logged_by FROM daily_activities WHERE date = ? ORDER BY employee_id', [date]);
  assert.deepEqual(rows.map((x) => x.employee_id), ['MGH-1042', 'MGH-1044', 'MGH-1045']);
  assert.ok(rows.every((x) => x.meeting_id === r.data.meeting.id && Number(x.hours) === 1.5));
  assert.equal(rows.find((x) => x.employee_id === 'MGH-1042').logged_by, null, "organizer's own row is not 'logged by' anyone else");
  assert.equal(rows.find((x) => x.employee_id === 'MGH-1044').logged_by, 'MGH-1042');

  // The attendee sees it as their own activity, labelled with who logged it, and can delete it while Draft
  const mine = (await call(luis, 'GET', `/activities?dateFrom=2025-11-01&dateTo=2025-11-15`)).data;
  const copy = mine.find((a) => a.date === date);
  assert.ok(copy, 'attendee sees the meeting');
  assert.equal(copy.loggedBy, 'MGH-1042');
  assert.ok(copy.loggedByName, 'organizer name resolved');
  assert.equal(copy.meetingId, r.data.meeting.id);

  // It counts toward the attendee's sheet like any other activity
  await call(luis, 'POST', '/timesheets/ensure', { periodId });
  const sheet = (await call(luis, 'GET', `/timesheets?empId=MGH-1044&periodId=${periodId}&live=1`)).data[0];
  assert.equal(Number(sheet.reg) + Number(sheet.ot || 0), 1.5);

  assert.equal((await call(luis, 'DELETE', `/activities/${copy.id}`)).status, 200);
});
