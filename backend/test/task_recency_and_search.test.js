const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const adapter = require('../src/db/adapters/firestore.adapter');
const agileService = require('../src/services/agile.service');
const jiraService = require('../src/services/jira.service');

// "Las tareas jira deben mostrarse de la más reciente a la última" — and the search has to reach the ones
// that are not on the first page. Both lists were ordered by a column that said nothing about recency.

const uniq = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function ensureProject() {
  jiraService.ensureDefaultProjects();
  return agileService.resolveProject('MSHP') || jiraService.createProject({ key: 'MSHP', name: 'MSHP — Agile', lead: 'Elena Rostova' });
}

test('A cached Jira ticket is listed by the date Jira created it, not by when the sync wrote the row', () => {
  const tag = 'ORD' + uniq();
  // One bulk sync writes the same cached_at on every row it touches, so it broke no tie at all.
  const sameSync = '2026-10-23 19:38:05';
  const rows = [
    { key: `${tag}-MIDDLE`, created: '2026-11-10T09:00:00.000-0400' },
    { key: `${tag}-OLDEST`, created: '2026-11-01T09:00:00.000-0400' },
    { key: `${tag}-NEWEST`, created: '2026-11-20T09:00:00.000-0400' },
  ];
  for (const r of rows) {
    db.execute(
      `INSERT INTO jira_issues_cache (key, summary, project_key, status, jira_created_at, jira_updated_at, cached_at)
       VALUES (?, ?, 'MSHP', 'Registrado', ?, ?, ?)`,
      [r.key, `Orden ${r.key}`, r.created, r.created, sameSync]
    );
  }

  const listed = jiraService.searchIssues({ limit: 200 }).filter((i) => i.key.startsWith(tag)).map((i) => i.key);
  assert.deepEqual(listed, [`${tag}-NEWEST`, `${tag}-MIDDLE`, `${tag}-OLDEST`], 'the newest ticket comes first');

  // And the same order when the search box is used
  const searched = jiraService.searchIssues({ query: tag.toLowerCase(), limit: 200 }).map((i) => i.key);
  assert.deepEqual(searched, [`${tag}-NEWEST`, `${tag}-MIDDLE`, `${tag}-OLDEST`], 'searching keeps the newest first');
});

// This one passed before the fix too, and that is the point: the server could always search. What was broken
// was the browser, which filtered the page it already held and never sent the query. This pins the contract
// the picker now depends on — a capped limit or a dropped query param breaks it here instead of in the field.
test('A ticket outside the first page is still found by typing its key', () => {
  const tag = 'DEEP' + uniq();
  // 25 newer rows bury it: with a page of 20 and a filter applied in the browser, it was unreachable
  for (let i = 0; i < 25; i += 1) {
    db.execute(
      `INSERT INTO jira_issues_cache (key, summary, project_key, status, jira_created_at, cached_at)
       VALUES (?, ?, 'MSHP', 'Registrado', ?, ?)`,
      [`${tag}-FILL${i}`, 'Relleno', `2026-12-${String(i + 2).padStart(2, '0')}T09:00:00.000-0400`, '2026-12-01 10:00:00']
    );
  }
  const buried = `${tag}-BURIED`;
  db.execute(
    `INSERT INTO jira_issues_cache (key, summary, project_key, status, jira_created_at, cached_at)
     VALUES (?, 'Tarea enterrada', 'MSHP', 'Registrado', '2026-12-01T09:00:00.000-0400', '2026-12-01 10:00:00')`,
    [buried]
  );

  const firstPage = jiraService.searchIssues({ limit: 20 }).map((i) => i.key);
  assert.equal(firstPage.includes(buried), false, 'it really is off the first page');
  const found = jiraService.searchIssues({ query: buried.toLowerCase(), limit: 20 }).map((i) => i.key);
  assert.deepEqual(found, [buried], 'the server finds it by key');
});

