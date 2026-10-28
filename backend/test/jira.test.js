const test = require('node:test');
const assert = require('node:assert/strict');
const jiraService = require('../src/services/jira.service');
const activitiesController = require('../src/controllers/activities.controller');
const { getAuditLogs } = require('../src/controllers/audit.controller');
const db = require('../src/db');

test('Jira Service: Get config and verify connection mode', async () => {
  const config = jiraService.getConfig();
  assert.ok(config.host);
  assert.ok(config.projectKey);
  assert.ok(config.mode);

  const conn = await jiraService.testConnection();
  assert.ok(typeof conn.ok === 'boolean');
  assert.ok(conn.status);
  assert.ok(conn.message);
  if (!conn.ok) {
    assert.ok(conn.message.includes('No se ha podido conectar con Jira'));
  }
});

test('Jira Service: Search issues with SQLite local cache', async () => {
  const allIssues = jiraService.searchIssues();
  assert.ok(allIssues.length >= 5);
  assert.ok(allIssues[0].key);
  assert.ok(allIssues[0].summary);

  const searchRes = jiraService.searchIssues({ query: 'MSHP-101' });
  assert.ok(searchRes.length >= 1);
  assert.equal(searchRes[0].key, 'MSHP-101');
  assert.ok(searchRes[0].estimate > 0);

  const cachedCount = jiraService.getCachedCount();
  assert.ok(cachedCount >= 5);

  const syncStatus = jiraService.getSyncStatus();
  assert.ok(syncStatus);
  assert.ok(syncStatus.status);
});

test('Jira Service: Worklog synchronization and discrepancy reporting', () => {
  const testDate = '2025-04-19';
  const empId = 'MGH-1042';

  // The estimate comes from the Jira cache only (there is no invented 4h fallback any more): arrange it explicitly.
  db.execute('DELETE FROM jira_issues_cache WHERE key IN (?, ?)', ['MSH-220', 'MSH-221']);
  db.execute(
    `INSERT INTO jira_issues_cache (key, project_key, summary, issue_type, status, estimate_hours, logged_hours) VALUES (?, 'MSH', ?, 'Test', 'To Do', ?, 0)`,
    ['MSH-220', 'Pruebas unitarias de cálculo de retenciones impositivas', 4.0]
  );
  db.execute(
    `INSERT INTO jira_issues_cache (key, project_key, summary, issue_type, status, estimate_hours, logged_hours) VALUES (?, 'MSH', ?, 'Test', 'To Do', NULL, 0)`,
    ['MSH-221', 'Issue sin estimado en Jira']
  );
  // An issue with no estimate is never flagged against an invented one
  const actNoEstimate = activitiesController.createActivity({
    employeeId: empId,
    date: testDate,
    jiraKey: 'MSH-221',
    jiraSummary: 'Issue sin estimado en Jira',
    hours: 9.0,
    workType: 'Pruebas',
    description: 'Sin estimado',
  }, 'Carlos Mendez');

  // 1. Create an activity that severely exceeds Jira estimate (Estimate: 4.0h for MSH-220, log 9.0h -> OVER_ESTIMATE)
  const actOver = activitiesController.createActivity({
    employeeId: empId,
    date: testDate,
    jiraKey: 'MSH-220',
    jiraSummary: 'Pruebas unitarias de cálculo de retenciones impositivas',
    hours: 9.0,
    workType: 'Pruebas',
    description: 'Ampliación de casos de prueba de borde para DGII y FICA',
  }, 'Carlos Mendez');

  // 2. Run sync
  const syncResult = jiraService.syncWorklogs({
    empId,
    dateFrom: testDate,
    dateTo: testDate,
    user: 'Elena Rostova',
  });

  assert.ok(syncResult.syncedAt);
  assert.ok(syncResult.syncedCount >= 1);
  assert.ok(syncResult.discrepanciesCount >= 1);

  const foundDisc = syncResult.discrepancies.find((d) => d.activityId === actOver.id);
  assert.ok(foundDisc, 'Should flag discrepancy for over-estimated activity');
  assert.equal(foundDisc.flag, 'OVER_ESTIMATE');
  assert.equal(foundDisc.loggedHours, 9.0);
  assert.equal(foundDisc.estimatedHours, 4.0);
  assert.equal(foundDisc.deltaHours, 5.0);
  assert.equal(syncResult.discrepancies.find((d) => d.activityId === actNoEstimate.id), undefined, 'no estimate → no discrepancy');

  // 3. Verify audit trail
  const audits = getAuditLogs({ entityType: 'jira_sync' });
  const audit = audits.find((a) => a.action === 'JIRA_WORKLOG_SYNC');
  assert.ok(audit, 'Audit log must record JIRA_WORKLOG_SYNC');

  // Clean up
  activitiesController.deleteActivity(actOver.id, 'Carlos Mendez');
  activitiesController.deleteActivity(actNoEstimate.id, 'Carlos Mendez');
  db.execute('DELETE FROM jira_issues_cache WHERE key IN (?, ?)', ['MSH-220', 'MSH-221']);
});

test('Jira Service: List projects from SQLite with task counts', () => {
  const projects = jiraService.listProjects();
  assert.ok(Array.isArray(projects));
  assert.ok(projects.length >= 1, 'Should list at least one project');

  const p = projects[0];
  assert.ok(p.key, 'Project must have a key');
  assert.ok(p.name, 'Project must have a name');
  assert.ok(typeof p.tasks_count === 'number', 'Project must have tasks_count');
});

