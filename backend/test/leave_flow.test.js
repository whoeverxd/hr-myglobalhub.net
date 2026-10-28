const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const routes = require('../src/routes');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

test('Leave flow: employee request (frontend payload) is stored and visible to reviewers until decided', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());
  const login = async (email) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.equal(r.status, 200);
    const d = await r.json();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${d.token}` };
  };
  const emp = await login('zain@myglobalhub.net'); // contractor MGH-1043
  const admin = await login('edwin@myglobalhub.net'); // admin

  // Exactly what the Leave screen sends (empId/name are forced to the caller by the backend for employees)
  let r = await fetch(`${base}/leave`, { method: 'POST', headers: emp, body: JSON.stringify({ empId: 'MGH-1043', name: 'Zain Rondon', type: 'Personal', fromDate: '2025-09-08', toDate: '2025-09-09', reason: 'Trámite' }) });
  assert.equal(r.status, 201);
  const created = await r.json();
  assert.equal(created.status, 'Pending Supervisor');

  r = await fetch(`${base}/leave`, { headers: admin });
  assert.ok((await r.json()).some((l) => l.id === created.id), 'reviewer sees the new request');
  r = await fetch(`${base}/leave`, { headers: emp });
  assert.ok((await r.json()).every((l) => l.emp === 'MGH-1043'), 'employee only sees their own');

  // Employee may cancel their own pending request, but not approve it
  r = await fetch(`${base}/leave/${created.id}/review`, { method: 'PATCH', headers: emp, body: JSON.stringify({ action: 'approve' }) });
  assert.equal(r.status, 403);
  r = await fetch(`${base}/leave/${created.id}/review`, { method: 'PATCH', headers: admin, body: JSON.stringify({ action: 'approve' }) });
  assert.equal((await r.json()).status, 'Pending HR');
  r = await fetch(`${base}/leave/${created.id}/review`, { method: 'PATCH', headers: admin, body: JSON.stringify({ action: 'approve' }) });
  assert.equal((await r.json()).status, 'Approved');
});
