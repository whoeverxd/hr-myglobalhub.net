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

test('Admin changes any login role from #admin (PUT /users/:id/role)', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());
  const login = async (email) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.equal(r.status, 200, 'login ' + email);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${(await r.json()).token}` };
  };
  const put = async (h, id, role) => {
    const r = await fetch(`${base}/users/${encodeURIComponent(id)}/role`, { method: 'PUT', headers: h, body: JSON.stringify({ role }) });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };

  const luisUser = db.getOne(`SELECT id, role FROM users WHERE LOWER(email) = 'luis@myglobalhub.net'`);
  const edwinUser = db.getOne(`SELECT id FROM users WHERE LOWER(email) = 'edwin@myglobalhub.net'`);
  t.after(() => db.execute(`UPDATE users SET role = ? WHERE id = ?`, [luisUser.role, luisUser.id]));

  const admin = await login('edwin@myglobalhub.net');
  const pm = await login('joshua@myglobalhub.net');

  assert.equal((await put(pm, luisUser.id, 'pm')).status, 403, 'only admin');
  assert.equal((await put(admin, luisUser.id, 'superadmin')).status, 400, 'unknown role');
  assert.equal((await put(admin, edwinUser.id, 'employee')).status, 400, 'not your own role');
  assert.equal((await put(admin, 'usr-nope', 'pm')).status, 404);

  const r = await put(admin, luisUser.id, 'pm');
  assert.equal(r.status, 200);
  assert.equal(r.data.role, 'pm');
  assert.equal(r.data.previousRole, luisUser.role);
  assert.equal(db.getOne(`SELECT role FROM users WHERE id = ?`, [luisUser.id]).role, 'pm');
});
