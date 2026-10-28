#!/usr/bin/env node
/**
 * Clears the sample values that the old contractor sync / createContractor / seeder wrote into real records
 * (fake wallet, sample bank account, phone, start date…). Missing payout or contact data must stay empty,
 * never be filled with made-up values: HR fills in the real data afterwards.
 *
 *   node scripts/clear-placeholder-contractor-data.js           → dry run against the local Firestore cache
 *   node scripts/clear-placeholder-contractor-data.js --apply   → reads live Firestore, shows the plan, asks LIMPIAR
 *
 * Rules
 *  - Always a placeholder (strong): the sample wallet (short or full), account 2039485761, phones +1 809 555 0192 /
 *    +1 555-0100, start date "Feb 10, 2024".
 *  - Contractors: bank "Banco BHD León", city "Santiago" and rate 50 are real-looking values, so they are cleared only
 *    when the same row also has a strong placeholder. Clearing the sample wallet also clears the payout method.
 *  - Employees: bank "Banco BHD León" is cleared only together with the sample account. Clearing the sample wallet
 *    moves its crypto share back to the bank (crypto_alloc 0, alloc 100) so the payout split still totals 100%.
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const APPLY = process.argv.slice(2).includes('--apply');
const CACHE_FILE = path.join(__dirname, '..', 'data', 'firestore_cache.json');

const WALLETS = ['0x3aB858B5d06456EaFeEfa24e86895315B91a9F12', '0x3aB8…9F12'];
const ACCT = '2039485761';
const PHONES = ['+1 809 555 0192', '+1 555-0100'];
const START = 'Feb 10, 2024';
const BANK = 'Banco BHD León';

const rowsOf = (t) => (Array.isArray(t) ? t : Object.values(t || {}));

// Returns [{ field, from, to }] for one contractor row
function contractorChanges(c) {
  const ch = [];
  const add = (field, to) => ch.push({ field, from: c[field], to });
  const walletHit = WALLETS.includes(c.wallet) || WALLETS.includes(c.wallet_full);
  if (WALLETS.includes(c.wallet)) add('wallet', '');
  if (WALLETS.includes(c.wallet_full)) add('wallet_full', '');
  if (walletHit && c.method) add('method', '');
  if (c.acct === ACCT) add('acct', '');
  if (PHONES.includes(c.phone)) add('phone', '');
  if (c.start_date === START) add('start_date', '');
  if (ch.length) {
    // Weak values: only together with a strong placeholder on the same row
    if (c.bank === BANK) add('bank', '');
    if (c.city === 'Santiago') add('city', '');
    if (Number(c.rate) === 50) add('rate', 0);
  }
  return ch;
}

function employeeChanges(e) {
  const ch = [];
  const add = (field, to) => ch.push({ field, from: e[field], to });
  if (WALLETS.includes(e.crypto_wallet)) {
    add('crypto_wallet', '');
    if (Number(e.crypto_alloc) > 0) {
      add('crypto_alloc', 0);
      add('alloc', 100);
    }
  }
  if (e.acct === ACCT) {
    add('acct', '');
    if (e.bank === BANK) add('bank', '');
  }
  if (PHONES.includes(e.phone)) add('phone', '');
  if (e.start_date === START) add('start_date', '');
  return ch;
}

function plan(contractors, employees) {
  const steps = [];
  for (const c of contractors) {
    const changes = contractorChanges(c);
    if (changes.length) steps.push({ table: 'contractors', id: c.id, name: c.name, changes });
  }
  for (const e of employees) {
    const changes = employeeChanges(e);
    if (changes.length) steps.push({ table: 'employees', id: e.id, name: e.name, changes });
  }
  return steps;
}

function show(steps) {
  if (!steps.length) { console.log('  (no sample values found)'); return; }
  for (const s of steps) {
    console.log('  ' + s.table.padEnd(12) + String(s.id).padEnd(10) + (s.name || ''));
    for (const c of s.changes) console.log('      ' + c.field.padEnd(14) + JSON.stringify(c.from) + ' → ' + JSON.stringify(c.to));
  }
}

async function main() {
  if (!APPLY) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log('DRY RUN (local Firestore cache: changes since the last sync are missing). Planned changes:');
    show(plan(rowsOf(cache.contractors), rowsOf(cache.employees)));
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
  const steps = plan(db.query('SELECT * FROM contractors'), db.query('SELECT * FROM employees'));
  console.log('LIVE data from Firestore. Planned changes:');
  show(steps);
  if (!steps.length) { console.log('\nNothing to change.'); return; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question('\nApply these changes to PRODUCTION Firestore? Type LIMPIAR to continue: ', r));
  rl.close();
  if (answer.trim() !== 'LIMPIAR') { console.log('Cancelled. Nothing was changed.'); return; }
  for (const s of steps) {
    // Field names come from the fixed rules above, never from data
    const sets = s.changes.map((c) => c.field + ' = ?').join(', ');
    db.execute(`UPDATE ${s.table} SET ${sets}, updated_at = datetime('now') WHERE id = ?`, [...s.changes.map((c) => c.to), s.id]);
    logAction({
      actor: 'clear-placeholder-contractor-data script',
      action: 'CONTRACTOR_PLACEHOLDERS_CLEARED',
      entityType: s.table === 'contractors' ? 'contractor' : 'employee',
      entityId: s.id,
      oldValues: Object.fromEntries(s.changes.map((c) => [c.field, c.from])),
      newValues: Object.fromEntries(s.changes.map((c) => [c.field, c.to])),
      ip: 'cli',
    });
  }
  await db.flushPendingWrites();
  console.log('\nDone. Ask HR to fill in the real payout and contact data of these people.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
