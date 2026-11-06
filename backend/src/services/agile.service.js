const crypto = require('crypto');
const db = require('../db');
const { logAction } = require('../controllers/audit.controller');
const jiraService = require('./jira.service');
const { todayLocal, nowStamp } = require('../utils/today');

// QA workflow: whoever did the task moves it to "Listo para QA" (qa_step 'ready'); another project member (or a PM)
// takes it to "Completado" or to "Bug encontrado" (qa_step 'bug', a note is required). See checkStatusChange().
const DEFAULT_STATUS_TEMPLATES = [
  { name: 'Por hacer', category: 'todo', color: '#64748b', is_default: 1, is_done: 0, qa_step: null },
  { name: 'En progreso', category: 'in_progress', color: '#3b82f6', is_default: 0, is_done: 0, qa_step: null },
  { name: 'Listo para QA', category: 'in_progress', color: '#8b5cf6', is_default: 0, is_done: 0, qa_step: 'ready' },
  { name: 'Bug encontrado', category: 'in_progress', color: '#dc2626', is_default: 0, is_done: 0, qa_step: 'bug' },
  { name: 'Completado', category: 'done', color: '#10b981', is_default: 0, is_done: 1, qa_step: null },
];
const httpError = (status, message, code) => Object.assign(new Error(message), { status, code });

// The assignee created it: always when it came from "Agregar tarea propia" (label), otherwise only for non-PM/admin roles
const isSelfCreated = (t) => Boolean(t && t.creator_employee_id && t.creator_employee_id === t.assignee_id &&
  (!['pm', 'admin'].includes(t.creator_role) || /tarea propia/i.test(String(t.labels || ''))));

class AgileService {
  /**
   * Obtener proyecto por ID o clave (case-insensitive)
   */
  resolveProject(projectKeyOrId) {
    if (!projectKeyOrId) return null;
    const clean = String(projectKeyOrId).trim().toUpperCase();
    let proj = db.getOne('SELECT * FROM jira_projects WHERE UPPER(key) = ? OR id = ?', [clean, projectKeyOrId]);
    if (!proj) {
      // Intentar asegurar proyectos por defecto de Jira
      jiraService.ensureDefaultProjects();
      proj = db.getOne('SELECT * FROM jira_projects WHERE UPPER(key) = ? OR id = ?', [clean, projectKeyOrId]);
    }
    return proj;
  }

  /**
   * Garantiza que los estados iniciales existan para un proyecto
   */
  ensureDefaultStatuses(projectKeyOrId) {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) return [];

    const existing = db.query(
      'SELECT * FROM project_statuses WHERE project_id = ? ORDER BY position ASC',
      [proj.id]
    );

    if (existing && existing.length > 0) {
      return existing;
    }

