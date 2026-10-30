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

test('Admin deletes a login from #admin (DELETE /users/:id); the employee record stays', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());
  const login = async (email) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.equal(r.status, 200, 'login ' + email);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${(await r.json()).token}` };
  };
  const del = async (h, id) => {
    const r = await fetch(`${base}/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: h });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };

  // A throw-away login linked to Luis's employee record (a duplicate, like the .com logins in production)
  const id = 'usr-delete-test';
  db.execute(`DELETE FROM users WHERE id = ?`, [id]);
  db.execute(
    `INSERT INTO users (id, email, password_hash, salt, name, role, entity, employee_id, is_active) VALUES (?, 'luis.dup@test.local', 'x', 'y', 'Luis dup', 'employee', 'MGH Dominicana SRL', 'MGH-1044', 1)`,
    [id]
  );
  db.execute(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, 'tok-delete-test', '2099-01-01 00:00:00')`, [id]);
  t.after(() => { db.execute(`DELETE FROM users WHERE id = ?`, [id]); db.execute(`DELETE FROM sessions WHERE user_id = ?`, [id]); });

  const admin = await login('edwin@myglobalhub.net');
  const pm = await login('joshua@myglobalhub.net');
  const edwinUser = db.getOne(`SELECT id FROM users WHERE LOWER(email) = 'edwin@myglobalhub.net'`);

  assert.equal((await del(pm, id)).status, 403, 'only admin');
  assert.equal((await del(admin, edwinUser.id)).status, 400, 'never your own account');
  assert.equal((await del(admin, 'usr-nope')).status, 404);

  const r = await del(admin, id);
  assert.equal(r.status, 200);
  assert.equal(r.data.email, 'luis.dup@test.local');
  assert.ok(!db.getOne(`SELECT id FROM users WHERE id = ?`, [id]), 'login gone');
  assert.equal(db.query(`SELECT token FROM sessions WHERE user_id = ?`, [id]).length, 0, 'sessions gone');
  assert.ok(db.getOne(`SELECT id FROM employees WHERE id = 'MGH-1044'`), 'employee record kept');
  assert.ok(db.query(`SELECT id FROM audit_logs WHERE action = 'USER_DELETED' AND entity_id = ?`, [id]).length > 0, 'audited');
});

test('The last active admin login can never be deleted', () => {
  const auth = require('../src/services/auth.service');
  const admins = db.query(`SELECT id FROM users WHERE role = 'admin' AND is_active = 1`);
  // Pretend every other admin is inactive, then try to delete the remaining one as some other admin actor
  const keep = admins[0];
  const others = admins.slice(1).map((a) => a.id);
  for (const o of others) db.execute(`UPDATE users SET is_active = 0 WHERE id = ?`, [o]);
  try {
    assert.throws(() => auth.deleteUser({ userId: keep.id, actor: { id: 'someone-else', role: 'admin', name: 'Test' } }), (e) => e.status === 409);
  } finally {
    for (const o of others) db.execute(`UPDATE users SET is_active = 1 WHERE id = ?`, [o]);
  }
});
