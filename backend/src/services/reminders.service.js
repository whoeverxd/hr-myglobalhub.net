const db = require('../db');

/*
 * Recordatorios (sticky notes between team members, Dashboard / #reminders). Private: a reminder is visible only to
 * its author and its recipients (no role, admin included, sees anyone else's). The author edits and deletes it; each
 * recipient marks it done for themselves. Not written to the audit log, so its text never reaches audit viewers.
 * Tables: reminders (one row per note) + reminder_recipients (one row per recipient user, with their done state).
 */

const COLORS = ['yellow', 'blue', 'green', 'pink', 'purple'];
const MAX_TEXT = 500;
const MAX_RECIPIENTS = 50;

const fail = (status, message) => { const err = new Error(message); err.status = status; return err; };
const now = () => new Date().toISOString();
const newId = (p) => p + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

function activeUsers() {
  return db.query('SELECT id, name, email, role, employee_id, is_active FROM users')
    .filter((u) => Number(u.is_active) !== 0);
}

function cleanDate(d) {
  if (d == null || d === '') return null;
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s + 'T12:00:00'))) throw fail(400, 'La fecha del recordatorio no es válida.');
  return s;
}

function cleanInput({ text, color, dueDate } = {}, current = null) {
  const out = {};
  if (text !== undefined || !current) {
    const t = String(text || '').trim();
    if (!t) throw fail(400, 'Escribe el recordatorio.');
    if (t.length > MAX_TEXT) throw fail(400, `El recordatorio no puede pasar de ${MAX_TEXT} caracteres.`);
    out.text = t;
  }
  if (color !== undefined || !current) out.color = COLORS.includes(color) ? color : 'yellow';
  if (dueDate !== undefined || !current) out.due_date = cleanDate(dueDate);
  return out;
}

/** Recipient user ids → [{ id, name }], validated against the active logins. Empty → just the author. */
function cleanRecipients(ids, user) {
  const list = Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))] : [];
  if (!list.length) list.push(user.id);
  if (list.length > MAX_RECIPIENTS) throw fail(400, `Un recordatorio puede ir a ${MAX_RECIPIENTS} personas como máximo.`);
  const users = new Map(activeUsers().map((u) => [u.id, u]));
  const missing = list.filter((id) => !users.has(id));
  if (missing.length) throw fail(400, 'Alguno de los destinatarios ya no tiene una cuenta activa.');
  return list.map((id) => ({ id, name: users.get(id).name }));
}

function recipientsOf(reminderId) {
  return db.query('SELECT * FROM reminder_recipients WHERE reminder_id = ?', [reminderId]);
}

