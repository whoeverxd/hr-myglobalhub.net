const crypto = require('crypto');
const db = require('../db');
const { logAction } = require('../controllers/audit.controller');
const jiraService = require('./jira.service');

const DEFAULT_STATUS_TEMPLATES = [
  { name: 'To Do', category: 'todo', color: '#64748b', is_default: 1, is_done: 0 },
  { name: 'In Progress', category: 'in_progress', color: '#3b82f6', is_default: 0, is_done: 0 },
  { name: 'Code Review', category: 'in_progress', color: '#8b5cf6', is_default: 0, is_done: 0 },
  { name: 'Done', category: 'done', color: '#10b981', is_default: 0, is_done: 1 },
];

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
          `INSERT INTO project_statuses (id, project_id, name, category, color, position, is_default, is_done)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, proj.id, tmpl.name, tmpl.category, tmpl.color, idx, tmpl.is_default, tmpl.is_done]
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

    const startDate = data.startDate || data.start_date || new Date().toISOString().slice(0, 10);
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
             ps.is_done as status_is_done,
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

    sql += ' ORDER BY pt.order_index ASC, pt.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(Number(filters.limit));
    }

    return db.query(sql, params);
  }

  getTask(taskIdOrKey) {
    if (!taskIdOrKey) return null;
    const clean = String(taskIdOrKey).trim();
    return db.getOne(
      `SELECT pt.*,
              ps.name as status_name,
              ps.category as status_category,
              ps.color as status_color,
              ps.is_done as status_is_done,
              s.name as sprint_name,
              s.status as sprint_status
       FROM project_tasks pt
       LEFT JOIN project_statuses ps ON pt.status_id = ps.id
       LEFT JOIN sprints s ON pt.sprint_id = s.id
       WHERE pt.id = ? OR UPPER(pt.task_key) = ?`,
      [clean, clean.toUpperCase()]
    );
  }

  createTask(projectKeyOrId, data, user = 'System', ip = '127.0.0.1') {
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

    const taskKey = this.getNextTaskKey(proj.key);
    const id = `tsk_${crypto.randomUUID().slice(0, 8)}`;
    const sprintId = data.sprint_id || data.sprintId || null;
    const taskType = data.task_type || data.taskType || 'Task';
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
         origin_jira_key, origin_jira_url, labels
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, taskKey, proj.id, sprintId, statusId, title, description,
        taskType, priority, estimateHours, storyPoints,
        assigneeId, assigneeName, assigneeAvatar,
        user, user, orderIndex,
        originJiraKey, originJiraUrl, labels
      ]
    );

    logAction({
      actor: user,
      action: 'CREATE_TASK',
      entityType: 'task',
      entityId: taskKey,
      newValues: { taskKey, title, project: proj.key, sprintId, statusId },
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
    const sprintId = typeof data.sprint_id !== 'undefined' ? data.sprint_id : (typeof data.sprintId !== 'undefined' ? data.sprintId : existing.sprint_id);
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

    return this.updateTask(task.id, patch, user, ip);
  }

  deleteTask(taskId, user = 'System', ip = '127.0.0.1') {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Tarea no encontrada.');

    db.execute('DELETE FROM project_tasks WHERE id = ?', [task.id]);

    logAction({
      actor: user,
      action: 'DELETE_TASK',
      entityType: 'task',
      entityId: task.task_key,
      oldValues: task,
      ip
    });

    return { success: true, deletedKey: task.task_key };
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

    sql += ' ORDER BY pt.updated_at DESC LIMIT ?';
    params.push(Number(limit) || 15);

    return db.query(sql, params);
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
      // Intentar buscar en DEFAULT_JIRA_ISSUES
      const fallback = jiraService.searchIssues({ query: cleanJiraKey, limit: 1 });
      if (fallback && fallback.length > 0 && fallback[0].key.toUpperCase() === cleanJiraKey) {
        jiraIssue = fallback[0];
      }
    }

    const title = jiraIssue ? jiraIssue.summary : `Imported Jira Issue: ${cleanJiraKey}`;
    const desc = jiraIssue && jiraIssue.description
      ? jiraIssue.description
      : `Ticket clonado desde Jira Legacy (${cleanJiraKey}).`;
    const estimateHours = jiraIssue && jiraIssue.estimate_hours ? jiraIssue.estimate_hours : 4.0;
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
      story_points: Math.round(estimateHours / 2) || 1,
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
