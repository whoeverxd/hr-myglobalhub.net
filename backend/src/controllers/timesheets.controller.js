const db = require('../db');
const { logAction } = require('./audit.controller');
const { getOrgConfig } = require('./workflows.controller');

function listTimesheets({ periodId, empId } = {}) {
  let sql = `SELECT * FROM timesheets WHERE 1=1`;
  const params = [];

  if (periodId) {
    sql += ` AND period_id = ?`;
    params.push(periodId);
  }
  if (empId) {
    sql += ` AND employee_id = ?`;
    params.push(empId);
  }

  sql += ` ORDER BY period_id DESC, employee_id ASC`;
  let rows = db.query(sql, params);
  if (rows.length === 0 && periodId && !empId) {
    const employees = db.query(`SELECT id, name FROM employees WHERE status != 'Inactive'`);
    for (const emp of employees) {
      ensureTimesheet(emp.id, periodId, emp.name);
    }
    rows = db.query(sql, params);
  }
  return rows.map((t) => ({
    id: t.id,
    emp: t.employee_id,
    name: t.employee_name,
    period: t.period_id,
    status: t.status,
    stepIdx: t.step_index,
    reg: t.regular_hours,
    ot: t.overtime_hours,
    pto: t.pto_hours,
    hol: t.holiday_hours,
    total: t.total_hours,
    history: t.history_json ? JSON.parse(t.history_json) : [],
    submittedAt: t.submitted_at,
    approvedAt: t.approved_at,
  }));
}

function getTimesheet(id) {
  let row = db.getOne(`SELECT * FROM timesheets WHERE id = ? OR (employee_id = ? AND period_id = ?)`, [
    id,
    id.split('_')[0] || id,
    id.split('_')[1] || '',
  ]);
  if (!row) {
    const all = db.query(`SELECT * FROM timesheets`);
    row = all.find((t) => id.includes(t.employee_id) && (id.includes(t.period_id) || id.includes(t.period_id.replace('PP-', ''))));
  }
  if (!row) return null;
  return {
    id: row.id,
    emp: row.employee_id,
    name: row.employee_name,
    period: row.period_id,
    status: row.status,
    stepIdx: row.step_index,
    reg: row.regular_hours,
    ot: row.overtime_hours,
    pto: row.pto_hours,
    hol: row.holiday_hours,
    total: row.total_hours,
    history: row.history_json ? JSON.parse(row.history_json) : [],
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
  };
}

function ensureTimesheet(empId, periodId, defaultName = '') {
  let ts = db.getOne(`SELECT * FROM timesheets WHERE employee_id = ? AND period_id = ?`, [empId, periodId]);
  if (!ts) {
    const id = `TS-${periodId}-${empId}`;
    db.execute(
      `INSERT INTO timesheets (id, employee_id, employee_name, period_id, status, step_index, regular_hours, overtime_hours, pto_hours, holiday_hours, total_hours, history_json)
       VALUES (?, ?, ?, ?, 'Draft', 0, 0, 0, 0, 0, 0, '[]')`,
      [id, empId, defaultName || empId, periodId]
    );
    ts = db.getOne(`SELECT * FROM timesheets WHERE id = ?`, [id]);
  }
  return getTimesheet(ts.id);
}

