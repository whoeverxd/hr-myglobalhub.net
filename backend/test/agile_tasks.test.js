const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const agileService = require('../src/services/agile.service');
const jiraService = require('../src/services/jira.service');
const activitiesController = require('../src/controllers/activities.controller');

test('Agile Module: Workflow Statuses, Sprints, Native Tasks, and Jira Cloner', async () => {
  // Asegurar que exista un proyecto base de prueba
  jiraService.ensureDefaultProjects();
  let project = agileService.resolveProject('MSHP');
  if (!project) {
    project = jiraService.createProject({
      key: 'MSHP',
      name: 'MSHP — Agile Project',
      lead: 'Elena Rostova',
      budget: 50000,
      st: 'On track'
    });
  }
  assert.ok(project, 'Project MSHP must exist');

  // 1. Workflow Statuses
  const defaultStatuses = agileService.getStatuses(project.key);
  assert.ok(defaultStatuses.length >= 4, 'Should initialize 4 default statuses');
  const todoStatus = defaultStatuses.find(s => s.category === 'todo');
  const doneStatus = defaultStatuses.find(s => s.category === 'done');
  assert.ok(todoStatus, 'Must have a todo category status');
  assert.ok(doneStatus, 'Must have a done category status');
  assert.equal(doneStatus.is_done, 1);

  // Crear un estado personalizado (ej. QA Testing)
  const qaStatus = agileService.createStatus(project.key, {
    name: 'QA Testing',
    category: 'in_progress',
    color: '#f59e0b',
  }, 'Elena Rostova');
  assert.ok(qaStatus.id);
  assert.equal(qaStatus.name, 'QA Testing');
  assert.equal(qaStatus.category, 'in_progress');

  // 2. Sprint Management Lifecycle
  const sprint = agileService.createSprint(project.key, {
    name: 'Sprint 1 - Core Agile Engine',
    goal: 'Eliminar licencias de Jira e implementar tableros nativos',
    startDate: '2025-04-15',
    endDate: '2025-04-29',
  }, 'Elena Rostova');
  assert.ok(sprint.id);
  assert.equal(sprint.status, 'PLANNED');

  // Iniciar Sprint
  const startedSprint = agileService.startSprint(sprint.id, {}, 'Elena Rostova');
  assert.equal(startedSprint.status, 'ACTIVE');

  // 3. Native Tasks & Key Sequential Generation
  const task1 = agileService.createTask(project.key, {
    title: 'Diseñar arquitectura de base de datos ágil',
    description: 'Tablas project_tasks, sprints, project_statuses y project_members',
    task_type: 'Story',
    priority: 'High',
    estimate_hours: 6.0,
    story_points: 3,
    sprint_id: sprint.id,
    assignee_name: 'Carlos Mendez',
  }, 'Elena Rostova');

  assert.ok(task1.id);
  assert.ok(task1.task_key.startsWith('MSHP-'), 'Key must start with project key');
  assert.equal(task1.sprint_id, sprint.id);

  const task2 = agileService.createTask(project.key, {
    title: 'Implementar endpoints REST de sprints y backlog',
    description: 'Controladores y rutas en Express',
    task_type: 'Task',
    priority: 'Medium',
    estimate_hours: 4.0,
    story_points: 2,
    // Dejar sin sprint_id para probar Backlog
  }, 'Elena Rostova');

  assert.ok(task2.id);
  assert.ok(task2.task_key.startsWith('MSHP-'));
  assert.notEqual(task1.task_key, task2.task_key, 'Task keys must be unique and sequential');

  // Consultar backlog vs sprint
  const sprintTasks = agileService.listTasks(project.key, { sprintId: sprint.id });
  assert.ok(sprintTasks.some(t => t.id === task1.id));
  assert.ok(!sprintTasks.some(t => t.id === task2.id));

  const backlogTasks = agileService.listTasks(project.key, { inBacklog: true });
  assert.ok(backlogTasks.some(t => t.id === task2.id));

  // Mover task2 del backlog al sprint y al estado QA Testing
  const movedTask = agileService.moveTask(task2.id, {
    sprintId: sprint.id,
    statusId: qaStatus.id,
  }, 'Carlos Mendez');
  assert.equal(movedTask.sprint_id, sprint.id);
  assert.equal(movedTask.status_id, qaStatus.id);

  // 4. Clonador de Tickets Legacy desde Jira (Fase 2.3)
  const cloneResult = await agileService.cloneJiraIssue({
    jiraKey: 'MSH-214',
    targetProjectKey: project.key,
    sprintId: sprint.id,
  }, 'Elena Rostova');

  assert.equal(cloneResult.success, true);
  assert.equal(cloneResult.clonedFrom, 'MSH-214');
  assert.ok(cloneResult.task.task_key.startsWith('MSHP-'));
  assert.equal(cloneResult.task.origin_jira_key, 'MSH-214');
  assert.ok(cloneResult.task.title.length > 0);

  // 5. Integración con Registro Diario de Actividades (Horas acumuladas)
  const activity = activitiesController.createActivity({
    employeeId: 'MGH-1042',
    date: '2025-04-18',
    jiraKey: task1.task_key, // Vincular a la clave nativa MSHP-X
    jiraSummary: task1.title,
    hours: 2.5,
    workType: 'Desarrollo',
    description: 'Avance en migración de esquema y modelos',
  }, 'Carlos Mendez');

  assert.ok(activity.id);

  // Verificar que task1 refleje las horas acumuladas en project_tasks
  const refreshedTask1 = agileService.getTask(task1.id);
  assert.equal(refreshedTask1.logged_hours, 2.5, 'Logged hours must be automatically updated');

  // Borrar actividad y verificar reversión de horas
  activitiesController.deleteActivity(activity.id, 'Carlos Mendez');
  const revertedTask1 = agileService.getTask(task1.id);
  assert.equal(revertedTask1.logged_hours, 0, 'Logged hours must revert on deletion');

  // 6. Cierre de Sprint con Traspaso de Tareas Incompletas al Backlog
  // Marcar task1 como Done
  agileService.moveTask(task1.id, { statusId: doneStatus.id });

  // Completar sprint
  const closedSprint = agileService.completeSprint(sprint.id, { moveRemainingTo: 'backlog' }, 'Elena Rostova');
  assert.equal(closedSprint.status, 'CLOSED');
  assert.ok(closedSprint.completed_at);

  // task1 (Done) se mantiene con sprint_id = sprint.id para histórico
  const task1AfterClose = agileService.getTask(task1.id);
  assert.equal(task1AfterClose.sprint_id, sprint.id);

  // task2 (QA Testing, incompleta) debió moverse al Backlog (sprint_id = null)
  const task2AfterClose = agileService.getTask(task2.id);
  assert.equal(task2AfterClose.sprint_id, null, 'Incomplete task should rollover to backlog');

  // 7. Miembros del Proyecto
  const member = agileService.addMember(project.key, {
    userId: 'MGH-1042',
    role: 'member',
  }, 'Elena Rostova');
  assert.ok(member.id);
  assert.equal(member.role, 'member');

  const membersList = agileService.listMembers(project.key);
  assert.ok(membersList.some(m => m.user_id === 'MGH-1042'));

  agileService.removeMember(project.key, 'MGH-1042', 'Elena Rostova');
  const membersAfter = agileService.listMembers(project.key);
  assert.equal(membersAfter.some(m => m.user_id === 'MGH-1042'), false);
});
