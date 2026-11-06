#!/usr/bin/env node
/**
 * Puts every project on the QA workflow:
 *   Por hacer → En progreso → Listo para QA → Bug encontrado → Completado
 * The old English defaults are renamed in place (same status ids, so no task moves):
 *   To Do → Por hacer, In Progress → En progreso, Code Review → Listo para QA (qa_step 'ready'), Done → Completado.
 * "Bug encontrado" (qa_step 'bug') is added after "Listo para QA"; a project without "Code Review" gets a new
 * "Listo para QA". Custom statuses a PM added are kept as they are. New projects already start with this list
 * (DEFAULT_STATUS_TEMPLATES in agile.service.js).
 *
 *   node scripts/setup-qa-workflow.js            → dry run against the local Firestore cache
 *   node scripts/setup-qa-workflow.js --apply    → reads live Firestore, shows the real plan, asks QA
 *   node scripts/setup-qa-workflow.js --local    → applies to the local SQLite database (development)
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const APPLY = process.argv.includes('--apply');
const LOCAL = process.argv.includes('--local');
const CACHE_FILE = path.join(__dirname, '..', 'data', 'firestore_cache.json');

const RENAME = { 'to do': 'Por hacer', 'in progress': 'En progreso', 'code review': 'Listo para QA', done: 'Completado' };
const READY_COLOR = '#8b5cf6';
const BUG_COLOR = '#dc2626';

/**
 * Steps for one project's statuses (sorted by position). Pure: returns
 * [{ op: 'update', id, name?, qa_step?, color?, position } | { op: 'insert', id, name, category, color, qa_step, position }]
 */
function planProject(project, statuses, newId = (n) => `stat_qa_${n}_${Date.now().toString(36)}`) {
  const list = [...statuses].sort((a, b) => Number(a.position) - Number(b.position)).map((s) => ({ ...s }));
  const changes = new Map(); // id → fields
  const set = (s, fields) => { Object.assign(s, fields); changes.set(s.id, { ...(changes.get(s.id) || {}), ...fields }); };

  for (const s of list) {
    const to = RENAME[String(s.name || '').trim().toLowerCase()];
    if (to && to !== s.name) set(s, { name: to });
  }
  let ready = list.find((s) => s.qa_step === 'ready') || list.find((s) => s.name === 'Listo para QA');
  if (ready && ready.qa_step !== 'ready') set(ready, { qa_step: 'ready', color: READY_COLOR });
  const inserts = [];
  const firstDone = list.findIndex((s) => Number(s.is_done) === 1);
  const at = (i) => (i < 0 ? list.length : i);
  if (!ready) {
    ready = { id: newId(`${project.key}_ready`), name: 'Listo para QA', category: 'in_progress', color: READY_COLOR, qa_step: 'ready', is_done: 0, is_default: 0, _new: true };
    list.splice(at(firstDone), 0, ready);
    inserts.push(ready);
  }
  let bug = list.find((s) => s.qa_step === 'bug') || list.find((s) => s.name === 'Bug encontrado');
  if (bug && bug.qa_step !== 'bug') set(bug, { qa_step: 'bug' });
  if (!bug) {
    bug = { id: newId(`${project.key}_bug`), name: 'Bug encontrado', category: 'in_progress', color: BUG_COLOR, qa_step: 'bug', is_done: 0, is_default: 0, _new: true };
    list.splice(list.indexOf(ready) + 1, 0, bug);
    inserts.push(bug);
  }
  // Positions follow the list order
  list.forEach((s, i) => { if (!s._new && Number(s.position) !== i) set(s, { position: i }); s.position = i; });

  return [
    ...[...changes.entries()].map(([id, fields]) => ({ op: 'update', id, ...fields })),
    ...inserts.map((s) => ({ op: 'insert', id: s.id, name: s.name, category: s.category, color: s.color, qa_step: s.qa_step, position: s.position })),
  ];
}

