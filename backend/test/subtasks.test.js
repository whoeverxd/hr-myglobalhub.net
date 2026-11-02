const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const agileService = require('../src/services/agile.service');
const jiraService = require('../src/services/jira.service');

test('Subtasks: same project, one level, roll-up, follow the parent sprint and go with it on delete', () => {
  jiraService.ensureDefaultProjects();
  let project = agileService.resolveProject('MSHP');
  if (!project) project = jiraService.createProject({ key: 'MSHP', name: 'Wokokai', lead: 'PM', budget: 0, st: 'On track' });
  const other = agileService.resolveProject('ARW') || jiraService.createProject({ key: 'ARW', name: 'Arawaki', lead: 'PM', budget: 0, st: 'On track' });
  const done = agileService.getStatuses(project.key).find((s) => s.is_done === 1);

  const parent = agileService.createTask(project.key, { title: 'Flujo completo para reportar', estimate_hours: 12 }, 'Tester');
  assert.equal(parent.subtask_count, 0);
  const s1 = agileService.createTask(project.key, { title: 'Diseño U-01', parentKey: parent.task_key, assigneeName: 'Carmen' }, 'Tester');
  const s2 = agileService.createTask(project.key, { title: 'Implementación U-01', parentId: parent.id }, 'Tester');
  assert.equal(s1.task_type, 'Subtask');
  assert.equal(s1.parent_key, parent.task_key);
  assert.equal(s1.parent_title, 'Flujo completo para reportar');

  // One level only, same project
  assert.throws(() => agileService.createTask(project.key, { title: 'x', parentId: s1.id }, 'Tester'), (e) => e.status === 400 && /no pueden tener subtareas/.test(e.message));
  assert.throws(() => agileService.createTask(other.key, { title: 'x', parentId: parent.id }, 'Tester'), (e) => e.status === 400);
  assert.throws(() => agileService.createTask(project.key, { title: 'x', parentKey: 'MSHP-999999' }, 'Tester'), (e) => e.status === 400);

  // Roll-up on the parent (list, get and search)
  agileService.updateTask(s1.id, { statusId: done.id, logged_hours: 3 }, 'Tester');
  agileService.updateTask(s2.id, { logged_hours: 1.5 }, 'Tester');
  const p = agileService.getTask(parent.id);
  assert.deepEqual([p.subtask_count, p.subtask_done, p.subtask_logged_hours], [2, 1, 4.5]);
  assert.equal(agileService.listTasks(project.key).find((t) => t.id === parent.id).subtask_count, 2);
  assert.equal(agileService.searchAllTasks({ query: 'Implementación U-01' })[0].parent_key, parent.task_key);
  assert.deepEqual(agileService.listSubtasks(parent.task_key).map((t) => t.id), [s1.id, s2.id]);

  // Subtasks follow the parent's sprint and cannot leave it on their own
  const sprint = agileService.createSprint(project.key, { name: 'Sprint subtareas ' + Date.now() }, 'Tester');
  agileService.updateTask(parent.id, { sprintId: sprint.id }, 'Tester');
  assert.equal(agileService.getTask(s1.id).sprint_id, sprint.id);
  agileService.updateTask(s2.id, { sprintId: null }, 'Tester');
  assert.equal(agileService.getTask(s2.id).sprint_id, sprint.id, 'a subtask stays in its parent sprint');
  const s3 = agileService.createTask(project.key, { title: 'Nueva en sprint', parentId: parent.id }, 'Tester');
  assert.equal(s3.sprint_id, sprint.id, 'a new subtask starts in the parent sprint');

  // Deleting the parent removes its subtasks
  const r = agileService.deleteTask(parent.id, 'Tester');
  assert.deepEqual(r.deletedSubtasks.sort(), [s1.task_key, s2.task_key, s3.task_key].sort());
  assert.equal(db.query('SELECT id FROM project_tasks WHERE parent_id = ?', [parent.id]).length, 0);
  agileService.deleteSprint(sprint.id, 'Tester');
});