    db.transaction(() => {
      DEFAULT_STATUS_TEMPLATES.forEach((tmpl, idx) => {
        const id = `stat_${proj.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}_${idx}_${Date.now()}`;
        db.execute(
          `INSERT INTO project_statuses (id, project_id, name, category, color, position, is_default, is_done, qa_step)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, proj.id, tmpl.name, tmpl.category, tmpl.color, idx, tmpl.is_default, tmpl.is_done, tmpl.qa_step]
        );
      });
    });

    return db.query(
      'SELECT * FROM project_statuses WHERE project_id = ? ORDER BY position ASC',
      [proj.id]
    );
  }

  /* =========================================================================
     ESTADOS / WORKFLOW
     ========================================================================= */

  getStatuses(projectKeyOrId) {
    return this.ensureDefaultStatuses(projectKeyOrId);
  }

  /** The QA statuses of a project: { ready, bug, done } (null when the project has no QA workflow) */
  qaStatuses(projectKeyOrId) {
    const statuses = this.ensureDefaultStatuses(projectKeyOrId);
    return {
      ready: statuses.find((s) => s.qa_step === 'ready') || null,
      bug: statuses.find((s) => s.qa_step === 'bug') || null,
      done: statuses.find((s) => Number(s.is_done) === 1) || null,
      all: statuses,
    };
  }

  /**
   * QA workflow rules for moving `task` to `targetStatusId` (only in projects that have a "Listo para QA" status).
   * actor = { employeeId, role }. Throws 403/409/400; returns nothing when the move is allowed.
   *  - Nobody but a PM or admin closes or "bugs" their own task: the assignee sends it to "Listo para QA".
   *    PM and admin may move any task, their own included, to any status.
   *  - A project member who is not the assignee may only take a task that is in "Listo para QA" to
   *    "Completado" or "Bug encontrado" (PM/admin may move any task).
   *  - "Bug encontrado" needs a note saying what is missing or broken.
   */
  checkStatusChange(task, targetStatusId, actor = {}, { qaNote } = {}) {
    if (!task || !targetStatusId || targetStatusId === task.status_id) return;
    const qa = this.qaStatuses(task.project_id);
    const target = qa.all.find((s) => s.id === targetStatusId);
    if (!target) throw httpError(400, 'Ese estado no pertenece al proyecto de la tarea.');
    if (!qa.ready) return; // project without QA workflow: previous behavior
    if (!actor || !actor.role) return; // internal call (scripts, services): no signed-in user to check
    const role = String(actor.role || '').toLowerCase();
    const isManager = role === 'admin' || role === 'pm';
    const isAssignee = Boolean(task.assignee_id && actor.employeeId && task.assignee_id === actor.employeeId);
    const toDone = Number(target.is_done) === 1;
    const toBug = target.qa_step === 'bug';
    const fromReady = qa.ready.id === task.status_id;

    if ((toDone || toBug) && isAssignee && !isManager) {
      throw httpError(403, toDone
        ? `No puedes completar tu propia tarea: muévela a "${qa.ready.name}" y otra persona del proyecto la revisa.`
        : 'No puedes marcar un bug en tu propia tarea: la revisa otra persona del proyecto.', 'QA_OWN_TASK');
    }
    if ((toDone || toBug) && !isManager && !fromReady) {
      throw httpError(409, `Solo una tarea en "${qa.ready.name}" pasa a "${target.name}".`, 'QA_NOT_READY');
    }
    if (toBug && !String(qaNote || '').trim()) {
      throw httpError(400, `Explica en una nota qué falta o qué bug encontraste: quien hizo la tarea la necesita para corregirla.`, 'QA_NOTE_REQUIRED');
    }
  }

  /** QA decision on a task in "Listo para QA": result 'passed' → Completado, 'bug' → Bug encontrado (note required) */
  qaReview(taskId, result, note, user = 'System', ip = '127.0.0.1', actor = {}) {
    const task = this.getTask(taskId);
    if (!task) throw httpError(404, 'Tarea no encontrada.');
    const qa = this.qaStatuses(task.project_id);
    if (!qa.ready) throw httpError(409, 'Este proyecto no tiene el flujo de QA: pide al PM que lo configure.', 'QA_NOT_CONFIGURED');
    const target = result === 'bug' ? qa.bug : result === 'passed' ? qa.done : null;
    if (!target) throw httpError(400, 'Indica el resultado de la revisión: completado o bug encontrado.');
    if (task.status_id !== qa.ready.id) throw httpError(409, `${task.task_key} ya no está en "${qa.ready.name}".`, 'QA_NOT_READY');
    this.checkStatusChange(task, target.id, actor, { qaNote: note });
    return this.updateTask(task.id, { statusId: target.id, qaNote: note }, user, ip);
  }

  /** True when `actor` (not the assignee) is only doing a QA step: a task in "Listo para QA" → done or bug */
  isQaReview(task, targetStatusId) {
    if (!task || !targetStatusId) return false;
    const qa = this.qaStatuses(task.project_id);
    if (!qa.ready || task.status_id !== qa.ready.id) return false;
    const target = qa.all.find((s) => s.id === targetStatusId);
    return Boolean(target && (Number(target.is_done) === 1 || target.qa_step === 'bug'));
  }

  createStatus(projectKeyOrId, data, user = 'System', ip = '127.0.0.1') {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) throw new Error(`Proyecto no encontrado: ${projectKeyOrId}`);

    const name = (data.name || '').trim();
    if (!name) throw new Error('El nombre del estado es obligatorio.');

    const category = ['todo', 'in_progress', 'done'].includes(data.category) ? data.category : 'in_progress';
    const color = data.color || '#3b82f6';
    const isDone = data.isDone ? 1 : (category === 'done' ? 1 : 0);

    const maxPosRow = db.getOne(
      'SELECT MAX(position) as max_pos FROM project_statuses WHERE project_id = ?',
      [proj.id]
    );
    const position = (maxPosRow && maxPosRow.max_pos !== null) ? maxPosRow.max_pos + 1 : 0;
    const id = `stat_${crypto.randomUUID().slice(0, 8)}`;

    db.execute(
      `INSERT INTO project_statuses (id, project_id, name, category, color, position, is_default, is_done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, proj.id, name, category, color, position, data.isDefault ? 1 : 0, isDone]
    );

    logAction({
      actor: user,
      action: 'CREATE_PROJECT_STATUS',
      entityType: 'project_status',
      entityId: id,
      newValues: { name, category, color, position, project: proj.key },
      ip
    });

    return db.getOne('SELECT * FROM project_statuses WHERE id = ?', [id]);
  }

  updateStatuses(projectKeyOrId, statusesArray, user = 'System', ip = '127.0.0.1') {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) throw new Error(`Proyecto no encontrado: ${projectKeyOrId}`);
    if (!Array.isArray(statusesArray)) throw new Error('Se requiere un array de estados.');

    db.transaction(() => {
      statusesArray.forEach((st, idx) => {
        if (!st.id) return;
        db.execute(
          `UPDATE project_statuses
           SET name = COALESCE(?, name),
               category = COALESCE(?, category),
               color = COALESCE(?, color),
               position = ?,
               is_default = COALESCE(?, is_default),
               is_done = COALESCE(?, is_done)
           WHERE id = ? AND project_id = ?`,
          [
            st.name ? st.name.trim() : null,
            st.category || null,
            st.color || null,
            idx,
            typeof st.is_default !== 'undefined' ? (st.is_default ? 1 : 0) : null,
            typeof st.is_done !== 'undefined' ? (st.is_done ? 1 : 0) : null,
            st.id,
            proj.id
          ]
        );
      });
    });

    logAction({
      actor: user,
      action: 'UPDATE_PROJECT_WORKFLOW',
      entityType: 'project',
      entityId: proj.key,
      newValues: { totalStatuses: statusesArray.length },
      ip
    });

    return this.getStatuses(proj.id);
  }

  deleteStatus(projectKeyOrId, statusId, user = 'System', ip = '127.0.0.1') {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) throw new Error(`Proyecto no encontrado: ${projectKeyOrId}`);

    const existing = db.getOne('SELECT * FROM project_statuses WHERE id = ? AND project_id = ?', [statusId, proj.id]);
    if (!existing) throw new Error('Estado no encontrado.');

    // Verificar si hay tareas en este estado
    const taskCount = db.getOne('SELECT COUNT(*) as c FROM project_tasks WHERE status_id = ?', [statusId]);
    if (taskCount && taskCount.c > 0) {
      // Reasignar al estado por defecto
      const def = db.getOne('SELECT id FROM project_statuses WHERE project_id = ? AND is_default = 1', [proj.id])
        || db.getOne('SELECT id FROM project_statuses WHERE project_id = ? AND id != ? LIMIT 1', [proj.id, statusId]);
      if (def) {
        db.execute('UPDATE project_tasks SET status_id = ? WHERE status_id = ?', [def.id, statusId]);
      } else {
        throw new Error('No se puede eliminar el único estado de un proyecto con tareas.');
      }
    }

    db.execute('DELETE FROM project_statuses WHERE id = ?', [statusId]);

    logAction({
      actor: user,
      action: 'DELETE_PROJECT_STATUS',
      entityType: 'project_status',
      entityId: statusId,
      oldValues: existing,
      ip
    });

    return { success: true, deletedId: statusId };
  }

  /* =========================================================================
     SPRINTS
     ========================================================================= */

  listSprints(projectKeyOrId) {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) return [];

    const sprints = db.query(
      `SELECT * FROM sprints WHERE project_id = ? ORDER BY 
       CASE status WHEN 'ACTIVE' THEN 1 WHEN 'PLANNED' THEN 2 ELSE 3 END, 
       created_at DESC`,
      [proj.id]
    );

    // Enriquecer cada sprint con métricas de tareas
    return sprints.map(s => {
      const stats = db.getOne(
        `SELECT 
           COUNT(*) as total_tasks,
           SUM(CASE WHEN ps.is_done = 1 THEN 1 ELSE 0 END) as done_tasks,
           COALESCE(SUM(pt.story_points), 0) as total_points,
           COALESCE(SUM(CASE WHEN ps.is_done = 1 THEN pt.story_points ELSE 0 END), 0) as done_points,
           COALESCE(SUM(pt.estimate_hours), 0) as total_estimate_hours,
           COALESCE(SUM(pt.logged_hours), 0) as total_logged_hours
         FROM project_tasks pt
         LEFT JOIN project_statuses ps ON pt.status_id = ps.id
         WHERE pt.sprint_id = ?`,
        [s.id]
      );

      return {
        ...s,
        stats: {
          totalTasks: stats ? stats.total_tasks : 0,
          doneTasks: stats ? stats.done_tasks : 0,
          totalPoints: stats ? stats.total_points : 0,
          donePoints: stats ? stats.done_points : 0,
          totalEstimateHours: stats ? stats.total_estimate_hours : 0,
          totalLoggedHours: stats ? stats.total_logged_hours : 0,
        }
      };
    });
  }

