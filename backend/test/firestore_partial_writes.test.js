const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../src/db/adapters/firestore.adapter');

// Two instances (production + a local dev boot) share one Firestore. An UPDATE must send only the SET columns:
// sending the whole cached doc let a stale instance put back fields it never touched (e.g. an old role).
test('Firestore UPDATE writes only the changed columns, never the whole cached doc', async (t) => {
  const writes = [];
  const fakeDb = { collection: (col) => ({ doc: (id) => ({ set: (data, opts) => { writes.push({ col, id, data, opts }); return Promise.resolve(); }, delete: () => Promise.resolve() }) }) };
  const orig = { getFirestore: adapter.getFirestore, persist: adapter._persistLocalSnapshot, init: adapter.init };
  adapter.getFirestore = () => fakeDb;
  adapter._persistLocalSnapshot = () => {}; // never touch data/firestore_cache.json from a test
  adapter.init = async () => {};
  const users = adapter._getCollectionMap('users');
  const prev = users.get('usr-stale-test');
  // This instance still holds the OLD role in memory
  users.set('usr-stale-test', { id: 'usr-stale-test', email: 'stale@test.local', role: 'pm', name: 'Stale', last_login_at: null });
  t.after(() => {
    Object.assign(adapter, { getFirestore: orig.getFirestore, _persistLocalSnapshot: orig.persist, init: orig.init });
    if (prev) users.set('usr-stale-test', prev); else users.delete('usr-stale-test');
  });

  await adapter.execute(`UPDATE users SET last_login_at = ? WHERE id = ?`, ['2026-10-29 21:00:00', 'usr-stale-test']);

  const w = writes.find((x) => x.col === 'users' && x.id === 'usr-stale-test');
  assert.ok(w, 'a write was sent');
  assert.equal(w.data.last_login_at, '2026-10-29 21:00:00');
  assert.equal(w.data.role, undefined, 'the stale cached role must not be sent');
  assert.equal(w.data.email, undefined);
  assert.deepEqual(w.opts, { merge: true });
  // Locally the cached doc still has every field
  const local = users.get('usr-stale-test');
  assert.equal(local.role, 'pm');
  assert.equal(local.last_login_at, '2026-10-29 21:00:00');
});