test("A project's task list can be read newest first, and the board keeps its manual order", () => {
  const project = ensureProject();
  const tag = 'REC' + uniq();
  const made = ['PRIMERA', 'SEGUNDA', 'TERCERA'].map((n) => agileService.createTask(project.key, { title: `${tag} ${n}` }, 'Elena Rostova'));
  // createTask stamps the clock, so three calls in the same millisecond would decide nothing: spread them
  made.forEach((t, i) => db.execute('UPDATE project_tasks SET created_at = ? WHERE id = ?', [`2026-11-0${i + 1}T10:00:00.000Z`, t.id]));

  const mine = (rows) => rows.filter((t) => t.title.startsWith(tag)).map((t) => t.title.split(' ')[1]);

  const recent = mine(agileService.listTasks(project.key, { sort: 'recent' }));
  assert.deepEqual(recent, ['TERCERA', 'SEGUNDA', 'PRIMERA'], 'the task you just created is at the top');

  // The board is arranged by hand (order_index, MAX + 1 on each new card): that order must not change
  const board = mine(agileService.listTasks(project.key));
  assert.deepEqual(board, ['PRIMERA', 'SEGUNDA', 'TERCERA'], 'the kanban order is untouched');
});

test('The task picker lists the newest task first, even one nobody has touched since', () => {
  const project = ensureProject();
  const tag = 'PICK' + uniq();
  const made = ['VIEJA', 'NUEVA'].map((n) => agileService.createTask(project.key, { title: `${tag} ${n}` }, 'Elena Rostova'));
  // The old task was touched today (hours logged against it); the new one has not been touched since.
  // Ordering by updated_at sent the new task to the bottom — the one you opened the picker to find.
  // In Firestore it was worse: a never-updated task has no updated_at at all, and NOT NULL here forbids
  // modelling that, so a later updated_at on the older task reproduces the same symptom.
  db.execute('UPDATE project_tasks SET created_at = ?, updated_at = ? WHERE id = ?', ['2026-11-01T10:00:00.000Z', '2026-11-30T10:00:00.000Z', made[0].id]);
  db.execute('UPDATE project_tasks SET created_at = ?, updated_at = ? WHERE id = ?', ['2026-11-20T10:00:00.000Z', '2026-11-20T10:00:00.000Z', made[1].id]);

  const listed = agileService.searchAllTasks({ query: tag, limit: 50 }).map((t) => t.title.split(' ')[1]);
  assert.deepEqual(listed, ['NUEVA', 'VIEJA'], 'newest first');
});

test('A new task carries updated_at into Firestore, where no column default exists', async (t) => {
  const project = ensureProject();

  // Capture the statement createTask really sends, then replay that exact statement against the Firestore
  // write path: initSchema() only runs on SQLite, so `DEFAULT (datetime('now'))` never reaches production.
  const sent = [];
  const realExecute = db.execute;
  db.execute = (sql, params) => { sent.push({ sql, params }); return realExecute(sql, params); };
  try {
    agileService.createTask(project.key, { title: 'Sello de tiempo ' + uniq() }, 'Elena Rostova');
  } finally {
    db.execute = realExecute;
  }
  const insert = sent.find((s) => /INSERT INTO project_tasks/i.test(s.sql));
  assert.ok(insert, 'createTask inserts a task');

  const writes = [];
  const fakeDb = { collection: (col) => ({ doc: (id) => ({ set: (data, opts) => { writes.push({ col, id, data, opts }); return Promise.resolve(); }, delete: () => Promise.resolve() }) }) };
  const orig = { getFirestore: adapter.getFirestore, persist: adapter._persistLocalSnapshot, init: adapter.init };
  adapter.getFirestore = () => fakeDb;
  adapter._persistLocalSnapshot = () => {};
  adapter.init = async () => {};
  t.after(() => Object.assign(adapter, { getFirestore: orig.getFirestore, _persistLocalSnapshot: orig.persist, init: orig.init }));

  await adapter.execute(insert.sql, insert.params);

  const w = writes.find((x) => x.col === 'project_tasks');
  assert.ok(w, 'the task document was written');
  assert.ok(w.data.created_at && String(w.data.created_at).trim(), 'created_at is stored');
  assert.ok(w.data.updated_at && String(w.data.updated_at).trim(), 'updated_at is stored, not left to a SQLite default');
});