  getSprint(sprintId) {
    const sprint = db.getOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
    if (!sprint) return null;
    return sprint;
  }

  createSprint(projectKeyOrId, data, user = 'System', ip = '127.0.0.1') {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) throw new Error(`Proyecto no encontrado: ${projectKeyOrId}`);

    const name = (data.name || '').trim();
    if (!name) throw new Error('El nombre del sprint es obligatorio.');

    const id = `spr_${crypto.randomUUID().slice(0, 8)}`;
    const goal = data.goal || null;
    const startDate = data.startDate || data.start_date || null;
    const endDate = data.endDate || data.end_date || null;

    db.execute(
      `INSERT INTO sprints (id, project_id, name, goal, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'PLANNED', ?)`,
      [id, proj.id, name, goal, startDate, endDate, user]
    );

    logAction({
      actor: user,
      action: 'CREATE_SPRINT',
      entityType: 'sprint',
      entityId: id,
      newValues: { name, goal, startDate, endDate, project: proj.key },
      ip
    });

    return db.getOne('SELECT * FROM sprints WHERE id = ?', [id]);
  }

  updateSprint(sprintId, data, user = 'System', ip = '127.0.0.1') {
    const existing = db.getOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
    if (!existing) throw new Error('Sprint no encontrado.');

    const name = typeof data.name !== 'undefined' ? data.name.trim() : existing.name;
    const goal = typeof data.goal !== 'undefined' ? data.goal : existing.goal;
    const startDate = typeof data.startDate !== 'undefined' ? data.startDate : (data.start_date || existing.start_date);
    const endDate = typeof data.endDate !== 'undefined' ? data.endDate : (data.end_date || existing.end_date);

    db.execute(
      `UPDATE sprints
       SET name = ?, goal = ?, start_date = ?, end_date = ?, updated_at = (datetime('now'))
       WHERE id = ?`,
      [name, goal, startDate, endDate, sprintId]
    );

    logAction({
      actor: user,
      action: 'UPDATE_SPRINT',
      entityType: 'sprint',
      entityId: sprintId,
      oldValues: existing,
      newValues: { name, goal, startDate, endDate },
      ip
    });

    return db.getOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
  }

  startSprint(sprintId, data = {}, user = 'System', ip = '127.0.0.1') {
    const existing = db.getOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
    if (!existing) throw new Error('Sprint no encontrado.');

    const startDate = data.startDate || data.start_date || todayLocal();
    const endDate = data.endDate || data.end_date || existing.end_date;

    db.execute(
      `UPDATE sprints
       SET status = 'ACTIVE', start_date = ?, end_date = ?, updated_at = (datetime('now'))
       WHERE id = ?`,
      [startDate, endDate, sprintId]
    );

    logAction({
      actor: user,
      action: 'START_SPRINT',
      entityType: 'sprint',
      entityId: sprintId,
      newValues: { status: 'ACTIVE', startDate, endDate },
      ip
    });

    return db.getOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
  }

  completeSprint(sprintId, data = {}, user = 'System', ip = '127.0.0.1') {
    const existing = db.getOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
    if (!existing) throw new Error('Sprint no encontrado.');

    const completedAt = new Date().toISOString();
    const moveRemainingTo = data.moveRemainingTo || 'backlog'; // 'backlog' o sprintId destino

    db.transaction(() => {
      // 1. Marcar sprint como cerrado
      db.execute(
        `UPDATE sprints
         SET status = 'CLOSED', completed_at = ?, updated_at = (datetime('now'))
         WHERE id = ?`,
        [completedAt, sprintId]
      );

      // 2. Mover tareas no completadas
      const targetSprintId = moveRemainingTo === 'backlog' ? null : moveRemainingTo;
      db.execute(
        `UPDATE project_tasks
         SET sprint_id = ?, updated_at = (datetime('now'))
         WHERE sprint_id = ? AND status_id IN (
           SELECT id FROM project_statuses WHERE is_done = 0
         )`,
        [targetSprintId, sprintId]
      );
    });

    logAction({
      actor: user,
      action: 'COMPLETE_SPRINT',
      entityType: 'sprint',
      entityId: sprintId,
      newValues: { status: 'CLOSED', moveRemainingTo },
      ip
    });

    return db.getOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
  }

  deleteSprint(sprintId, user = 'System', ip = '127.0.0.1') {
    const existing = db.getOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
    if (!existing) throw new Error('Sprint no encontrado.');

    db.transaction(() => {
      // Mover tareas asociadas al backlog
      db.execute('UPDATE project_tasks SET sprint_id = NULL WHERE sprint_id = ?', [sprintId]);
      db.execute('DELETE FROM sprints WHERE id = ?', [sprintId]);
    });

    logAction({
      actor: user,
      action: 'DELETE_SPRINT',
      entityType: 'sprint',
      entityId: sprintId,
      oldValues: existing,
      ip
    });

    return { success: true, deletedId: sprintId };
  }

  /* =========================================================================
     TAREAS NATIVAS (PROJECT_TASKS)
     ========================================================================= */

  /**
   * Generar la siguiente clave secuencial para un proyecto (ej: 'CORE-15')
   */
  getNextTaskKey(projectKey) {
    const cleanKey = String(projectKey).trim().toUpperCase();
    const tasks = db.query(
      `SELECT task_key FROM project_tasks WHERE task_key LIKE ?`,
      [`${cleanKey}-%`]
    );

    let maxNum = 0;
    tasks.forEach(t => {
      const parts = t.task_key.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    return `${cleanKey}-${maxNum + 1}`;
  }

  listTasks(projectKeyOrId, filters = {}) {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) return [];

    let sql = `
      SELECT pt.*,
             ps.name as status_name,
             ps.category as status_category,
             ps.color as status_color,
             ps.is_done as status_is_done, ps.qa_step as status_qa_step,
             s.name as sprint_name,
             s.status as sprint_status
      FROM project_tasks pt
      LEFT JOIN project_statuses ps ON pt.status_id = ps.id
      LEFT JOIN sprints s ON pt.sprint_id = s.id
      WHERE pt.project_id = ?
    `;
    const params = [proj.id];

    if (filters.sprintId) {
      sql += ' AND pt.sprint_id = ?';
      params.push(filters.sprintId);
    } else if (filters.inBacklog === true || filters.inBacklog === 'true') {
      sql += ' AND pt.sprint_id IS NULL';
    }

    if (filters.statusId) {
      sql += ' AND pt.status_id = ?';
      params.push(filters.statusId);
    }

    if (filters.assigneeId) {
      sql += ' AND (pt.assignee_id = ? OR pt.assignee_name LIKE ?)';
      params.push(filters.assigneeId, `%${filters.assigneeId}%`);
    }

    if (filters.query) {
      sql += ' AND (pt.task_key LIKE ? OR pt.title LIKE ? OR pt.description LIKE ?)';
      const q = `%${filters.query.trim()}%`;
      params.push(q, q, q);
    }

    // order_index is the manual board order: a new task gets MAX + 1, so it always lands LAST. That is right
    // for a kanban column someone arranged by hand, and wrong for a list you scan to find what you just created.
    sql += filters.sort === 'recent'
      ? ' ORDER BY pt.created_at DESC'
      : ' ORDER BY pt.order_index ASC, pt.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(Number(filters.limit));
    }

    return this.withSubtaskInfo(db.query(sql, params));
  }

  /**
   * Subtasks: adds to each task its parent (parent_key / parent_title) and, for a parent, the roll-up of its
   * subtasks (subtask_count, subtask_done, subtask_logged_hours). One query per project involved.
   */
  withSubtaskInfo(rows) {
    if (!Array.isArray(rows) || !rows.length) return rows;
    const projects = [...new Set(rows.map((r) => r.project_id).filter(Boolean))];
    const all = [];
    for (const pid of projects) {
      all.push(...db.query(
        `SELECT pt.id, pt.task_key, pt.title, pt.parent_id, pt.logged_hours, ps.is_done as status_is_done, ps.qa_step as status_qa_step
         FROM project_tasks pt LEFT JOIN project_statuses ps ON pt.status_id = ps.id WHERE pt.project_id = ?`, [pid]
      ));
    }
    const byId = new Map(all.map((t) => [t.id, t]));
    const kids = new Map();
    for (const t of all) if (t.parent_id) { if (!kids.has(t.parent_id)) kids.set(t.parent_id, []); kids.get(t.parent_id).push(t); }
    return rows.map((r) => {
      const parent = r.parent_id ? byId.get(r.parent_id) : null;
      const list = kids.get(r.id) || [];
      return {
        ...r,
        // "Tarea propia": the assignee created it for themselves (an employee, not the PM / admin planning the work)
        self_created: isSelfCreated(r),
        creator_name: r.reporter_name || null,
        parent_key: parent ? parent.task_key : null,
        parent_title: parent ? parent.title : null,
        subtask_count: list.length,
        subtask_done: list.filter((k) => Number(k.status_is_done) === 1).length,
        subtask_logged_hours: Math.round(list.reduce((s, k) => s + (Number(k.logged_hours) || 0), 0) * 100) / 100,
      };
    });
  }

  /**
   * "Mis tareas": every task and subtask assigned to an employee, in the projects they belong to, with the sprints
   * those tasks are in (for the sprint filter). Newest sprint first; backlog tasks have no sprint.
   */
  myTasks(employeeId, { allProjects = false } = {}) {
    if (!employeeId) return { tasks: [], sprints: [], qaQueue: [] };
    const projects = allProjects ? db.query('SELECT * FROM jira_projects') : this.projectsForEmployee(employeeId);
    const allowed = new Set(projects.map((p) => p.id));
    const byProject = new Map(projects.map((p) => [p.id, p]));
    const tasks = db.query(
      `SELECT pt.*, ps.name as status_name, ps.category as status_category, ps.color as status_color, ps.is_done as status_is_done, ps.qa_step as status_qa_step,
              s.name as sprint_name, s.status as sprint_status
       FROM project_tasks pt
       LEFT JOIN project_statuses ps ON pt.status_id = ps.id
       LEFT JOIN sprints s ON pt.sprint_id = s.id
       WHERE pt.assignee_id = ?`, [employeeId]
    ).filter((t) => allowed.has(t.project_id))
      .map((t) => ({ ...t, project_key: (byProject.get(t.project_id) || {}).key, project_name: (byProject.get(t.project_id) || {}).name }));
    const sprintIds = [...new Set(tasks.map((t) => t.sprint_id).filter(Boolean))];
    const sprints = sprintIds.map((id) => db.getOne('SELECT * FROM sprints WHERE id = ?', [id])).filter(Boolean)
      .map((s) => ({ id: s.id, name: s.name, status: s.status, startDate: s.start_date, endDate: s.end_date, projectKey: (byProject.get(s.project_id) || {}).key }))
      .sort((a, b) => (a.status === 'ACTIVE' ? -1 : 0) - (b.status === 'ACTIVE' ? -1 : 0) || String(b.startDate || '').localeCompare(String(a.startDate || '')));
    // QA queue: other people's tasks in "Listo para QA" in the same projects (nobody reviews their own)
    const readyIds = db.query(`SELECT id, project_id FROM project_statuses WHERE qa_step = 'ready'`)
      .filter((s) => allowed.has(s.project_id)).map((s) => s.id);
    const qaQueue = readyIds.flatMap((sid) => db.query(
      `SELECT pt.*, ps.name as status_name, ps.category as status_category, ps.color as status_color, ps.is_done as status_is_done, ps.qa_step as status_qa_step,
              s.name as sprint_name, s.status as sprint_status
       FROM project_tasks pt
       LEFT JOIN project_statuses ps ON pt.status_id = ps.id
       LEFT JOIN sprints s ON pt.sprint_id = s.id
       WHERE pt.status_id = ?`, [sid]))
      .filter((t) => t.assignee_id !== employeeId)
      .map((t) => ({ ...t, project_key: (byProject.get(t.project_id) || {}).key, project_name: (byProject.get(t.project_id) || {}).name }))
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')));
    return { tasks: this.withSubtaskInfo(tasks), sprints, qaQueue: this.withSubtaskInfo(qaQueue) };
  }

  /**
   * "Terminé" / reopen from #mytasks. done: the assignee's task goes to "Listo para QA" when the project has a QA
   * workflow (PM/admin and projects without QA: the first "done" status); reopen: the project's default status.
   */
  completeTask(taskId, done, user = 'System', ip = '127.0.0.1', actor = {}) {
    const task = this.getTask(taskId);
    if (!task) throw Object.assign(new Error('Tarea no encontrada.'), { status: 404 });
    const qa = this.qaStatuses(task.project_id);
    const statuses = qa.all;
    const isAssignee = Boolean(task.assignee_id && actor.employeeId && task.assignee_id === actor.employeeId);
    // PM / admin close their own tasks directly (they may still drag them to "Listo para QA" on the board)
    const toQa = done && qa.ready && isAssignee && !['admin', 'pm'].includes(String(actor.role || '').toLowerCase());
    const target = toQa ? qa.ready
      : done ? qa.done
        : statuses.find((s) => Number(s.is_default) === 1 && Number(s.is_done) !== 1) || statuses.find((s) => s.category === 'todo') || statuses.find((s) => Number(s.is_done) !== 1);
    if (!target) throw Object.assign(new Error('El proyecto no tiene un estado para esto: pide al PM que lo configure.'), { status: 409 });
    if (target.id === task.status_id) return task;
    this.checkStatusChange(task, target.id, actor);
    return this.updateTask(task.id, { statusId: target.id }, user, ip);
  }

  /** Subtasks of a task, in key order */
  listSubtasks(taskIdOrKey) {
    const task = this.getTask(taskIdOrKey);
    if (!task) return [];
    return db.query(
      `SELECT pt.*, ps.name as status_name, ps.category as status_category, ps.color as status_color, ps.is_done as status_is_done, ps.qa_step as status_qa_step
       FROM project_tasks pt LEFT JOIN project_statuses ps ON pt.status_id = ps.id WHERE pt.parent_id = ?`, [task.id]
    ).sort((a, b) => String(a.task_key).localeCompare(String(b.task_key), undefined, { numeric: true }));
  }

  getTask(taskIdOrKey) {
    if (!taskIdOrKey) return null;
    const clean = String(taskIdOrKey).trim();
    const row = db.getOne(
      `SELECT pt.*,
              ps.name as status_name,
              ps.category as status_category,
              ps.color as status_color,
              ps.is_done as status_is_done, ps.qa_step as status_qa_step,
              s.name as sprint_name,
              s.status as sprint_status
       FROM project_tasks pt
       LEFT JOIN project_statuses ps ON pt.status_id = ps.id
       LEFT JOIN sprints s ON pt.sprint_id = s.id
       WHERE pt.id = ? OR UPPER(pt.task_key) = ?`,
      [clean, clean.toUpperCase()]
    );
    return row ? this.withSubtaskInfo([row])[0] : row;
  }

  // creator: { employeeId, role } of the signed-in user (routes pass req.user); recorded to tell PM-planned work from
  // a task the employee added for themselves
  createTask(projectKeyOrId, data, user = 'System', ip = '127.0.0.1', creator = {}) {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) throw new Error(`Proyecto no encontrado: ${projectKeyOrId}`);

    const title = (data.title || '').trim();
    if (!title) throw new Error('El título de la tarea es obligatorio.');

    // Asegurar estados
    const statuses = this.ensureDefaultStatuses(proj.id);
    let statusId = data.status_id || data.statusId;
    if (!statusId) {
      const def = statuses.find(s => s.is_default === 1) || statuses[0];
      statusId = def ? def.id : null;
    }

    // Subtask: the parent must be a task of this project that is not itself a subtask; it shares the parent's sprint
    const parentRef = data.parent_id || data.parentId || data.parent_key || data.parentKey || null;
    const parent = parentRef ? this.getTask(parentRef) : null;
    const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
    if (parentRef && !parent) throw bad(`No existe la tarea padre ${parentRef}.`);
    if (parent && parent.project_id !== proj.id) throw bad('Una subtarea debe estar en el mismo proyecto que su tarea padre.');
    if (parent && parent.parent_id) throw bad(`${parent.task_key} ya es una subtarea: las subtareas no pueden tener subtareas.`);

    const taskKey = this.getNextTaskKey(proj.key);
    const id = `tsk_${crypto.randomUUID().slice(0, 8)}`;
    const sprintId = parent ? parent.sprint_id || null : data.sprint_id || data.sprintId || null;
    const taskType = data.task_type || data.taskType || (parent ? 'Subtask' : 'Task');
    const priority = data.priority || 'Medium';
    const estimateHours = Number(data.estimate_hours || data.estimateHours) || 0;
    const storyPoints = parseInt(data.story_points || data.storyPoints, 10) || 0;
    const description = data.description || '';
    const originJiraKey = data.origin_jira_key || data.originJiraKey || null;
    const originJiraUrl = data.origin_jira_url || data.originJiraUrl || null;
    const labels = Array.isArray(data.labels) ? JSON.stringify(data.labels) : (typeof data.labels === 'string' ? data.labels : null);

    // Assignee is an employee (id), so "my tasks" can be found reliably; free text only if no employee matches
    const resolved = this.resolveAssignee(data);
    let assigneeId = resolved ? resolved.id : null;
    let assigneeName = resolved ? resolved.name : (data.assignee_name || data.assigneeName || null);
    let assigneeAvatar = resolved ? resolved.avatar : null;

    // Calcular order_index
    const maxOrder = db.getOne(
      'SELECT MAX(order_index) as m FROM project_tasks WHERE project_id = ? AND sprint_id IS ?',
      [proj.id, sprintId]
    );
    const orderIndex = (maxOrder && maxOrder.m !== null) ? maxOrder.m + 1 : 0;

    db.execute(
      `INSERT INTO project_tasks (
         id, task_key, project_id, sprint_id, status_id, title, description,
         task_type, priority, estimate_hours, story_points,
         assignee_id, assignee_name, assignee_avatar,
         reporter_id, reporter_name, order_index,
         origin_jira_key, origin_jira_url, labels,
         created_at, updated_at, parent_id, creator_employee_id, creator_role
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, taskKey, proj.id, sprintId, statusId, title, description,
        taskType, priority, estimateHours, storyPoints,
        assigneeId, assigneeName, assigneeAvatar,
        user, user, orderIndex,
        originJiraKey, originJiraUrl, labels,
        // `DEFAULT (datetime('now'))` is a SQLite clause: initSchema() never runs on Firestore, so there the
        // column simply stayed empty and anything that ordered or filtered by it read a blank.
        nowStamp(), nowStamp(), parent ? parent.id : null,
        (creator && creator.employeeId) || null, (creator && creator.role) || null
      ]
    );

    logAction({
      actor: user,
      action: 'CREATE_TASK',
      entityType: 'task',
      entityId: taskKey,
      newValues: { taskKey, title, project: proj.key, sprintId, statusId, parent: parent ? parent.task_key : null },
      ip
    });

    return this.getTask(id);
  }

  updateTask(taskId, data, user = 'System', ip = '127.0.0.1') {
    const existing = this.getTask(taskId);
    if (!existing) throw new Error('Tarea no encontrada.');

    const title = typeof data.title !== 'undefined' ? data.title.trim() : existing.title;
    const description = typeof data.description !== 'undefined' ? data.description : existing.description;
    const taskType = typeof data.task_type !== 'undefined' ? data.task_type : (data.taskType || existing.task_type);
    const priority = typeof data.priority !== 'undefined' ? data.priority : existing.priority;
    const estimateHours = typeof data.estimate_hours !== 'undefined' ? Number(data.estimate_hours) : (typeof data.estimateHours !== 'undefined' ? Number(data.estimateHours) : existing.estimate_hours);
    const storyPoints = typeof data.story_points !== 'undefined' ? parseInt(data.story_points, 10) : (typeof data.storyPoints !== 'undefined' ? parseInt(data.storyPoints, 10) : existing.story_points);
    let sprintId = typeof data.sprint_id !== 'undefined' ? data.sprint_id : (typeof data.sprintId !== 'undefined' ? data.sprintId : existing.sprint_id);
    if (existing.parent_id) {
      // A subtask always lives in its parent's sprint
      const parent = db.getOne('SELECT sprint_id FROM project_tasks WHERE id = ?', [existing.parent_id]);
      if (parent) sprintId = parent.sprint_id || null;
    }
    const statusId = typeof data.status_id !== 'undefined' ? data.status_id : (typeof data.statusId !== 'undefined' ? data.statusId : existing.status_id);
    const orderIndex = typeof data.order_index !== 'undefined' ? Number(data.order_index) : (typeof data.orderIndex !== 'undefined' ? Number(data.orderIndex) : existing.order_index);
    const loggedHours = typeof data.logged_hours !== 'undefined' ? Number(data.logged_hours) : (typeof data.loggedHours !== 'undefined' ? Number(data.loggedHours) : existing.logged_hours);

    let assigneeId = existing.assignee_id, assigneeName = existing.assignee_name, assigneeAvatar = existing.assignee_avatar;
    const assigneeGiven = ['assignee_id', 'assigneeId', 'assignee_name', 'assigneeName'].some((k) => typeof data[k] !== 'undefined');
    if (assigneeGiven) {
      const cleared = [data.assignee_id, data.assigneeId, data.assignee_name, data.assigneeName].every((v) => v === null || v === '' || typeof v === 'undefined');
      const resolved = cleared ? null : this.resolveAssignee(data);
      assigneeId = resolved ? resolved.id : null;
      assigneeName = resolved ? resolved.name : (cleared ? null : (data.assignee_name || data.assigneeName || null));
      assigneeAvatar = resolved ? resolved.avatar : null;
    }

    db.execute(
      `UPDATE project_tasks
       SET title = ?, description = ?, task_type = ?, priority = ?,
           estimate_hours = ?, story_points = ?, sprint_id = ?, status_id = ?,
           order_index = ?, logged_hours = ?,
           assignee_id = ?, assignee_name = ?, assignee_avatar = ?,
           updated_at = (datetime('now'))
       WHERE id = ?`,
      [
        title, description, taskType, priority,
        estimateHours, storyPoints, sprintId, statusId,
        orderIndex, loggedHours,
        assigneeId, assigneeName, assigneeAvatar,
        existing.id
      ]
    );
    // QA review: "Bug encontrado" keeps the note for whoever did the task; completing a task under review records who
    // checked it. The last QA note stays on the task (shown while it is in "Bug encontrado").
    if (statusId && statusId !== existing.status_id) {
      const target = db.getOne('SELECT qa_step, is_done FROM project_statuses WHERE id = ?', [statusId]);
      const from = db.getOne('SELECT qa_step FROM project_statuses WHERE id = ?', [existing.status_id]);
      const note = String(data.qaNote || data.qa_note || '').trim();
      if (target && (target.qa_step === 'bug' || (Number(target.is_done) === 1 && from && from.qa_step === 'ready'))) {
        db.execute('UPDATE project_tasks SET qa_note = ?, qa_by = ?, qa_at = ?, qa_result = ? WHERE id = ?',
          [note || (target.qa_step === 'bug' ? existing.qa_note || null : null), user, nowStamp(), target.qa_step === 'bug' ? 'bug' : 'passed', existing.id]);
      }
    }
    // Moving a parent to another sprint (or the backlog) takes its subtasks along
    if ((sprintId || null) !== (existing.sprint_id || null)) {
      for (const k of db.query('SELECT id FROM project_tasks WHERE parent_id = ?', [existing.id])) {
        db.execute('UPDATE project_tasks SET sprint_id = ? WHERE id = ?', [sprintId || null, k.id]);
      }
    }

    logAction({
      actor: user,
      action: 'UPDATE_TASK',
      entityType: 'task',
      entityId: existing.task_key,
      oldValues: existing,
      newValues: { title, sprintId, statusId, assigneeName },
      ip
    });

    return this.getTask(existing.id);
  }

  moveTask(taskId, moveData, user = 'System', ip = '127.0.0.1') {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Tarea no encontrada.');

    const patch = {};
    if (typeof moveData.statusId !== 'undefined') patch.statusId = moveData.statusId;
    if (typeof moveData.status_id !== 'undefined') patch.statusId = moveData.status_id;
    if (typeof moveData.sprintId !== 'undefined') patch.sprintId = moveData.sprintId;
    if (typeof moveData.sprint_id !== 'undefined') patch.sprintId = moveData.sprint_id;
    if (typeof moveData.orderIndex !== 'undefined') patch.orderIndex = moveData.orderIndex;
    if (moveData.qaNote || moveData.qa_note) patch.qaNote = moveData.qaNote || moveData.qa_note;

    return this.updateTask(task.id, patch, user, ip);
  }

  deleteTask(taskId, user = 'System', ip = '127.0.0.1') {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Tarea no encontrada.');

    // Its subtasks go with it
    const subtasks = db.query('SELECT id, task_key FROM project_tasks WHERE parent_id = ?', [task.id]);
    for (const k of subtasks) db.execute('DELETE FROM project_tasks WHERE id = ?', [k.id]);
    db.execute('DELETE FROM project_tasks WHERE id = ?', [task.id]);

    logAction({
      actor: user,
      action: 'DELETE_TASK',
      entityType: 'task',
      entityId: task.task_key,
      oldValues: task,
      ip
    });

    return { success: true, deletedKey: task.task_key, deletedSubtasks: subtasks.map((k) => k.task_key) };
  }

  /**
   * Búsqueda unificada de tareas para DailyActivities, Backlogs y Autocompletado
   */
  searchAllTasks({ query = '', projectKey = null, assigneeId = null, limit = 15, projectIds = null } = {}) {
    // projectIds: restrict to these projects (membership scope); filtered in JS so the adapters stay simple
    if (Array.isArray(projectIds)) {
      const allowed = new Set(projectIds);
      return this.searchAllTasks({ query, projectKey, assigneeId, limit: 1000 })
        .filter((t) => allowed.has(t.project_id))
        .slice(0, Number(limit) || 15);
    }
    let sql = `
      SELECT pt.*,
             jp.name as project_name,
             jp.key as project_key,
             ps.name as status_name,
             ps.category as status_category,
             ps.color as status_color,
             s.name as sprint_name
      FROM project_tasks pt
      JOIN jira_projects jp ON pt.project_id = jp.id
      LEFT JOIN project_statuses ps ON pt.status_id = ps.id
      LEFT JOIN sprints s ON pt.sprint_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (projectKey) {
      sql += ' AND UPPER(jp.key) = ?';
      params.push(projectKey.toUpperCase());
    }

    if (assigneeId) {
      sql += ' AND (pt.assignee_id = ? OR pt.assignee_name LIKE ?)';
      params.push(assigneeId, `%${assigneeId}%`);
    }

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      sql += ' AND (pt.task_key LIKE ? OR pt.title LIKE ? OR pt.origin_jira_key LIKE ?)';
      params.push(q, q, q);
    }

    // Newest first by creation date, which every row has. updated_at is only written by an UPDATE, so a task
    // nobody had touched yet carried none and sorted last -- exactly the task you just made and came to find.
    sql += ' ORDER BY pt.created_at DESC LIMIT ?';
    params.push(Number(limit) || 15);

    return this.withSubtaskInfo(db.query(sql, params));
  }

  /* =========================================================================
     CLONADOR JIRA LEGACY A NATIVO (FASE 2.3)
     ========================================================================= */

  async cloneJiraIssue({ jiraKey, targetProjectKey, sprintId = null, statusId = null }, user = 'System', ip = '127.0.0.1') {
    if (!jiraKey) throw new Error('Se requiere la clave del ticket de Jira (ej: MSH-214).');
    const cleanJiraKey = jiraKey.trim().toUpperCase();

    // 1. Resolver proyecto destino
    const targetProj = this.resolveProject(targetProjectKey || cleanJiraKey.split('-')[0]);
    if (!targetProj) {
      throw new Error(`Proyecto destino no encontrado: ${targetProjectKey}`);
    }

    // 2. Buscar datos originales en caché de Jira o intentar conexión
    let jiraIssue = db.getOne('SELECT * FROM jira_issues_cache WHERE UPPER(key) = ?', [cleanJiraKey]);
    if (!jiraIssue) {
      // Intentar buscar en la caché local de Jira
      const fallback = jiraService.searchIssues({ query: cleanJiraKey, limit: 1 });
      if (fallback && fallback.length > 0 && fallback[0].key.toUpperCase() === cleanJiraKey) {
        jiraIssue = fallback[0];
      }
    }

    const title = jiraIssue ? jiraIssue.summary : `Imported Jira Issue: ${cleanJiraKey}`;
    const desc = jiraIssue && jiraIssue.description
      ? jiraIssue.description
      : `Ticket clonado desde Jira Legacy (${cleanJiraKey}).`;
    // Only a real Jira estimate is copied; without one the task starts unestimated (0)
    const estimateHours = jiraIssue ? Number(jiraIssue.estimate_hours ?? jiraIssue.estimate) || 0 : 0;
    const jiraUrl = jiraIssue && jiraIssue.url ? jiraIssue.url : `https://myglobalhub.atlassian.net/browse/${cleanJiraKey}`;
    const assigneeName = jiraIssue ? (jiraIssue.assignee_name || jiraIssue.assignee) : null;
    const assigneeAvatar = jiraIssue ? jiraIssue.assignee_avatar : null;
    const taskType = jiraIssue ? (jiraIssue.issue_type || jiraIssue.type || 'Story') : 'Story';

    // 3. Crear la tarea nativa en el proyecto destino
    const task = this.createTask(targetProj.id, {
      title,
      description: desc,
      task_type: taskType,
      priority: 'Medium',
      estimate_hours: estimateHours,
      story_points: estimateHours ? Math.round(estimateHours / 2) || 1 : 0,
      sprint_id: sprintId,
      status_id: statusId,
      assignee_name: assigneeName,
      assignee_avatar: assigneeAvatar,
      origin_jira_key: cleanJiraKey,
      origin_jira_url: jiraUrl,
      labels: ['jira-import', cleanJiraKey]
    }, user, ip);

    logAction({
      actor: user,
      action: 'CLONE_JIRA_ISSUE',
      entityType: 'task',
      entityId: task.task_key,
      newValues: { originJiraKey: cleanJiraKey, targetTaskKey: task.task_key, project: targetProj.key },
      ip
    });

    return {
      success: true,
      clonedFrom: cleanJiraKey,
      task,
    };
  }

  /* =========================================================================
     PROJECT MEMBERS
     Membership is per EMPLOYEE (project_members.user_id = employees.id). An employee whose profile "project"
     names the project (key or name) is also treated as a member, for records created before memberships existed.
     ========================================================================= */

  isMember(projectKeyOrId, employeeId) {
    if (!employeeId) return false;
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) return false;
    if (db.getOne('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [proj.id, employeeId])) return true;
    // Profile "project" may list several ("MSHP — Project Planning, Arawaki"): a token matches when it equals the
    // project key/name or starts with it followed by a separator
    const emp = db.getOne('SELECT project FROM employees WHERE id = ?', [employeeId]);
    const tokens = String((emp && emp.project) || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const names = [String(proj.key).toLowerCase(), String(proj.name).toLowerCase()];
    return tokens.some((t) => names.some((n) => t === n || (t.startsWith(n) && /^[\s—–\-:(]/.test(t.slice(n.length)))));
  }

  projectsForEmployee(employeeId) {
    return db.query('SELECT * FROM jira_projects').filter((p) => this.isMember(p.id, employeeId));
  }

  // Resolve a task assignee to an employee (by id, or by exact name for legacy free-text input)
  resolveAssignee(data) {
    const id = data.assignee_id || data.assigneeId || null;
    const name = data.assignee_name || data.assigneeName || null;
    const emp = id
      ? db.getOne('SELECT id, name, avatar FROM employees WHERE id = ?', [id])
      : name ? db.getOne('SELECT id, name, avatar FROM employees WHERE LOWER(name) = ?', [String(name).trim().toLowerCase()]) : null;
    return emp ? { id: emp.id, name: emp.name, avatar: emp.avatar || null } : null;
  }

  listMembers(projectKeyOrId) {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) return [];

    return db.query(
      `SELECT pm.*, 
              COALESCE(e.avatar, u.avatar) as avatar,
              COALESCE(e.role, u.role) as user_title
       FROM project_members pm
       LEFT JOIN employees e ON pm.user_id = e.id
       LEFT JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = ?
       ORDER BY pm.role DESC, pm.created_at ASC`,
      [proj.id]
    );
  }

  addMember(projectKeyOrId, data, user = 'System', ip = '127.0.0.1') {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) throw new Error(`Proyecto no encontrado: ${projectKeyOrId}`);

    const userId = data.userId || data.user_id || data.employeeId;
    if (!userId) throw new Error('ID de usuario / colaborador obligatorio.');

    const role = ['lead', 'member', 'viewer'].includes(data.role) ? data.role : 'member';

    // Members are employees: the id must exist in the roster
    const emp = db.getOne('SELECT id, name, email FROM employees WHERE id = ?', [userId]);
    if (!emp) {
      const err = new Error(`El empleado ${userId} no existe`);
      err.status = 400;
      throw err;
    }

    // Re-adding updates the role instead of creating a duplicate membership
    const existing = db.getOne('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [proj.id, emp.id]);
    if (existing) {
      db.execute('UPDATE project_members SET role = ?, user_name = ?, user_email = ? WHERE id = ?', [role, emp.name, emp.email || null, existing.id]);
    } else {
      db.execute(
        `INSERT INTO project_members (id, project_id, user_id, user_name, user_email, role)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`pm_${crypto.randomUUID().slice(0, 8)}`, proj.id, emp.id, emp.name, emp.email || null, role]
      );
    }
    const userName = emp.name;

    logAction({
      actor: user,
      action: 'ADD_PROJECT_MEMBER',
      entityType: 'project',
      entityId: proj.key,
      newValues: { userId, userName, role },
      ip
    });

    return db.getOne('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?', [proj.id, userId]);
  }

  removeMember(projectKeyOrId, userId, user = 'System', ip = '127.0.0.1') {
    const proj = this.resolveProject(projectKeyOrId);
    if (!proj) throw new Error(`Proyecto no encontrado: ${projectKeyOrId}`);

    db.execute('DELETE FROM project_members WHERE project_id = ? AND (user_id = ? OR id = ?)', [proj.id, userId, userId]);

    logAction({
      actor: user,
      action: 'REMOVE_PROJECT_MEMBER',
      entityType: 'project',
      entityId: proj.key,
      newValues: { userId },
      ip
    });

    return { success: true, removedUserId: userId };
  }
}

const agileService = new AgileService();
module.exports = agileService;
