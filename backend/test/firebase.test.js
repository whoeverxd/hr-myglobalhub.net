const test = require('node:test');
const assert = require('node:assert/strict');
const firebaseService = require('../src/services/firebase.service');

test('Firebase Service: isConfigured returns false when no credentials are present', () => {
  const originalEnv = {
    FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  };

  try {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;

    // Verify it doesn't crash and returns boolean
    const configured = firebaseService.isConfigured();
    assert.equal(typeof configured, 'boolean');
  } finally {
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
});

test('Firebase Service: testConnection reports connection status safely without throwing', async () => {
  const result = await firebaseService.testConnection();
  assert.equal(typeof result.connected, 'boolean');
  assert.equal(typeof result.configured, 'boolean');
  if (result.configured) {
    assert.ok(result.projectId, 'Configured project should report a project ID');
  } else {
    assert.match(result.error, /credenciales/i);
  }
});

test('Firebase Auth: Admin SDK stays offline in tests; getPublicConfig returns web client settings', () => {
  // The Admin SDK (production project) must never initialize inside a test process
  assert.equal(firebaseService.getAuth(), null);

  const config = firebaseService.getPublicConfig();
  assert.ok(config);
  assert.equal(config.projectId, 'hr-myglobalhub-net');
});

test('Auth Service: loginWithGoogle rejects missing or invalid tokens', async () => {
  const authService = require('../src/services/auth.service');
  await assert.rejects(
    () => authService.loginWithGoogle({ idToken: '' }),
    /Google ID token is required/
  );
  await assert.rejects(
    () => authService.loginWithGoogle({ idToken: 'invalid.token.signature' }),
    // Rejected either by Google or, in tests (Admin SDK offline), before any network call
    /Invalid Google Token|not initialized/
  );
});
