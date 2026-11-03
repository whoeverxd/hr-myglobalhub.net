const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const reminders = require('../src/services/reminders.service');

const mkUser = (id, name, role = 'employee') => {
  db.execute('DELETE FROM users WHERE id = ?', [id]);
  db.execute(`INSERT INTO users (id, email, password_hash, salt, name, role, is_active) VALUES (?, ?, 'x', 'x', ?, ?, 1)`,
    [id, `${id}@example.test`, name, role]);
  return { id, name, role };
};

test('Recordatorios: private to author + recipients; recipients mark done; only the author edits or deletes', () => {
  const ana = mkUser('usr_rem_ana', 'Ana Rem', 'pm');
  const edwin = mkUser('usr_rem_edwin', 'Edwin Rem');
  const luis = mkUser('usr_rem_luis', 'Luis Rem');
  const admin = mkUser('usr_rem_admin', 'Admin Rem', 'admin');
  try {
    // A note to oneself (no recipients = the author)
    const own = reminders.create(ana, { text: '  Revisar contratos  ' });
    assert.equal(own.text, 'Revisar contratos');
    assert.deepEqual(own.recipients.map((r) => r.userId), [ana.id]);

    // One note to several people
    const team = reminders.create(ana, { text: 'No olviden preparar la demo del viernes', recipients: [edwin.id, luis.id], color: 'pink', dueDate: '2026-11-06' });
    assert.equal(team.color, 'pink');
    assert.equal(team.dueDate, '2026-11-06');
    assert.equal(team.forMe, false);

    // Visibility: nobody else, not even an admin
    assert.deepEqual(reminders.list(edwin).map((r) => r.id), [team.id]);
    assert.deepEqual(reminders.list(luis).map((r) => r.id), [team.id]);
    assert.deepEqual(reminders.list(admin), []);
    assert.equal(reminders.list(ana).length, 2);
    assert.throws(() => reminders.setDone(admin, team.id), (e) => e.status === 404, "someone else's reminder looks missing");

    // Recipients mark it done for themselves; the author sees who did
    assert.throws(() => reminders.update(edwin, team.id, { text: 'cambio' }), (e) => e.status === 403);
    assert.throws(() => reminders.remove(luis, team.id), (e) => e.status === 403);
    assert.equal(reminders.setDone(edwin, team.id, true).done, true);
    assert.deepEqual(reminders.list(edwin), [], 'done ones are hidden');
    assert.equal(reminders.list(edwin, { includeDone: true }).length, 1);
    assert.deepEqual(reminders.list(ana).find((r) => r.id === team.id).recipients.map((r) => [r.name, r.done]), [['Edwin Rem', true], ['Luis Rem', false]]);
    reminders.setDone(luis, team.id, true);
    assert.equal(reminders.list(ana).some((r) => r.id === team.id), false, 'done by everyone → hidden for the author too');
    assert.throws(() => reminders.setDone(ana, team.id), (e) => e.status === 403, 'the author is not a recipient');

    // The author edits: recipients kept keep their state, new ones start pending
    const edited = reminders.update(ana, team.id, { text: 'Demo el viernes a las 10', recipients: [luis.id, admin.id] });
    assert.equal(edited.text, 'Demo el viernes a las 10');
    assert.deepEqual(edited.recipients.map((r) => [r.userId, r.done]), [[admin.id, false], [luis.id, true]]);
    assert.deepEqual(reminders.list(edwin, { includeDone: true }), [], 'a removed recipient no longer sees it');

    // Validation
    assert.throws(() => reminders.create(ana, { text: '   ' }), (e) => e.status === 400);
    assert.throws(() => reminders.create(ana, { text: 'x', recipients: ['usr_nobody'] }), (e) => e.status === 400);
    assert.throws(() => reminders.create(ana, { text: 'x', dueDate: '2026-13-40' }), (e) => e.status === 400);

    // Deleting
    reminders.remove(ana, team.id);
    assert.deepEqual(reminders.list(luis, { includeDone: true }), []);
    reminders.forgetUser(ana.id);
    assert.equal(db.query('SELECT id FROM reminders WHERE author_user_id = ?', [ana.id]).length, 0);
  } finally {
    for (const u of [ana, edwin, luis, admin]) { reminders.forgetUser(u.id); db.execute('DELETE FROM users WHERE id = ?', [u.id]); }
  }
});
