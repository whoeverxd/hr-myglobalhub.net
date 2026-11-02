#!/usr/bin/env node
/**
 * Creates the Wokokai moderation & reporting work (scripts/data/wokokai-moderacion.js) in the MSHP backlog:
 * 8 tasks for Carmen Pérez (estimate on the task), each with a design subtask per screen (Carmen) and an
 * implementation subtask per screen (Zain Rondón). Zain is added as a member of Wokokai if he is not one yet.
 *
 *   node scripts/create-moderation-tasks.js           → dry run from backend/data/firestore_cache.json (writes nothing)
 *   node scripts/create-moderation-tasks.js --apply   → reads LIVE Firestore, shows the real plan, asks CREAR
 *
 * Idempotent: a task (by title, in MSHP) or subtask (by title, under its parent) that already exists is skipped.
 * Subtasks carry no estimate (the task's hours are Carmen's total; nothing is counted twice in sprint stats).
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const DATA = require('./data/wokokai-moderacion');

const APPLY = process.argv.slice(2).includes('--apply');
const CACHE_FILE = path.join(__dirname, '..', 'data', 'firestore_cache.json');
const PROJECT = 'MSHP';
const CARMEN = 'MGH-1179';
const ZAIN = 'MGH-1183';
const ACTOR = 'Planificación Wokokai (script)';
const rowsOf = (t) => (Array.isArray(t) ? t : Object.values(t || {}));

const designTitle = (s) => `Diseño ${s.code} · ${s.name}`;
const buildTitle = (s) => `Implementación ${s.code} · ${s.name}`;
const parentDescription = (t) => `Objetivo: ${t.objective}\n\nResponsable: Carmen Pérez (diseño) • Implementación: Zain Rondón\n\nPantallas:\n${t.screens.map((s) => `- ${s.code} ${s.name}`).join('\n')}`;

function plan(tasks, members, projectId) {
  const inProject = tasks.filter((t) => t.project_id === projectId);
  const steps = { addZain: !members.some((m) => m.project_id === projectId && m.user_id === ZAIN), tasks: [] };
  for (const t of DATA) {
    const existing = inProject.find((x) => !x.parent_id && x.title === t.title);
    const kids = existing ? inProject.filter((x) => x.parent_id === existing.id) : [];
    steps.tasks.push({
      def: t,
      existing: existing ? existing.task_key : null,
      subtasks: t.screens.flatMap((s) => [
        { screen: s, kind: 'design', title: designTitle(s), assignee: CARMEN, exists: kids.some((k) => k.title === designTitle(s)) },
        { screen: s, kind: 'build', title: buildTitle(s), assignee: ZAIN, exists: kids.some((k) => k.title === buildTitle(s)) },
      ]),
    });
  }
  return steps;
}

function show(steps) {
  if (steps.addZain) console.log(`  AÑADIR    ${ZAIN} (Zain Rondón) como miembro de ${PROJECT}`);
  let nTasks = 0, nSubs = 0;
  for (const t of steps.tasks) {
    if (!t.existing) nTasks += 1;
    console.log(`  ${t.existing ? 'EXISTE   ' : 'CREAR    '} ${t.existing || '(nueva)'}  ${t.def.title}  • ${t.def.hours} h • Carmen`);
    for (const s of t.subtasks) {
      if (!s.exists) nSubs += 1;
      console.log(`     ${s.exists ? 'existe' : 'crear '}  ${s.title}  • ${s.kind === 'design' ? 'Carmen' : 'Zain'}`);
    }
  }
  console.log(`\n  Total: ${nTasks} tareas y ${nSubs} subtareas nuevas • ${DATA.reduce((a, t) => a + t.hours, 0)} h estimadas de Carmen`);
  return nTasks + nSubs + (steps.addZain ? 1 : 0);
}

async function main() {
  if (!APPLY) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const proj = rowsOf(cache.jira_projects).find((p) => p.key === PROJECT);
    if (!proj) { console.error(`No existe el proyecto ${PROJECT} en la copia local.`); process.exit(1); }
    console.log('DRY RUN (copia local). Nada se escribe.\n');
    show(plan(rowsOf(cache.project_tasks), rowsOf(cache.project_members), proj.id));
    console.log('\nPara aplicar: --apply (lee Firestore en vivo, muestra el plan real y pide escribir CREAR).');
    return;
  }
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  process.env.DATABASE_CLIENT = 'firestore';
  process.env.SKIP_SEED = 'true';
  process.env.SKIP_REMOTE_INIT = 'false';
  const db = require('../src/db/connection');
  await db.initDatabase();
  if (!db.getAdapter().hydratedFromRemote) { console.error('No se pudieron leer los datos en vivo de Firestore. No se cambió nada.'); process.exit(1); }
  const agile = require('../src/services/agile.service');
  const proj = agile.resolveProject(PROJECT);
  if (!proj) { console.error(`No existe el proyecto ${PROJECT}.`); process.exit(1); }
  for (const id of [CARMEN, ZAIN]) {
    if (!db.getOne('SELECT id FROM employees WHERE id = ?', [id])) { console.error(`No existe el empleado ${id}. No se cambió nada.`); process.exit(1); }
  }
  const steps = plan(db.query('SELECT id, task_key, title, parent_id, project_id FROM project_tasks'), db.query('SELECT project_id, user_id FROM project_members'), proj.id);
  console.log('Datos EN VIVO de Firestore. Plan:\n');
  if (!show(steps)) { console.log('\nTodo existe ya. Nada que hacer.'); process.exit(0); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question(`\n¿Crear esto en el backlog de ${PROJECT} en PRODUCCIÓN? Escribe CREAR para continuar: `, r));
  rl.close();
  if (answer.trim() !== 'CREAR') { console.log('Cancelado. No se cambió nada.'); process.exit(0); }

  if (steps.addZain) agile.addMember(proj.id, { userId: ZAIN, role: 'member' }, ACTOR);
  for (const t of steps.tasks) {
    const parent = t.existing
      ? agile.getTask(t.existing)
      : agile.createTask(proj.id, { title: t.def.title, description: parentDescription(t.def), taskType: 'Story', priority: 'High', estimateHours: t.def.hours, storyPoints: 0, assigneeId: CARMEN, labels: ['moderación', 'diseño'] }, ACTOR);
    console.log(`  ${parent.task_key}  ${t.def.title}`);
    const designKeys = {};
    for (const s of t.subtasks.filter((x) => x.kind === 'design')) {
      const k = s.exists ? agile.listSubtasks(parent.id).find((x) => x.title === s.title)
        : agile.createTask(proj.id, { title: s.title, parentId: parent.id, description: s.screen.spec, assigneeId: CARMEN, estimateHours: 0, storyPoints: 0, labels: ['moderación', 'diseño'] }, ACTOR);
      designKeys[s.screen.code] = k.task_key;
      if (!s.exists) console.log(`     ${k.task_key}  ${s.title}`);
    }
    for (const s of t.subtasks.filter((x) => x.kind === 'build' && !x.exists)) {
      const k = agile.createTask(proj.id, { title: s.title, parentId: parent.id, description: `Implementar la pantalla ${s.screen.code} según el diseño de Carmen (${designKeys[s.screen.code]}).\n\n${s.screen.spec}`, assigneeId: ZAIN, estimateHours: 0, storyPoints: 0, labels: ['moderación', 'implementación'] }, ACTOR);
      console.log(`     ${k.task_key}  ${s.title}`);
    }
  }
  console.log('\nEsperando a que terminen las escrituras…');
  const adapter = db.getAdapter();
  for (let i = 0; i < 120 && adapter.activeWrites && adapter.activeWrites.size; i++) await new Promise((r) => setTimeout(r, 500));
  console.log('Listo. Reinicia el servidor de producción (o espera a su próxima hidratación) para verlas.');
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
