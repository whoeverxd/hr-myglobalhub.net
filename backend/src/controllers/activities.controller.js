const db = require('../db');
const { logAction } = require('./audit.controller');

/**
 * Controller for Daily Activities & Deliverable-based timekeeping
 */

function listActivities({ empId, date, dateFrom, dateTo } = {}) {
  let sql = `SELECT * FROM daily_activities WHERE 1=1`;
  const params = [];

  if (empId) {
    sql += ` AND employee_id = ?`;
    params.push(empId);
  }
  if (date) {
    sql += ` AND date = ?`;
    params.push(date);
  }
  if (dateFrom) {
    sql += ` AND date >= ?`;
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += ` AND date <= ?`;
    params.push(dateTo);
  }

  sql += ` ORDER BY date DESC, created_at DESC`;

  return db.query(sql, params).map((a) => {
    let files = [];
    let links = [];
    try {
      files = JSON.parse(a.evidences_json || '[]');
    } catch (_) {}
    try {
      links = JSON.parse(a.links_json || '[]');
    } catch (_) {}

    return {
      id: a.id,
      empId: a.employee_id,
      date: a.date,
      jiraKey: a.jira_key,
      jiraSummary: a.jira_summary,
      hours: Number(a.hours) || 0,
      workType: a.work_type,
      description: a.description,
      files,
      links,
      createdAt: a.created_at,
    };
  });
}

function createActivity(data, user = 'System', ip = '127.0.0.1') {
  const empId = data.employeeId || data.empId;
  const date = data.date;
  const hours = parseFloat(data.hours);

  if (!empId || !date) {
    const err = new Error('employeeId and date are required');
    err.status = 400;
    throw err;
  }

  if (isNaN(hours) || hours <= 0) {
    const err = new Error('hours must be a positive number');
    err.status = 400;
    throw err;
  }

  const id = data.id || `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const jiraKey = data.jiraKey || data.jira_key || 'GENERAL';
  const jiraSummary = data.jiraSummary || data.jira_summary || data.description?.slice(0, 50) || 'General work';
  const workType = data.workType || data.work_type || 'Desarrollo';
  const description = data.description || '';
  const evidencesJson = JSON.stringify(data.files || data.evidences || []);
  const linksJson = JSON.stringify(data.links || []);

  db.transaction(() => {
    db.execute(
      `INSERT INTO daily_activities (id, employee_id, date, jira_key, jira_summary, hours, work_type, description, evidences_json, links_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, empId, date, jiraKey, jiraSummary, hours, workType, description, evidencesJson, linksJson]
    );

    // Auto-acumular horas trabajadas en la tarea ágil nativa si coincide la clave
    try {
      db.execute(
        `UPDATE project_tasks
         SET logged_hours = COALESCE(logged_hours, 0) + ?,
             updated_at = (datetime('now'))
         WHERE UPPER(task_key) = ?`,
        [hours, jiraKey.toUpperCase()]
      );
    } catch (_) {}

    logAction({
      actor: user,
      action: 'CREATE_ACTIVITY',
      entityType: 'activity',
      entityId: id,
      newValues: { empId, date, jiraKey, hours, workType },
      ip,
    });
  });

  return {
    id,
    empId,
    date,
    jiraKey,
    jiraSummary,
    hours,
    workType,
    description,
    files: data.files || [],
    links: data.links || [],
    createdAt: new Date().toISOString(),
  };
}

function deleteActivity(id, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM daily_activities WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Activity not found');
    err.status = 404;
    throw err;
  }

  db.transaction(() => {
    db.execute(`DELETE FROM daily_activities WHERE id = ?`, [id]);

    // Revertir horas en la tarea ágil nativa si coincide la clave
    try {
      if (current && current.jira_key) {
        db.execute(
          `UPDATE project_tasks
           SET logged_hours = MAX(0, COALESCE(logged_hours, 0) - ?),
               updated_at = (datetime('now'))
           WHERE UPPER(task_key) = ?`,
          [Number(current.hours) || 0, current.jira_key.toUpperCase()]
        );
      }
    } catch (_) {}

    logAction({
      actor: user,
      action: 'DELETE_ACTIVITY',
      entityType: 'activity',
      entityId: id,
      oldValues: current,
      ip,
    });
  });

  return { ok: true, deleted: id };
}

function getActivitySummary(empId, date) {
  const activities = listActivities({ empId, date });
  const totalHours = activities.reduce((sum, a) => sum + a.hours, 0);
  return {
    empId,
    date,
    activityCount: activities.length,
    totalHours: +totalHours.toFixed(2),
    activities,
  };
}

module.exports = {
  listActivities,
  createActivity,
  deleteActivity,
  getActivitySummary,
};