function view(r, rec, user) {
  const mine = r.author_user_id === user.id;
  const own = rec.find((x) => x.user_id === user.id);
  return {
    id: r.id,
    text: r.text,
    color: r.color || 'yellow',
    dueDate: r.due_date || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: { id: r.author_user_id, name: r.author_name || '—' },
    mine,
    forMe: !!own,
    done: own ? Number(own.done) === 1 : rec.length > 0 && rec.every((x) => Number(x.done) === 1),
    recipients: rec.map((x) => ({ userId: x.user_id, name: x.user_name || '—', done: Number(x.done) === 1, doneAt: x.done_at || null }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  };
}

function loadOwned(id, user) {
  const r = db.getOne('SELECT * FROM reminders WHERE id = ?', [id]);
  // Someone else's reminder answers like a missing one: its existence is private too
  if (!r || (r.author_user_id !== user.id && !recipientsOf(id).some((x) => x.user_id === user.id))) throw fail(404, 'No se encontró ese recordatorio.');
  return r;
}

const service = {
  COLORS,

  /** Active logins a reminder can be sent to */
  people() {
    return activeUsers().map((u) => ({ id: u.id, name: u.name, email: u.email, employeeId: u.employee_id || null }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  },

  /**
   * The reminders `user` wrote or received. Done ones (for a recipient: marked done by them; for an author who is not a
   * recipient: done by everyone) only with includeDone. Pending first, by due date (undated last), newest first.
   */
  list(user, { includeDone = false } = {}) {
    if (!user || !user.id) throw fail(401, 'Inicia sesión.');
    const received = new Set(db.query('SELECT reminder_id FROM reminder_recipients WHERE user_id = ?', [user.id]).map((x) => x.reminder_id));
    const rows = db.query('SELECT * FROM reminders').filter((r) => r.author_user_id === user.id || received.has(r.id));
    const all = rows.map((r) => view(r, recipientsOf(r.id), user)).filter((r) => includeDone || !r.done);
    return all.sort((a, b) => (a.done - b.done)
      || ((a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : (a.dueDate || '9999') > (b.dueDate || '9999') ? 1 : 0)
      || String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  create(user, input = {}) {
    if (!user || !user.id) throw fail(401, 'Inicia sesión.');
    const data = cleanInput(input);
    const recipients = cleanRecipients(input.recipients, user);
    const id = newId('REM');
    const ts = now();
    db.transaction(() => {
      db.execute('INSERT INTO reminders (id, text, color, due_date, author_user_id, author_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data.text, data.color, data.due_date, user.id, user.name || '—', ts, ts]);
      for (const p of recipients) {
        db.execute('INSERT INTO reminder_recipients (id, reminder_id, user_id, user_name, done, done_at) VALUES (?, ?, ?, ?, 0, NULL)',
          [newId('RMR'), id, p.id, p.name]);
      }
    });
    return view(db.getOne('SELECT * FROM reminders WHERE id = ?', [id]), recipientsOf(id), user);
  },

  /** Author only: text, color, date and recipients (people kept keep their done state) */
  update(user, id, input = {}) {
    const r = loadOwned(id, user);
    if (r.author_user_id !== user.id) throw fail(403, 'Solo quien escribió el recordatorio puede cambiarlo.');
    const data = cleanInput(input, r);
    const next = input.recipients !== undefined ? cleanRecipients(input.recipients, user) : null;
    db.transaction(() => {
      const fields = Object.keys(data);
      if (fields.length) db.execute(`UPDATE reminders SET ${fields.map((f) => f + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, [...fields.map((f) => data[f]), now(), id]);
      if (next) {
        const current = recipientsOf(id);
        const keep = new Set(next.map((p) => p.id));
        for (const x of current) if (!keep.has(x.user_id)) db.execute('DELETE FROM reminder_recipients WHERE id = ?', [x.id]);
        const have = new Set(current.map((x) => x.user_id));
        for (const p of next) if (!have.has(p.id)) {
          db.execute('INSERT INTO reminder_recipients (id, reminder_id, user_id, user_name, done, done_at) VALUES (?, ?, ?, ?, 0, NULL)', [newId('RMR'), id, p.id, p.name]);
        }
      }
    });
    return view(db.getOne('SELECT * FROM reminders WHERE id = ?', [id]), recipientsOf(id), user);
  },

  /** A recipient marks the reminder done (or pending again) for themselves */
  setDone(user, id, done = true) {
    loadOwned(id, user);
    const own = recipientsOf(id).find((x) => x.user_id === user.id);
    if (!own) throw fail(403, 'Este recordatorio no es para ti: solo sus destinatarios lo marcan como hecho.');
    db.execute('UPDATE reminder_recipients SET done = ?, done_at = ? WHERE id = ?', [done ? 1 : 0, done ? now() : null, own.id]);
    return view(db.getOne('SELECT * FROM reminders WHERE id = ?', [id]), recipientsOf(id), user);
  },

  /** A login is deleted: its own reminders go, and it stops being a recipient of the others */
  forgetUser(userId) {
    for (const r of db.query('SELECT id FROM reminders WHERE author_user_id = ?', [userId])) {
      for (const x of recipientsOf(r.id)) db.execute('DELETE FROM reminder_recipients WHERE id = ?', [x.id]);
      db.execute('DELETE FROM reminders WHERE id = ?', [r.id]);
    }
    for (const x of db.query('SELECT id FROM reminder_recipients WHERE user_id = ?', [userId])) db.execute('DELETE FROM reminder_recipients WHERE id = ?', [x.id]);
  },

  /** Author only */
  remove(user, id) {
    const r = loadOwned(id, user);
    if (r.author_user_id !== user.id) throw fail(403, 'Solo quien escribió el recordatorio puede borrarlo.');
    db.transaction(() => {
      for (const x of recipientsOf(id)) db.execute('DELETE FROM reminder_recipients WHERE id = ?', [x.id]);
      db.execute('DELETE FROM reminders WHERE id = ?', [id]);
    });
    return { ok: true };
  },
};

module.exports = service;
