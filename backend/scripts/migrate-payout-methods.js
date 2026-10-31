#!/usr/bin/env node
/**
 * Turns the payout data stored on employee rows (bank + account, Coinbase wallet) into "Datos de pago" methods
 * (payout_methods), verified, so payroll keeps paying the same people the same way.
 *
 *   node scripts/migrate-payout-methods.js           → dry run from backend/data/firestore_cache.json (writes nothing)
 *   node scripts/migrate-payout-methods.js --apply   → reads LIVE Firestore, shows the real plan, asks MIGRAR
 *
 * Rules
 *  - Only employees without any payout method yet, and not Terminated.
 *  - Sample values from the old seeder (accounts in prod-cleanup's FAKE_ACCTS, the demo wallet) are never migrated.
 *  - A masked account (••••1234) cannot be paid to: it is NOT migrated; the person is listed to register it.
 *  - The old split (e.g. 80% bank / 20% Coinbase) ends: the primary is the bank method, or the wallet when the
 *    person was paid 100% in crypto or has no bank. Both are kept as methods, so the person can switch.
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const APPLY = process.argv.slice(2).includes('--apply');
const CACHE_FILE = path.join(__dirname, '..', 'data', 'firestore_cache.json');
const FAKE_ACCTS = ['9876543210', '1029384756', '2039485761', '3049586712', '4059687123', '5069788234'];
const FAKE_WALLETS = ['0x3aB858B5d06456EaFeEfa24e86895315B91a9F12', '0x3aB8…9F12', '0x71C836eB6F960a5D262F6C7741d7f6bEc5841094'];
const ACTOR = { name: 'Migración de datos de pago', role: 'admin' };
const rowsOf = (t) => (Array.isArray(t) ? t : Object.values(t || {}));

function plan(employees, existing) {
  const has = new Set(existing.map((m) => m.employee_id));
  const steps = [];
  for (const e of employees) {
    if (has.has(e.id) || e.status === 'Terminated') continue;
    const acct = String(e.acct || '').trim();
    const wallet = String(e.crypto_wallet || '').trim();
    const nid = String(e.nid || '').replace(/\D/g, '');
    const out = { id: e.id, name: e.name, create: [], notes: [] };
    if (e.bank && acct) {
      if (FAKE_ACCTS.includes(acct.replace(/\D/g, ''))) out.notes.push('cuenta de ejemplo: no se migra');
      else if (acct.includes('•')) out.notes.push(`cuenta enmascarada (${acct}): debe registrarla de nuevo`);
      else out.create.push({ type: 'bank', details: { bank_name: e.bank, account_type: 'Ahorro', account_number: acct, holder: e.name, holder_id: nid.length === 11 ? nid : '', routing: /^\d{9}$/.test(String(e.routing || '')) ? String(e.routing) : '' } });
    }
    if (wallet) {
      if (FAKE_WALLETS.includes(wallet)) out.notes.push('billetera de ejemplo: no se migra');
      else out.create.push({ type: 'coinbase', details: { currency: e.crypto_asset || 'USDC', network: e.crypto_network || 'Base', address: wallet } });
    }
    if (out.create.length) {
      const cryptoFirst = Number(e.crypto_alloc) >= 100 || !out.create.some((m) => m.type === 'bank');
      out.create.forEach((m) => { m.primary = cryptoFirst ? m.type === 'coinbase' : m.type === 'bank'; });
      if (out.create.length > 1 || (Number(e.crypto_alloc) > 0 && Number(e.crypto_alloc) < 100)) {
        out.notes.push(`antes: reparto ${100 - Number(e.crypto_alloc || 0)}% banco / ${Number(e.crypto_alloc || 0)}% cripto → ahora 100% al principal (${cryptoFirst ? 'Coinbase' : 'banco'})`);
      }
    } else if (!out.notes.length) {
      out.notes.push('sin datos de pago: debe registrarlos en su perfil');
    }
    steps.push(out);
  }
  return steps;
}

function show(steps) {
  if (!steps.length) { console.log('  (nada que migrar)'); return; }
  for (const s of steps) {
    console.log(`  ${s.id}  ${s.name}`);
    for (const m of s.create) console.log(`     CREAR  ${m.type}${m.primary ? ' (principal)' : ''}  ${m.type === 'bank' ? m.details.bank_name + ' ••••' + m.details.account_number.slice(-4) : m.details.currency + ' ' + m.details.network + ' ' + m.details.address.slice(0, 6) + '…' + m.details.address.slice(-4)}`);
    for (const n of s.notes) console.log(`     nota   ${n}`);
  }
}

async function main() {
  if (!APPLY) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log('DRY RUN (copia local; lo creado desde la última sincronización no aparece). Nada se escribe.\n');
    show(plan(rowsOf(cache.employees), rowsOf(cache.payout_methods)));
    console.log('\nPara aplicar: --apply (lee Firestore en vivo, muestra el plan real y pide escribir MIGRAR).');
    return;
  }
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  process.env.DATABASE_CLIENT = 'firestore';
  process.env.SKIP_SEED = 'true';
  process.env.SKIP_REMOTE_INIT = 'false';
  const db = require('../src/db/connection');
  await db.initDatabase();
  if (!db.getAdapter().hydratedFromRemote) {
    console.error('No se pudieron leer los datos en vivo de Firestore. No se cambió nada.');
    process.exit(1);
  }
  const payoutMethods = require('../src/services/payout-methods.service');
  const steps = plan(db.query('SELECT * FROM employees'), db.query('SELECT employee_id FROM payout_methods'));
  console.log('Datos EN VIVO de Firestore. Plan:\n');
  show(steps);
  if (!steps.some((s) => s.create.length)) { console.log('\nNada que crear.'); process.exit(0); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question('\n¿Crear estos métodos de pago en PRODUCCIÓN? Escribe MIGRAR para continuar: ', r));
  rl.close();
  if (answer.trim() !== 'MIGRAR') { console.log('Cancelado. No se cambió nada.'); process.exit(0); }
  let ok = 0;
  for (const s of steps) {
    for (const m of s.create) {
      try { payoutMethods.create(s.id, m, ACTOR); ok += 1; } catch (e) { console.error(`  ${s.id} ${m.type}: ${e.message}`); }
    }
  }
  console.log(`\n${ok} métodos creados. Esperando a que terminen las escrituras…`);
  const adapter = db.getAdapter();
  for (let i = 0; i < 60 && adapter.activeWrites && adapter.activeWrites.size; i++) await new Promise((r) => setTimeout(r, 500));
  console.log('Listo. Reinicia el servidor de producción para que cargue los métodos.');
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
