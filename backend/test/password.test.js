const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const authService = require('../src/services/auth.service');

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);

test('New accounts get a random one-time password, never a shared default', () => {
  const email = `pw-new-${uniq()}@example.test`;
  const user = authService.ensureUserForEmployee({ email, name: 'Pw New', role: 'employee', employeeId: null });
  assert.ok(user.initialPassword, 'a generated password is returned once');
  assert.notEqual(user.initialPassword, 'Password123!');
  assert.ok(user.initialPassword.length >= 14);
  assert.ok(authService.authenticateUser(email, user.initialPassword), 'the generated password works');
  assert.equal(authService.authenticateUser(email, 'Password123!'), null, 'the old shared default does not');

  const again = authService.ensureUserForEmployee({ email, name: 'Pw New' });
  assert.equal(again.initialPassword, undefined, 'an existing account never re-issues a password');
});

test('Change password requires the current password and enforces strength', async () => {
  const email = `pw-change-${uniq()}@example.test`;
  const user = authService.ensureUserForEmployee({ email, name: 'Pw Change' });

  await assert.rejects(
    authService.changePassword({ userId: user.id, currentPassword: 'wrong', newPassword: 'NewPassword2024' }),
    (e) => e.status === 401
  );
  await assert.rejects(
    authService.changePassword({ userId: user.id, currentPassword: user.initialPassword, newPassword: 'short' }),
    (e) => e.status === 400
  );
  const ok = await authService.changePassword({ userId: user.id, currentPassword: user.initialPassword, newPassword: 'NewPassword2024' });
  assert.equal(ok.ok, true);
  assert.ok(authService.authenticateUser(email, 'NewPassword2024'));
  assert.equal(authService.authenticateUser(email, user.initialPassword), null);
});

test('Google-only accounts (no local password) can set one without a current password', async () => {
  const email = `pw-google-${uniq()}@example.test`;
  const id = 'usr_test_' + uniq();
  db.execute(
    `INSERT INTO users (id, email, password_hash, salt, name, role, entity, is_active) VALUES (?, ?, '', '', ?, 'employee', 'MGH Dominicana SRL', 1)`,
    [id, email, 'Pw Google']
  );
  assert.equal(authService.hasLocalPassword(id), false);
  assert.equal(authService.authenticateUser(email, ''), null, 'an empty password never signs in');
  assert.equal(authService.authenticateUser(email, 'anything'), null);

  await authService.changePassword({ userId: id, newPassword: 'GoogleUser2024x' });
  assert.equal(authService.hasLocalPassword(id), true);
  assert.ok(authService.authenticateUser(email, 'GoogleUser2024x'));

  // Once a password exists, changing it again needs the current one (or a Google re-verification)
  await assert.rejects(authService.changePassword({ userId: id, newPassword: 'Another2024xx' }), (e) => e.status === 401);
});
