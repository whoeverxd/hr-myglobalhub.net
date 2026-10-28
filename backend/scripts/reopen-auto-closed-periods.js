#!/usr/bin/env node
/**
 * Pay periods used to be created already 'Closed' (sealed and locked) just because their dates had passed, although
 * nobody closed them and no payroll was paid. This puts those rows back to their real state: Open if the period has
 * started, Draft otherwise, unlocked.
 * Only the current year. A period is left untouched when it has a payroll run, or when the audit log shows someone changed its status.
 *
 *   node scripts/reopen-auto-closed-periods.js           → dry run against the local Firestore cache
 *   node scripts/reopen-auto-closed-periods.js --apply   → writes to Firestore (asks to type REABRIR)
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const APPLY = process.argv.includes('--apply');
const CACHE_FILE = path.join(__dirname, '..', 'data', 'firestore_cache.json');
const today = new Date().toISOString().slice(0, 10);
const YEAR = today.slice(0, 4); // earlier years (old seed data) are left as they are
const rowsOf = (x) => (Array.isArray(x) ? x : Object.values(x || {}));

function plan(periods, runs, audits) {
  const withRun = new Set(runs.map((r) => r.period_id));
  const touched = new Set(audits.filter((a) => a.action === 'UPDATE_PERIOD_STATUS').map((a) => a.entity_id));
  return periods
    .filter((p) => String(p.id).startsWith('PP-' + YEAR + '-') && ['Closed', 'Archived'].includes(p.status))
    .map((p) => {
      const to = String(p.start_date) <= today ? 'Open' : 'Draft';
      if (withRun.has(p.id)) return { id: p.id, action: 'keep', why: 'has a payroll run' };
      if (touched.has(p.id)) return { id: p.id, action: 'keep', why: 'status changed by a person (audit log)' };
      return { id: p.id, action: 'reopen', from: p.status, to };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function show(steps) {
  if (!steps.length) { console.log('  Nothing to fix: no Closed/Archived periods this year.'); return; }
  steps.forEach((s) => console.log('  ' + s.id.padEnd(12) + (s.action === 'reopen' ? s.from + ' → ' + s.to + ' (unlocked)' : 'KEEP  ' + s.why)));
}

async function main() {
  if (!APPLY) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log('DRY RUN (local Firestore cache, may be out of date). Planned changes:');
    show(plan(rowsOf(cache.pay_periods), rowsOf(cache.payroll_runs), rowsOf(cache.audit_logs)));
    console.log('\nRun with --apply to write them to Firestore.');
    return;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question('This changes pay periods in PRODUCTION Firestore. Type REABRIR to continue: ', r));
  rl.close();
  if (answer.trim() !== 'REABRIR') { console.log('Cancelled.'); return; }

  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  process.env.DATABASE_CLIENT = 'firestore';
  process.env.SKIP_SEED = 'true';
  const db = require('../src/db/connection');
  await db.initDatabase();
  const { logAction } = require('../src/controllers/audit.controller');
  const steps = plan(
    db.query('SELECT id, status, start_date FROM pay_periods'),
    db.query('SELECT period_id FROM payroll_runs'),
    db.query(`SELECT action, entity_id FROM audit_logs WHERE entity_type = 'pay_period'`)
  );
  show(steps);
  for (const s of steps.filter((x) => x.action === 'reopen')) {
    db.execute(`UPDATE pay_periods SET status = ?, is_locked = 0, updated_at = datetime('now') WHERE id = ?`, [s.to, s.id]);
    logAction({ actor: 'reopen-auto-closed-periods script', action: 'REOPEN_AUTO_CLOSED_PERIOD', entityType: 'pay_period', entityId: s.id, oldValues: { status: s.from }, newValues: { status: s.to }, ip: 'cli' });
  }
  await db.flushPendingWrites();
  console.log('\nDone.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
