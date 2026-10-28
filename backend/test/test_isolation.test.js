const test = require('node:test');
const assert = require('node:assert/strict');

// Guard for the CLAUDE.md rule: no test may ever reach production Firestore (hr-myglobalhub-net).
// Simulates the dangerous case — a test started directly with `node --test` while .env says firestore.
test('Test processes are pinned to local SQLite and never initialize Firebase', () => {
  process.env.DATABASE_CLIENT = 'firestore';
  delete process.env.DISABLE_REMOTE_FIREBASE;
  delete process.env.ALLOW_FIRESTORE_IN_TESTS;

  const connection = require('../src/db/connection');
  assert.equal(connection.getAdapter().dialect, 'sqlite');

  const firebaseService = require('../src/services/firebase.service');
  assert.equal(firebaseService.getFirestore(), null, 'Firestore must not initialize in tests');
  assert.equal(firebaseService.getAuth(), null, 'Firebase Admin Auth must not initialize in tests');
});
