const db = require('../db');
const { logAction } = require('./audit.controller');
const { periodIdForDate, EDITABLE } = require('./timesheets.controller');

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

  const nameCache = new Map();
  const nameOf = (empId) => {
    if (!empId) return null;
    if (!nameCache.has(empId)) {
      const e = db.getOne('SELECT name FROM employees WHERE id = ?', [empId]);
      nameCache.set(empId, e ? e.name : empId);
    }
    return nameCache.get(empId);
  };

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
      // Reviewer decision (partial approval): approvedHours is what counts for payroll once reviewed
      reviewStatus: a.review_status || 'pending',
      approvedHours: a.approved_hours == null ? null : Number(a.approved_hours),
      reviewComment: a.review_comment || '',
      reviewedBy: a.reviewed_by || null,
      reviewedAt: a.reviewed_at || null,
      meetingId: a.meeting_id || null,
      loggedBy: a.logged_by || null,
      loggedByName: nameOf(a.logged_by),
    };
  });
}

function buildActivity(data) {
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

  return {
    id: data.id || `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    empId,
    date,
    jiraKey: data.jiraKey || data.jira_key || 'GENERAL',
    jiraSummary: data.jiraSummary || data.jira_summary || data.description?.slice(0, 50) || 'General work',
    hours,
    workType: data.workType || data.work_type || 'Desarrollo',
    description: data.description || '',
    files: data.files || data.evidences || [],
    links: data.links || [],
    meetingId: data.meetingId || null,
    loggedBy: data.loggedBy || null,
  };
}

// Inserts one activity; callers wrap it in db.transaction
function insertActivity(a, user, ip) {
  db.execute(
    `INSERT INTO daily_activities (id, employee_id, date, jira_key, jira_summary, hours, work_type, description, evidences_json, links_json, meeting_id, logged_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, a.empId, a.date, a.jiraKey, a.jiraSummary, a.hours, a.workType, a.description, JSON.stringify(a.files), JSON.stringify(a.links), a.meetingId, a.loggedBy]
  );

  // Auto-acumular horas trabajadas en la tarea ágil nativa si coincide la clave
  try {
    db.execute(
      `UPDATE project_tasks
       SET logged_hours = COALESCE(logged_hours, 0) + ?,
           updated_at = (datetime('now'))
       WHERE UPPER(task_key) = ?`,
      [a.hours, a.jiraKey.toUpperCase()]
    );
  } catch (_) {}

  logAction({
    actor: user,
    action: 'CREATE_ACTIVITY',
    entityType: 'activity',
    entityId: a.id,
    newValues: { empId: a.empId, date: a.date, jiraKey: a.jiraKey, hours: a.hours, workType: a.workType, meetingId: a.meetingId, loggedBy: a.loggedBy },
    ip,
  });
}

function toResponse(a) {
  const { files, links, ...rest } = a;
  return { ...rest, files, links, createdAt: new Date().toISOString() };
}

function createActivity(data, user = 'System', ip = '127.0.0.1') {
  const a = buildActivity(data);
  db.transaction(() => insertActivity(a, user, ip));
  return toResponse(a);
}

/**
 * A meeting logged by a PM/supervisor/admin for several attendees: the organizer's activity plus one copy per
 * attendee, all sharing meeting_id. Attendees whose quincena sheet is no longer editable are skipped (never touched).
 * Role and work-type checks happen in the route; the organizer's own sheet check too.
 */
function createMeeting(data, attendeeIds, user = 'System', ip = '127.0.0.1') {
  const organizer = buildActivity(data);
  const ids = [...new Set((attendeeIds || []).map(String))].filter((id) => id && id !== organizer.empId);

  const attendees = ids.map((id) => ({ id, emp: db.getOne('SELECT id, name, status FROM employees WHERE id = ?', [id]) }));
  const invalid = attendees.filter((x) => !x.emp || ['Terminated', 'Inactive'].includes(x.emp.status)).map((x) => x.id);
  if (invalid.length) {
    const err = new Error(`Unknown or inactive attendees: ${invalid.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const meetingId = `MTG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  organizer.meetingId = meetingId;
  const periodId = periodIdForDate(organizer.date);
  const created = [];
  const skipped = [];
  const copies = [];
  for (const { id, emp } of attendees) {
    const ts = db.getOne('SELECT status FROM timesheets WHERE employee_id = ? AND period_id = ?', [id, periodId]);
    if (ts && !EDITABLE.includes(ts.status)) {
      skipped.push({ employeeId: id, name: emp.name, periodId, status: ts.status });
      continue;
    }
    copies.push(buildActivity({ ...data, id: undefined, employeeId: id, empId: id, meetingId, loggedBy: organizer.empId }));
    created.push(id);
  }

  db.transaction(() => {
    insertActivity(organizer, user, ip);
    for (const c of copies) insertActivity(c, user, ip);
  });

  return { ...toResponse(organizer), meeting: { id: meetingId, created, skipped } };
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
  createMeeting,
};
