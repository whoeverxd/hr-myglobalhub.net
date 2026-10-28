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
const INCLUDE_DEMO = process.argv.includes('--include-demo');
// test fixtures always; demo seed records only with --include-demo
const merge = (a, b) => { const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = [...new Set([...(out[k] || []), ...v])]; return out; };
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
const TEST_TASK_TITLES = ['Diseñar arquitectura de base de datos ágil', 'Implementar endpoints REST de sprints y backlog', 'Implementación del backend relacional SQLite y sesiones'];

function selectors(all) {
  const testEmpIds = new Set(all('employees').filter((e) => TEST_EMAILS.includes(String(e.email).toLowerCase())).map((e) => e.id));
  const testProjectIds = new Set(all('jira_projects').filter((p) => p.key === 'TESTPRJ' || /^Test Innovation Project/.test(p.name || '')).map((p) => p.id));
  const ids = (rows) => rows.map((r) => r.id);
  const out = {
    leave_requests: ids(all('leave_requests').filter((l) => l.employee_id === 'MGH-1044' && l.from_date === '2025-06-01' && l.to_date === '2025-06-05')),
    employees: [...testEmpIds, ...ids(all('employees').filter((e) => e.id === 'FAIL-01'))], // FAIL-01: db_adapter.test.js rollback fixture
    users: ids(all('users').filter((u) => TEST_EMAILS.includes(String(u.email).toLowerCase()))),
    contractors: ids(all('contractors').filter((c) => TEST_EMAILS.includes(String(c.email).toLowerCase()))),
    timesheets: ids(all('timesheets').filter((t) => testEmpIds.has(t.employee_id) || t.id === 'TS-PP-2025-10-MGH-1042')),
    daily_activities: ids(all('daily_activities').filter((a) => testEmpIds.has(a.employee_id) || /^ACT-TEST/.test(a.jira_key || '') || a.jira_key === 'TEST-1' || TEST_ACTIVITY_DESC.some((rx) => rx.test(a.description || '')))),
    file_attachments: ids(all('file_attachments').filter((f) => TEST_FILES.includes(f.original_name || f.originalName))),
    payment_proofs: ids(all('payment_proofs').filter((p) => String(p.ref || '').includes(FAKE_TX))),
    payroll_runs: ids(all('payroll_runs').filter((r) => r.id === 'PR-PP-2025-08')),
    test_sandbox: ids(all('test_sandbox')),
    // agile_tasks.test.js / jira.test.js fixtures
    jira_projects: ids(all('jira_projects').filter((p) => p.key === 'TESTPRJ' || /^Test Innovation Project/.test(p.name || ''))),
    project_tasks: ids(all('project_tasks').filter((t) => TEST_TASK_TITLES.includes(t.title))),
    sprints: ids(all('sprints').filter((s) => s.name === 'Sprint 1 - Core Agile Engine')),
    project_statuses: ids(all('project_statuses').filter((s) => s.name === 'QA Testing' || testProjectIds.has(s.project_id))),
    // demo tickets the backend used to seed (ATLAS-*, MSH-*); real synced Jira issues (e.g. MSHP-*) are kept
    jira_issues_cache: ids(all('jira_issues_cache').filter((i) => /^(ATLAS|MSH)-\d+$/.test(i.key || i.id || ''))),
  };
  const keptRuns = new Set(all('payroll_runs').map((r) => r.id).filter((id) => !out.payroll_runs.includes(id)));
  out.payroll_run_items = ids(all('payroll_run_items').filter((i) => !keptRuns.has(i.run_id)));
  return out;
}

// Demo records from the old seeder / frozen prototype date (2025-04) and the fake USA/UK entities.
// Deleted only with --include-demo. Seeded worklogs (wl-1..3) reference real MSHP tickets and are kept.
const FAKE_ORGS = ['MGH USA Inc.', 'MGH UK Ltd.'];
function demoSelectors(all) {
  const ids = (rows) => rows.map((r) => r.id);
  return {
    contractor_payments: ids(all('contractor_payments').filter((p) => p.id === 'CPAY-2025-08-1043' && p.cb_id === 'CB-4A92E1B0')),
    payroll_adjustments: ids(all('payroll_adjustments').filter((a) => ['Q1 Performance Bonus', 'Remote Office Stipend', 'Equipment Reimbursement'].includes(a.type))),
    timesheets: ids(all('timesheets').filter((t) => /^TS-2025-0[89]-MGH-\d+$/.test(t.id))),
    leave_requests: ids(all('leave_requests').filter((l) => ['LV-1001', 'LV-1002', 'LV-1003'].includes(l.id))),
    attendance_punches: ids(all('attendance_punches').filter((p) => ['PUNCH-1042-20250415', 'PUNCH-MGH-1042-20250420'].includes(p.id))),
    attendance_exceptions: ids(all('attendance_exceptions').filter((x) => x.id === 'EX-1' && x.date === '2025-04-14')),
    payroll_signoffs: ids(all('payroll_signoffs').filter((s) => /^SO-PP-2025-08-/.test(s.id))),
    organizations: ids(all('organizations').filter((o) => FAKE_ORGS.includes(o.id))),
    holidays: ids(all('holidays').filter((h) => FAKE_ORGS.includes(h.org_id))),
    rollout_stages: ids(all('rollout_stages').filter((r) => FAKE_ORGS.includes(r.entity || r.org_id))),
  };
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
    console.log('DRY RUN (local Firestore cache, nothing is changed).');
    console.log('\n=== Test fixtures (deleted with --apply):');
    report(selectors(all), all);
    console.log('\n=== Demo seed records (deleted only with --apply --include-demo):');
    report(demoSelectors(all), all);
    console.log('\nRun with --apply [--include-demo] to delete from Firestore.');
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
  const sel = INCLUDE_DEMO ? merge(selectors(all), demoSelectors(all)) : selectors(all);
  const total = report(sel, all);
  let deleted = 0;
  for (const [col, list] of Object.entries(sel)) {
    for (const id of list) deleted += db.execute(`DELETE FROM ${col} WHERE id = ?`, [id]).changes || 0;
  }
  await db.flushPendingWrites();
  console.log(`\nDeleted ${deleted} of ${total} records.`);
}

// Reused by prod-cleanup.js (which folds these fingerprints into its plan): only run when executed directly
if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { selectors, demoSelectors };