function submitTimesheet(id, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM timesheets WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Timesheet not found');
    err.status = 404;
    throw err;
  }

  if (current.status !== 'Draft' && current.status !== 'Returned') {
    const err = new Error(`Cannot submit timesheet in status ${current.status}`);
    err.status = 400;
    throw err;
  }

  const history = current.history_json ? JSON.parse(current.history_json) : [];
  const emp = db.getOne(`SELECT entity FROM employees WHERE id = ?`, [current.employee_id]);
  const orgCfg = getOrgConfig(emp ? emp.entity : 'MGH Dominicana SRL');
  const steps = (orgCfg && orgCfg.steps) || [
    { key: 'pm', label: 'Supervisión PM (Joshua)', role: 'pm', review: 'Supervisión PM' },
    { key: 'owner', label: 'Aprobación Dueño & Pago (Edwin)', role: 'admin', review: 'Aprobación Dueño' },
  ];
  const firstStep = steps[0];
  const nextStatus = firstStep ? (firstStep.review || `${firstStep.label} Review` || 'Supervisión PM') : 'Approved';

  history.push({
    at: new Date().toISOString(),
    actor: user,
    role: 'Employee',
    from: current.status,
    to: nextStatus,
    comment: 'Jornada sometida para supervisión del PM (Joshua Hernandez)',
  });

  db.transaction(() => {
    db.execute(
      `UPDATE timesheets
       SET status = ?, step_index = 0, history_json = ?, submitted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
      [nextStatus, JSON.stringify(history), id]
    );

    logAction({
      actor: user,
      action: 'SUBMIT_TIMESHEET',
      entityType: 'timesheet',
      entityId: id,
      newValues: { status: nextStatus, periodId: current.period_id },
      ip,
    });
  });

  return getTimesheet(id);
}

function approveTimesheet(id, { comment = '', role = 'pm' } = {}, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM timesheets WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Timesheet not found');
    err.status = 404;
    throw err;
  }

  // Determine organization workflow steps
  const emp = db.getOne(`SELECT entity FROM employees WHERE id = ?`, [current.employee_id]);
  const orgCfg = getOrgConfig(emp ? emp.entity : 'MGH Dominicana SRL');
  const steps = (orgCfg && orgCfg.steps) || [
    { key: 'pm', label: 'Supervisión PM (Joshua)', role: 'pm', review: 'Supervisión PM' },
    { key: 'owner', label: 'Aprobación Dueño & Pago (Edwin)', role: 'admin', review: 'Aprobación Dueño' },
  ];

  const nextStepIdx = Number(current.step_index || 0) + 1;
  let nextStatus;
  if (nextStepIdx >= steps.length) {
    nextStatus = 'Approved';
  } else {
    const nextStep = steps[nextStepIdx];
    nextStatus = nextStep.review || `${nextStep.label} Review` || `${nextStep.label}`;
  }

  const history = current.history_json ? JSON.parse(current.history_json) : [];
  history.push({
    at: new Date().toISOString(),
    actor: user,
    role,
    from: current.status,
    to: nextStatus,
    comment,
  });

  db.transaction(() => {
    db.execute(
      `UPDATE timesheets
       SET status = ?, step_index = ?, history_json = ?,
           approved_at = case when ? = 'Approved' then datetime('now') else approved_at end,
           updated_at = datetime('now')
       WHERE id = ?`,
      [nextStatus, nextStepIdx, JSON.stringify(history), nextStatus, id]
    );

    logAction({
      actor: user,
      action: 'APPROVE_TIMESHEET',
      entityType: 'timesheet',
      entityId: id,
      oldValues: { status: current.status },
      newValues: { status: nextStatus, stepIdx: nextStepIdx, comment },
      ip,
    });
  });

  return getTimesheet(id);
}

function returnTimesheet(id, { comment } = {}, user = 'System', ip = '127.0.0.1') {
  if (!comment || !comment.trim()) {
    const err = new Error('A reason comment is required when returning a timesheet');
    err.status = 400;
    throw err;
  }

  const current = db.getOne(`SELECT * FROM timesheets WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Timesheet not found');
    err.status = 404;
    throw err;
  }

  const history = current.history_json ? JSON.parse(current.history_json) : [];
  history.push({
    at: new Date().toISOString(),
    actor: user,
    from: current.status,
    to: 'Returned',
    comment,
  });

  db.transaction(() => {
    db.execute(
      `UPDATE timesheets
       SET status = 'Returned', step_index = -1, history_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(history), id]
    );

    logAction({
      actor: user,
      action: 'RETURN_TIMESHEET',
      entityType: 'timesheet',
      entityId: id,
      oldValues: { status: current.status },
      newValues: { status: 'Returned', comment },
      ip,
    });
  });

  return getTimesheet(id);
}

function saveTimesheetHours(id, { reg = 80, ot = 0, pto = 0, hol = 0 }, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM timesheets WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Timesheet not found');
    err.status = 404;
    throw err;
  }

  const total = Number(reg) + Number(ot) + Number(pto) + Number(hol);

  db.transaction(() => {
    db.execute(
      `UPDATE timesheets
       SET regular_hours = ?, overtime_hours = ?, pto_hours = ?, holiday_hours = ?, total_hours = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [Number(reg), Number(ot), Number(pto), Number(hol), total, id]
    );

    logAction({
      actor: user,
      action: 'UPDATE_TIMESHEET_HOURS',
      entityType: 'timesheet',
      entityId: id,
      newValues: { reg, ot, pto, hol, total },
      ip,
    });
  });

  return getTimesheet(id);
}

/**
 * Reconciles reported timesheet hours against detailed daily activities & deliverables
 */
function getTimesheetReconciliation(id) {
  const ts = getTimesheet(id);
  if (!ts) {
    const err = new Error('Timesheet not found');
    err.status = 404;
    throw err;
  }

  // Get period dates
  const period = db.getOne(`SELECT * FROM pay_periods WHERE id = ?`, [ts.period]);
  const startDate = period ? period.start_date : '2025-04-01';
  const endDate = period ? period.end_date : '2025-04-14';

  // Fetch daily activities in date range
  const activities = db.query(
    `SELECT * FROM daily_activities
     WHERE employee_id = ? AND date >= ? AND date <= ?
     ORDER BY date ASC, created_at ASC`,
    [ts.emp, startDate, endDate]
  ).map((a) => {
    let files = [];
    let links = [];
    try { files = JSON.parse(a.evidences_json || '[]'); } catch (_) {}
    try { links = JSON.parse(a.links_json || '[]'); } catch (_) {}
    return {
      id: a.id,
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

  const totalActivityHours = +(activities.reduce((sum, a) => sum + a.hours, 0).toFixed(2));
  const totalTimesheetHours = +(ts.total || 0).toFixed(2);
  const varianceHours = +((totalTimesheetHours - totalActivityHours).toFixed(2));
  const matchPercentage = totalTimesheetHours > 0
    ? Math.min(100, Math.round((totalActivityHours / totalTimesheetHours) * 100))
    : 100;

  // Breakdown by workType
  const byWorkType = {};
  activities.forEach((a) => {
    byWorkType[a.workType] = +((byWorkType[a.workType] || 0) + a.hours).toFixed(2);
  });

  // Calendar days breakdown
  const days = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);

  while (cur <= end) {
    const dStr = cur.toISOString().slice(0, 10);
    const dayActs = activities.filter((a) => a.date === dStr);
    const dayActHrs = +(dayActs.reduce((sum, a) => sum + a.hours, 0).toFixed(2));
    const dayOfWeek = cur.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const punch = db.getOne(`SELECT * FROM attendance_punches WHERE employee_id = ? AND date = ?`, [ts.emp, dStr]);
    const expectedHours = punch ? Number(punch.hours) : 0;

    days.push({
      date: dStr,
      isWeekend,
      expectedHours,
      punch: punch ? {
        id: punch.id,
        clockIn: punch.clock_in,
        lunchOut: punch.lunch_out,
        lunchIn: punch.lunch_in,
        clockOut: punch.clock_out,
        hours: Number(punch.hours) || 0,
        overtime: Number(punch.overtime) || 0,
        mode: punch.mode || 'office',
        note: punch.note || '',
        dayType: punch.day_type || 'Regular'
      } : null,
      activityHours: dayActHrs,
      activitiesCount: dayActs.length,
      hasEvidences: dayActs.some((a) => (a.files && a.files.length > 0) || (a.links && a.links.length > 0)),
      activities: dayActs,
      match: punch ? Math.abs(expectedHours - dayActHrs) < 0.1 : (dayActHrs === 0),
    });
    cur.setDate(cur.getDate() + 1);
  }

  const totalPunchHours = +(days.reduce((sum, d) => sum + (d.punch ? Number(d.punch.hours) || 0 : 0), 0).toFixed(2));
  const totalPunchOvertime = +(days.reduce((sum, d) => sum + (d.punch ? Number(d.punch.overtime) || 0 : 0), 0).toFixed(2));
  const totalPunchRegular = +(totalPunchHours - totalPunchOvertime).toFixed(2);

  const isPmApproved = ts.stepIdx >= 1 || ts.status === 'Owner Approval' || ts.status === 'Approved' || ts.status === 'Paid';
  const isOwnerApproved = ts.status === 'Approved' || ts.status === 'Paid';

  return {
    timesheet: ts,
    period: {
      id: ts.period,
      startDate,
      endDate,
      cutoff: period ? period.cutoff : '',
      payDate: period ? period.pay_date : '',
    },
    reconciliation: {
      totalTimesheetHours,
      totalPunchHours,
      totalPunchRegular,
      totalPunchOvertime,
      totalActivityHours,
      varianceHours,
      matchPercentage,
      isCompliant: Math.abs(varianceHours) < 0.5,
      totalDeliverables: activities.reduce((sum, a) => sum + (a.files ? a.files.length : 0), 0),
      totalExternalLinks: activities.reduce((sum, a) => sum + (a.links ? a.links.length : 0), 0),
      byWorkType,
      days,
    },
    verificationProtocol: {
      currentStep: ts.stepIdx === 0 ? 'PM_REVIEW' : ts.stepIdx === 1 ? 'OWNER_APPROVAL' : 'FINALIZED',
      step1_pmReview: {
        roleRequired: 'pm',
        status: isPmApproved ? 'APPROVED' : ts.status === 'Draft' ? 'PENDING_SUBMISSION' : 'AWAITING_REVIEW',
        approvedAt: ts.history?.find((h) => h.from === 'PM Review' || h.role === 'PM' || h.role === 'pm')?.at || null,
        approvedBy: ts.history?.find((h) => h.from === 'PM Review' || h.role === 'PM' || h.role === 'pm')?.actor || null,
      },
      step2_ownerApproval: {
        roleRequired: 'admin',
        status: isOwnerApproved ? 'APPROVED' : isPmApproved ? 'AWAITING_APPROVAL' : 'BLOCKED_BY_PM',
        approvedAt: ts.approvedAt || null,
      },
    },
  };
}

module.exports = {
  listTimesheets,
  getTimesheet,
  ensureTimesheet,
  submitTimesheet,
  approveTimesheet,
  returnTimesheet,
  saveTimesheetHours,
  getTimesheetReconciliation,
};
