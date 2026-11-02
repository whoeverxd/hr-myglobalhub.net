const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const agileService = require('../src/services/agile.service');
const jiraService = require('../src/services/jira.service');

test('Mis tareas: only my tasks in my projects, with their sprints; complete and reopen', () => {
  jiraService.ensureDefaultProjects();
  const project = agileService.resolveProject('MSHP') || jiraService.createProject({ key: 'MSHP', name: 'Wokokai', lead: 'PM', budget: 0, st: 'On track' });
  const ME = 'MGH-1046'; // Juan Zamora (seed employee)
  if (!agileService.isMember(project.id, ME)) agileService.addMember(project.id, { userId: ME, role: 'member' }, 'Tester');

  const sprint = agileService.createSprint(project.key, { name: 'Sprint mis tareas ' + Date.now() }, 'Tester');
  const mine = agileService.createTask(project.key, { title: 'Mía en sprint', assigneeId: ME, sprintId: sprint.id }, 'Tester');
  const sub = agileService.createTask(project.key, { title: 'Mi subtarea', parentId: mine.id, assigneeId: ME }, 'Tester');
  const backlog = agileService.createTask(project.key, { title: 'Mía en backlog', assigneeId: ME }, 'Tester');
  const other = agileService.createTask(project.key, { title: 'De otra persona', assigneeId: 'MGH-1042' }, 'Tester');

  const r = agileService.myTasks(ME);
  const ids = r.tasks.map((t) => t.id);
  assert.ok(ids.includes(mine.id) && ids.includes(sub.id) && ids.includes(backlog.id));
  assert.ok(!ids.includes(other.id), 'never someone else\'s task');
  assert.ok(r.sprints.some((s) => s.id === sprint.id && s.projectKey === project.key));
  assert.equal(r.tasks.find((t) => t.id === sub.id).parent_key, mine.task_key);
  assert.equal(r.tasks.find((t) => t.id === mine.id).project_key, project.key);
  assert.deepEqual(agileService.myTasks(null), { tasks: [], sprints: [] });

  const done = agileService.completeTask(backlog.id, true, 'Juan');
  assert.equal(Number(done.status_is_done), 1);
  const reopened = agileService.completeTask(backlog.id, false, 'Juan');
  assert.notEqual(Number(reopened.status_is_done), 1);

  for (const t of [other, backlog, mine]) agileService.deleteTask(t.id, 'Tester');
  agileService.deleteSprint(sprint.id, 'Tester');
  assert.equal(db.query('SELECT id FROM project_tasks WHERE id = ?', [sub.id]).length, 0);
});

test('Tarea propia: a task the employee creates for themselves is flagged (tasks and the activities logged on it)', () => {
  const activities = require('../src/controllers/activities.controller');
  const project = agileService.resolveProject('MSHP');
  const ME = 'MGH-1046';
  if (!agileService.isMember(project.id, ME)) agileService.addMember(project.id, { userId: ME, role: 'member' }, 'Tester');
  const own = agileService.createTask(project.key, { title: 'Imprevisto: migrar datos', assigneeId: ME }, 'Juan Zamora', '127.0.0.1', { employeeId: ME, role: 'employee' });
  const planned = agileService.createTask(project.key, { title: 'Planificada por el PM', assigneeId: ME }, 'Joshua', '127.0.0.1', { employeeId: 'MGH-1042', role: 'pm' });
  assert.equal(own.self_created, true);
  assert.equal(own.creator_name, 'Juan Zamora');
  assert.equal(planned.self_created, false);
  assert.equal(agileService.myTasks(ME).tasks.find((t) => t.id === own.id).self_created, true);

  const act = activities.createActivity({ empId: ME, date: '2025-03-03', hours: 2, jiraKey: own.task_key, description: 'Migración no prevista' });
  const listed = activities.listActivities({ empId: ME, dateFrom: '2025-03-03', dateTo: '2025-03-03' }).find((a) => a.id === act.id);
  assert.equal(listed.selfTask, true);
  db.execute('DELETE FROM daily_activities WHERE id = ?', [act.id]);
  for (const t of [own, planned]) agileService.deleteTask(t.id, 'Tester');
});
