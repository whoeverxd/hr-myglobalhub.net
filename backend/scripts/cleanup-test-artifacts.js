#!/usr/bin/env node
/**
 * Removes records that backend tests wrote into PRODUCTION Firestore before tests were pinned to SQLite.
 * Only records matching exact fingerprints of the test fixtures are touched (see SELECTORS). Real data is kept.
 *
 *   node scripts/cleanup-test-artifacts.js            → dry run: lists what would be deleted (reads the local
 *                                                         Firestore cache file, no Firestore reads)
 *   node scripts/cleanup-test-artifacts.js --apply    → deletes them from Firestore (asks to type BORRAR)
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const APPLY = process.argv.includes('--apply');
const CACHE_FILE = path.join(__dirname, '..', 'data', 'firestore_cache.json');

// Fingerprints of data created by backend/test/*.test.js fixtures
const TEST_ACTIVITY_DESC = [
  /^Construcción del componente DailyActivit/, /^Avance en migración de esquema y modelos/, /^Particionado horizontal de tablas/,
  /^Tests unitarios de streams/, /^Planificación de sprint/, /^Audit test$/, /^Test$/, /^Implementación del flujo de equivalencia/,
  /^Esquema ACID/, /^Endpoint y servicio de conciliación/, /^Work$/,
];
const TEST_FILES = ['entregable_sprint.png', 'arquitectura_sqlite.png', 'test-evidence.txt', 'proof1.jpg', 'screenshot.png', 'empty.bin'];
const TEST_EMAILS = ['valeria.soto@globalhub.com', 'devops.contractor@myglobalhub.net'];
const FAKE_TX = '0x1234567890abcdef1234567890abcdef';

function selectors(all) {
  const testEmpIds = new Set(all('employees').filter((e) => TEST_EMAILS.includes(String(e.email).toLowerCase())).map((e) => e.id));
  const ids = (rows) => rows.map((r) => r.id);
  const out = {
    leave_requests: ids(all('leave_requests').filter((l) => l.employee_id === 'MGH-1044' && l.from_date === '2025-06-01' && l.to_date === '2025-06-05')),
    employees: [...testEmpIds],
    users: ids(all('users').filter((u) => TEST_EMAILS.includes(String(u.email).toLowerCase()))),
    contractors: ids(all('contractors').filter((c) => TEST_EMAILS.includes(String(c.email).toLowerCase()))),
    timesheets: ids(all('timesheets').filter((t) => testEmpIds.has(t.employee_id) || t.id === 'TS-PP-2025-10-MGH-1042')),
    daily_activities: ids(all('daily_activities').filter((a) => testEmpIds.has(a.employee_id) || /^ACT-TEST/.test(a.jira_key || '') || a.jira_key === 'TEST-1' || TEST_ACTIVITY_DESC.some((rx) => rx.test(a.description || '')))),
    file_attachments: ids(all('file_attachments').filter((f) => TEST_FILES.includes(f.original_name || f.originalName))),
    payment_proofs: ids(all('payment_proofs').filter((p) => String(p.ref || '').includes(FAKE_TX))),
    payroll_runs: ids(all('payroll_runs').filter((r) => r.id === 'PR-PP-2025-08')),
    test_sandbox: ids(all('test_sandbox')),
  };
  const keptRuns = new Set(all('payroll_runs').map((r) => r.id).filter((id) => !out.payroll_runs.includes(id)));
  out.payroll_run_items = ids(all('payroll_run_items').filter((i) => !keptRuns.has(i.run_id)));
  return out;
}

function report(sel, all) {
  let total = 0;
  for (const [col, list] of Object.entries(sel)) {
    if (!list.length) continue;
    total += list.length;
    console.log(`\n${col}: ${list.length}`);
    const rows = all(col).filter((r) => list.includes(r.id)).slice(0, 4);
    rows.forEach((r) => console.log('   - ' + [r.id, r.name || r.employee_name || r.email || r.original_name || r.description || r.ref || '', r.from_date || r.date || r.created_at || ''].filter(Boolean).join(' • ').slice(0, 140)));
    if (list.length > rows.length) console.log(`   … and ${list.length - rows.length} more`);
  }
  console.log(`\nTotal: ${total} records`);
  return total;
}

async function main() {
  if (!APPLY) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const all = (c) => (Array.isArray(cache[c]) ? cache[c] : Object.values(cache[c] || {}));
    console.log('DRY RUN (local Firestore cache, nothing is changed). Would delete:');
    report(selectors(all), all);
    console.log('\nRun with --apply to delete these from Firestore.');
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question('This deletes the listed test records from PRODUCTION Firestore. Type BORRAR to continue: ', r));
  rl.close();
  if (answer.trim() !== 'BORRAR') { console.log('Cancelled.'); return; }

  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  process.env.DATABASE_CLIENT = 'firestore';
  process.env.SKIP_SEED = 'true';
  const db = require('../src/db/connection');
  await db.initDatabase();
  const all = (c) => db.query(`SELECT * FROM ${c}`);
  const sel = selectors(all);
  const total = report(sel, all);
  let deleted = 0;
  for (const [col, list] of Object.entries(sel)) {
    for (const id of list) deleted += db.execute(`DELETE FROM ${col} WHERE id = ?`, [id]).changes || 0;
  }
  await db.flushPendingWrites();
  console.log(`\nDeleted ${deleted} of ${total} records.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
