#!/usr/bin/env node
/**
 * Sets the system role of existing logins by email — for bootstrapping administrators when nobody in the app can do it
 * yet (in the app, an admin changes roles from the employee profile → "Acceso al sistema").
 * Roles: employee, contractor, supervisor, pm, hr, finance, admin ('admin' = Platform Admin, the top level).
 *
 *   node scripts/set-user-role.js --role admin a@x.com b@y.com           → dry run against the local Firestore cache
 *   node scripts/set-user-role.js --role admin a@x.com b@y.com --apply   → reads live Firestore, shows the plan, asks CAMBIAR
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const roleIdx = args.indexOf('--role');
const ROLE = roleIdx >= 0 ? String(args[roleIdx + 1] || '').toLowerCase() : '';
const EMAILS = args.filter((a, i) => a.includes('@') && i !== roleIdx + 1).map((e) => e.trim().toLowerCase());
const ROLES = ['employee', 'contractor', 'supervisor', 'pm', 'hr', 'finance', 'admin'];
const CACHE_FILE = path.join(__dirname, '..', 'data', 'firestore_cache.json');

function plan(users) {
  return EMAILS.map((email) => {
    const u = users.find((x) => String(x.email || '').toLowerCase() === email);
    if (!u) return { email, action: 'missing' };
    if (u.role === ROLE) return { email, action: 'ok', from: u.role, id: u.id };
    return { email, action: 'change', from: u.role, id: u.id, active: Number(u.is_active) !== 0 };
  });
}

function show(steps) {
  steps.forEach((s) => console.log('  ' + s.email.padEnd(40) + (
    s.action === 'missing' ? 'NOT FOUND (the person must have a login: create the employee or sign in with Google first)'
      : s.action === 'ok' ? 'already ' + ROLE
        : s.from + ' → ' + ROLE + (s.active === false ? '  (account is disabled)' : ''))));
}

async function main() {
  if (!ROLES.includes(ROLE) || !EMAILS.length) {
    console.log('Usage: node scripts/set-user-role.js --role <' + ROLES.join('|') + '> <email> [email…] [--apply]');
    process.exit(1);
  }
  if (!APPLY) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const rows = Array.isArray(cache.users) ? cache.users : Object.values(cache.users || {});
    console.log('DRY RUN (local Firestore cache: accounts created since the last sync are missing). Planned changes:');
    show(plan(rows));
    console.log('\nRun again with --apply: it reads the live data, shows the real plan and asks before writing.');
    return;
  }
  // Load LIVE data first and show the real plan; only then ask for confirmation
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  process.env.DATABASE_CLIENT = 'firestore';
  process.env.SKIP_SEED = 'true';
  const db = require('../src/db/connection');
  await db.initDatabase();
  const adapter = db.getAdapter();
  if (!adapter.hydratedFromRemote) {
    console.error('Could not read live data from Firestore' + (adapter.hydrationError ? ' (' + adapter.hydrationError + ')' : '') + '. Nothing was changed — check the connection / credentials in backend/.env and try again.');
    process.exit(1);
  }
  const { logAction } = require('../src/controllers/audit.controller');
  const steps = plan(db.query('SELECT id, email, role, is_active FROM users'));
  console.log('LIVE data from Firestore. Planned changes:');
  show(steps);
  if (!steps.some((x) => x.action === 'change')) { console.log('\nNothing to change.'); return; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question('\nApply these changes to PRODUCTION Firestore? Type CAMBIAR to continue: ', r));
  rl.close();
  if (answer.trim() !== 'CAMBIAR') { console.log('Cancelled. Nothing was changed.'); return; }
  for (const s of steps.filter((x) => x.action === 'change')) {
    db.execute(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`, [ROLE, s.id]);
    logAction({ actor: 'set-user-role script', action: 'ROLE_CHANGED', entityType: 'user', entityId: s.id, oldValues: { role: s.from }, newValues: { role: ROLE, email: s.email }, ip: 'cli' });
  }
  await db.flushPendingWrites();
  console.log('\nDone. The new role applies on the user\'s next request (sign out and in again to refresh the menu).');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
