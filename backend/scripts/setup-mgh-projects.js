#!/usr/bin/env node
/**
 * Makes the project catalog match My Global Hub's real projects (children of the MGH umbrella company):
 *   MSHP → "Wokokai" (social network; keeps the key so the Jira link and its synced issues stay attached)
 *   ARW  → "Arawaki" (e-commerce)
 *   TR3  → "Tr3slog" (shipping app)
 * Idempotent: existing projects are renamed only if needed, missing ones are created. Nothing is deleted.
 *
 *   node scripts/setup-mgh-projects.js           → dry run against the local Firestore cache (no Firestore reads)
 *   node scripts/setup-mgh-projects.js --apply   → writes to Firestore (asks to type CREAR)
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const APPLY = process.argv.includes('--apply');
const CACHE_FILE = path.join(__dirname, '..', 'data', 'firestore_cache.json');
const PROJECTS = [
  { key: 'MSHP', name: 'Wokokai' },
  { key: 'ARW', name: 'Arawaki' },
  { key: 'TR3', name: 'Tr3slog' },
];

function plan(existing) {
  return PROJECTS.map((p) => {
    const cur = existing.find((x) => String(x.key).toUpperCase() === p.key);
    if (!cur) return { ...p, action: 'create' };
    if (cur.name !== p.name) return { ...p, action: 'rename', from: cur.name };
    return { ...p, action: 'ok' };
  });
}

function show(steps) {
  steps.forEach((s) => console.log(`  ${s.key.padEnd(5)} ${s.action === 'create' ? 'CREATE  ' + s.name : s.action === 'rename' ? 'RENAME  "' + s.from + '" → "' + s.name + '"' : 'OK      ' + s.name}`));
}

async function main() {
  if (!APPLY) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const rows = Array.isArray(cache.jira_projects) ? cache.jira_projects : Object.values(cache.jira_projects || {});
    console.log('DRY RUN (local Firestore cache). Planned changes:');
    show(plan(rows));
    console.log('\nRun with --apply to write these to Firestore.');
    return;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question('This writes the project catalog to PRODUCTION Firestore. Type CREAR to continue: ', r));
  rl.close();
  if (answer.trim() !== 'CREAR') { console.log('Cancelled.'); return; }

  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  process.env.DATABASE_CLIENT = 'firestore';
  process.env.SKIP_SEED = 'true';
  const db = require('../src/db/connection');
  await db.initDatabase();
  const agileService = require('../src/services/agile.service');
  const steps = plan(db.query('SELECT * FROM jira_projects'));
  show(steps);
  for (const s of steps) {
    if (s.action === 'create') {
      db.execute(
        `INSERT INTO jira_projects (id, key, name, lead, people, budget, spent, hrs, bill, st) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 'On track')`,
        [s.key, s.key, s.name, null]
      );
    } else if (s.action === 'rename') {
      db.execute(`UPDATE jira_projects SET name = ?, updated_at = datetime('now') WHERE key = ?`, [s.name, s.key]);
    }
    agileService.ensureDefaultStatuses(s.key); // To Do / In Progress / Code Review / Done
  }
  await db.flushPendingWrites();
  console.log('\nDone.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