test('Jira Service: Get project issues with SQLite fallback and filter', () => {
  // Check issues for CORE or MSHP (seeded in database)
  const result = jiraService.getProjectIssues({ projectKey: 'CORE' });
  assert.ok(result);
  assert.equal(result.projectKey, 'CORE');
  assert.ok(Array.isArray(result.issues));
  assert.ok(typeof result.total === 'number');

  if (result.issues.length > 0) {
    const issue = result.issues[0];
    assert.ok(issue.key, 'Issue must have a key');
    assert.ok(issue.summary, 'Issue must have a summary/title');
    assert.ok(issue.status, 'Issue must have a status');
    assert.ok('assignee' in issue, 'Issue must have assignee field');
    assert.ok('updated' in issue, 'Issue must have updated field');
  }

  // Filter test
  const filtered = jiraService.getProjectIssues({ projectKey: 'CORE', query: 'CORE' });
  assert.ok(Array.isArray(filtered.issues));
});

test('Jira Service: Validate and link project rejects invalid key without saving', async () => {
  const initialProjects = jiraService.listProjects();
  const initialCount = initialProjects.length;

  // Empty key should throw 400
  await assert.rejects(
    async () => {
      await jiraService.validateAndLinkProject({ key: '   ' });
    },
    (err) => {
      assert.equal(err.status, 400);
      assert.ok(err.message.includes('obligatoria'));
      return true;
    }
  );

  // Non-existent key should throw 404 or connection error and not save
  await assert.rejects(
    async () => {
      await jiraService.validateAndLinkProject({ key: 'PROJ_NON_EXISTENT_99999' });
    },
    (err) => {
      assert.ok(err.message);
      return true;
    }
  );

  const afterProjects = jiraService.listProjects();
  assert.equal(afterProjects.length, initialCount, 'Project count must not increase on failed validation');
});

test('Jira Service: Validate and link real Jira project without duplicates', async () => {
  const originalFetch = global.fetch;
  const originalEmail = process.env.JIRA_EMAIL;
  const originalToken = process.env.JIRA_API_TOKEN;

  // getConfig() reads these at call time and validateAndLinkProject refuses to run
  // without them, so this test only passed on a machine that happened to have real
  // Jira credentials in its .env. Fake credentials keep it hermetic: the point of the
  // test is the no-duplicates rule, not the connection.
  process.env.JIRA_EMAIL = 'tests@example.invalid';
  process.env.JIRA_API_TOKEN = 'fake-token-for-tests';

  global.fetch = async (url) => {
    if (String(url).includes('/project/MSHP')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: '10042',
          key: 'MSHP',
          name: 'MySocialHub Platform',
          lead: { displayName: 'Joshua Hernandez' },
        }),
      };
    }
    // The old stub fell through to the real fetch here, so any call the service made
    // besides the stubbed one left the test process and hit Atlassian for real.
    throw new Error(`unstubbed network call in test: ${url}`);
  };

  try {
    const linked = await jiraService.validateAndLinkProject({
      key: 'MSHP',
      user: 'Test User',
      ip: '127.0.0.1',
    });

    assert.ok(linked);
    assert.equal(linked.ok, true);
    assert.ok(linked.project);
    assert.equal(linked.project.key, 'MSHP');
    assert.ok(linked.project.jira_id);

    // Linking again should update/not duplicate
    const countBefore = jiraService.listProjects().filter((p) => p.key === 'MSHP').length;
    assert.equal(countBefore, 1, 'Should have exactly 1 record for MSHP');

    const linkedAgain = await jiraService.validateAndLinkProject({
      key: 'MSHP',
      user: 'Test User',
    });
    assert.equal(linkedAgain.project.key, 'MSHP');

    const countAfter = jiraService.listProjects().filter((p) => p.key === 'MSHP').length;
    assert.equal(countAfter, 1, 'Should still have exactly 1 record for MSHP (no duplication)');
  } finally {
    global.fetch = originalFetch;
    if (originalEmail === undefined) delete process.env.JIRA_EMAIL;
    else process.env.JIRA_EMAIL = originalEmail;
    if (originalToken === undefined) delete process.env.JIRA_API_TOKEN;
    else process.env.JIRA_API_TOKEN = originalToken;
  }
});

test('Jira & Projects CRUD: create, update, and delete custom project in SQLite', () => {
  const testKey = 'TESTPRJ';
  try {
    jiraService.deleteProject(testKey);
  } catch (_) {}

  // 1. Create project
  const created = jiraService.createProject({
    key: testKey,
    name: 'Test Innovation Project',
    lead: 'Joshua Hernandez',
    budget: 75000,
    bill: 95,
    st: 'On track',
  });

  assert.equal(created.key, testKey);
  assert.equal(created.name, 'Test Innovation Project');
  assert.equal(created.lead, 'Joshua Hernandez');
  assert.equal(created.budget, 75000);
  assert.equal(created.bill, 95);

  // Verify it shows up in listProjects
  const list = jiraService.listProjects();
  const found = list.find((p) => p.key === testKey);
  assert.ok(found, 'Created project should be listed');
  assert.equal(found.name, 'Test Innovation Project');

  // 2. Update project
  const updated = jiraService.updateProject(testKey, {
    name: 'Test Innovation Project Updated',
    budget: 85000,
    st: 'At risk',
  });
  assert.equal(updated.name, 'Test Innovation Project Updated');
  assert.equal(updated.budget, 85000);
  assert.equal(updated.st, 'At risk');

  // 3. Delete project
  const deleted = jiraService.deleteProject(testKey);
  assert.equal(deleted.ok, true);

  const listAfterDelete = jiraService.listProjects();
  assert.ok(!listAfterDelete.find((p) => p.key === testKey), 'Project should be deleted');
});