function show(projects, statusesOf) {
  const plans = projects.map((p) => ({ p, steps: planProject(p, statusesOf(p.id)) }));
  for (const { p, steps } of plans) {
    const before = statusesOf(p.id).sort((a, b) => a.position - b.position).map((s) => s.name).join(' → ');
    console.log(`\n${p.key} ${p.name || ''}\n  ahora:   ${before || '(sin estados: se crearán los nuevos por defecto)'}`);
    if (!steps.length) { console.log('  ya tiene el flujo de QA'); continue; }
    for (const s of steps) {
      if (s.op === 'insert') console.log(`  + crear "${s.name}" (posición ${s.position + 1})`);
      else {
        const cur = statusesOf(p.id).find((x) => x.id === s.id) || {};
        const what = [s.name ? `"${cur.name}" → "${s.name}"` : `"${cur.name}"`, s.qa_step ? `paso QA: ${s.qa_step}` : null, typeof s.position === 'number' ? `posición ${s.position + 1}` : null].filter(Boolean);
        console.log('  ~ ' + what.join(' • '));
      }
    }
  }
  return plans;
}

function applyPlans(db, plans) {
  for (const { p, steps } of plans) {
    for (const s of steps) {
      if (s.op === 'insert') {
        db.execute(`INSERT INTO project_statuses (id, project_id, name, category, color, position, is_default, is_done, qa_step) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`,
          [s.id, p.id, s.name, s.category, s.color, s.position, s.qa_step]);
      } else {
        const cols = ['name', 'qa_step', 'color', 'position'].filter((k) => typeof s[k] !== 'undefined');
        db.execute(`UPDATE project_statuses SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...cols.map((k) => s[k]), s.id]);
      }
    }
  }
}

async function main() {
  if (!APPLY && !LOCAL) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const rows = (k) => (Array.isArray(cache[k]) ? cache[k] : Object.values(cache[k] || {}));
    const statuses = rows('project_statuses');
    console.log('DRY RUN (copia local de Firestore). Cambios previstos:');
    show(rows('jira_projects'), (pid) => statuses.filter((s) => s.project_id === pid));
    console.log('\nVuelve a ejecutarlo con --apply: lee los datos en vivo, muestra el plan real y pide confirmación.');
    return;
  }
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  process.env.SKIP_SEED = 'true';
  // backend/.env may set SKIP_REMOTE_INIT=true (boot from the local snapshot): --apply must read the LIVE data
  if (APPLY) process.env.SKIP_REMOTE_INIT = 'false';
  if (APPLY) process.env.DATABASE_CLIENT = 'firestore';
  else process.env.DATABASE_CLIENT = 'sqlite';
  const db = require('../src/db/connection');
  await db.initDatabase();
  if (APPLY) {
    const adapter = db.getAdapter();
    if (!adapter.hydratedFromRemote) {
      console.error('No se pudieron leer los datos en vivo de Firestore' + (adapter.hydrationError ? ' (' + adapter.hydrationError + ')' : '') + '. No se cambió nada.');
      process.exit(1);
    }
  }
  const projects = db.query('SELECT id, key, name FROM jira_projects');
  const statuses = db.query('SELECT * FROM project_statuses');
  console.log(APPLY ? 'Datos EN VIVO de Firestore. Cambios previstos:' : 'Base local SQLite. Cambios previstos:');
  const plans = show(projects, (pid) => statuses.filter((s) => s.project_id === pid));
  if (!plans.some((x) => x.steps.length)) { console.log('\nNada que cambiar.'); return; }
  if (APPLY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((r) => rl.question('\n¿Aplicar estos cambios en Firestore de PRODUCCIÓN? Escribe QA para continuar: ', r));
    rl.close();
    if (answer.trim() !== 'QA') { console.log('Cancelado. No se cambió nada.'); return; }
  }
  applyPlans(db, plans);
  const { logAction } = require('../src/controllers/audit.controller');
  logAction({ actor: 'setup-qa-workflow script', action: 'QA_WORKFLOW_SETUP', entityType: 'project_status', entityId: 'all', newValues: { projects: plans.filter((x) => x.steps.length).map((x) => x.p.key) }, ip: 'cli' });
  if (db.flushPendingWrites) await db.flushPendingWrites();
  console.log('\nListo. Las tareas que estaban en "Code Review" ahora están en "Listo para QA".');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { planProject };
