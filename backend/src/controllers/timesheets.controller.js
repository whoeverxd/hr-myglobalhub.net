const db = require('../db');
const { logAction } = require('./audit.controller');
const { getOrgConfig } = require('./workflows.controller');
const { buildPeriods } = require('../payroll');

// Statuses in which the employee still owns the timesheet (can log activities and submit)
const EDITABLE = ['Draft', 'Returned'];
// Statuses that are not "under review" (cannot be approved or returned)
const NOT_IN_REVIEW = ['Draft', 'Returned', 'Approved', 'Paid', 'Closed', 'Archived'];
// Used when the organization has no workflow configured: PM review, then owner approval
const DEFAULT_STEPS = [
  { key: 'pm', label: 'Supervisión PM', role: 'pm', review: 'Supervisión PM' },
  { key: 'owner', label: 'Aprobación Dueño & Pago', role: 'admin', review: 'Aprobación Dueño' },
];

const r2 = (n) => Math.round(n * 100) / 100;

// Quincena id for a YYYY-MM-DD date (1-15 → odd, 16-end → even)
function periodIdForDate(date) {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  return `PP-${y}-${String((m - 1) * 2 + (d <= 15 ? 1 : 2)).padStart(2, '0')}`;
}

// Dates come from the quincena rule (ids are deterministic), not from stored rows that may predate the rule
function periodRange(periodId) {
  const p = buildPeriods(Number(String(periodId).slice(3, 7))).find((x) => x.id === periodId);
  return p ? { start: p.start, end: p.end, payDate: p.payDate, cutoff: p.cutoff } : null;
}

/**
 * Hours of a timesheet derived from real records (the "equivalence" rule):
 *  - worked = sum of the employee's daily activities in the period
 *  - overtime split by the organization's rule (daily and/or weekly threshold)
 *  - PTO = approved, paid leave on weekdays; holidays = paid non-working holidays on weekdays (one shift each)
 */
function computeHours(empId, periodId) {
  const range = periodRange(periodId);
  if (!range) return null;
  const emp = db.getOne(`SELECT entity FROM employees WHERE id = ?`, [empId]) || {};
  const ot = (getOrgConfig(emp.entity || 'MGH Dominicana SRL') || {}).ot || {};
  const rule = ot.rule || 'weekly';
  const dailyMax = Number(ot.daily) || 8;
  const weeklyMax = Number(ot.weekly) || 44;
  const useDaily = ['daily', 'both', 'custom'].includes(rule);
  const useWeekly = ['weekly', 'both', 'custom'].includes(rule);

  const days = [];
  for (let d = new Date(range.start + 'T00:00:00Z'); d <= new Date(range.end + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push({ date: d.toISOString().slice(0, 10), dow: d.getUTCDay() });
  }
  const weekday = (x) => x.dow !== 0 && x.dow !== 6;
  const weekOf = (x) => { const t = new Date(x.date + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - ((x.dow + 6) % 7)); return t.toISOString().slice(0, 10); };

  const byDay = {};
  db.query(`SELECT date, hours FROM daily_activities WHERE employee_id = ? AND date >= ? AND date <= ?`, [empId, range.start, range.end])
    .forEach((a) => { byDay[a.date] = (byDay[a.date] || 0) + (Number(a.hours) || 0); });

  let reg = 0, otH = 0;
  const weekReg = {};
  for (const x of days) {
    const h = byDay[x.date] || 0;
    if (!h) continue;
    let dOt = useDaily ? Math.max(0, h - dailyMax) : 0;
    let dReg = h - dOt;
    if (useWeekly) {
      const wk = weekOf(x), used = weekReg[wk] || 0;
      const extra = Math.max(0, dReg - Math.max(0, weeklyMax - used));
      dOt += extra; dReg -= extra; weekReg[wk] = used + dReg;
    }
    reg += dReg; otH += dOt;
  }

  const leaves = db.query(
    `SELECT from_date, to_date, type FROM leave_requests WHERE employee_id = ? AND status = 'Approved' AND to_date >= ? AND from_date <= ?`,
    [empId, range.start, range.end]
  ).filter((l) => l.type !== 'Unpaid');
  const onLeave = (date) => leaves.some((l) => date >= l.from_date && date <= l.to_date);
  // Only the employee's organization calendar ('My Global Hub Dominicana SRL' and 'MGH Dominicana SRL' are the same org)
  const orgKey = (s) => (/dominicana/i.test(s || '') ? 'MGH-DR' : String(s || ''));
  const myOrg = orgKey(emp.entity || 'MGH Dominicana SRL');
  const paidHolidays = new Set(
    db.query(`SELECT date, org_id, is_paid, is_working FROM holidays WHERE date >= ? AND date <= ?`, [range.start, range.end])
      .filter((h) => h.is_paid && !h.is_working && orgKey(h.org_id) === myOrg).map((h) => h.date)
  );
  let pto = 0, hol = 0;
  for (const x of days.filter(weekday)) {
    if (paidHolidays.has(x.date)) hol += dailyMax;
    else if (onLeave(x.date)) pto += dailyMax;
  }
  reg = r2(reg); otH = r2(otH);
  return { reg, ot: otH, pto, hol, total: r2(reg + otH + pto + hol), worked: r2(reg + otH) };
}

function listTimesheets({ periodId, empId, live = false } = {}) {
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
  return rows.map((t) => {
    const out = {
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
    };
    // live=1: still-editable sheets show the hours their activities add up to right now (not persisted until submit)
    if (live && EDITABLE.includes(t.status)) {
      const h = computeHours(t.employee_id, t.period_id);
      if (h) Object.assign(out, { reg: h.reg, ot: h.ot, pto: h.pto, hol: h.hol, total: h.total, liveHours: true });
    }
    return out;
  });
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

  if (!EDITABLE.includes(current.status)) {
    const err = new Error(`Cannot submit timesheet in status ${current.status}`);
    err.status = 400;
    throw err;
  }

  // Hours are frozen from the employee's real records at submission time
  const hours = computeHours(current.employee_id, current.period_id);
  // Paid holidays alone don't make a submission: there must be worked hours or approved leave
  if (!hours || hours.worked + hours.pto <= 0) {
    const err = new Error('No hours recorded in this period: log your activities before submitting');
    err.status = 400;
    throw err;
  }

  const history = current.history_json ? JSON.parse(current.history_json) : [];
  const emp = db.getOne(`SELECT entity FROM employees WHERE id = ?`, [current.employee_id]);
  const orgCfg = getOrgConfig(emp ? emp.entity : 'MGH Dominicana SRL');
  const steps = (orgCfg && orgCfg.steps && orgCfg.steps.length ? orgCfg.steps : null) || DEFAULT_STEPS;
  const firstStep = steps[0];
  const nextStatus = firstStep ? (firstStep.review || `${firstStep.label} Review` || 'Supervisión PM') : 'Approved';

  history.push({
    at: new Date().toISOString(),
    actor: user,
    role: 'Employee',
    from: current.status,
    to: nextStatus,
    comment: `Quincena enviada a aprobación • ${hours.total}h (${hours.reg} regulares, ${hours.ot} extra, ${hours.pto} PTO, ${hours.hol} feriado)`,
  });

  db.transaction(() => {
    db.execute(
      `UPDATE timesheets
       SET status = ?, step_index = 0, history_json = ?, submitted_at = datetime('now'), updated_at = datetime('now'),
           regular_hours = ?, overtime_hours = ?, pto_hours = ?, holiday_hours = ?, total_hours = ?
       WHERE id = ?`,
      [nextStatus, JSON.stringify(history), hours.reg, hours.ot, hours.pto, hours.hol, hours.total, id]
    );

    logAction({
      actor: user,
      action: 'SUBMIT_TIMESHEET',
      entityType: 'timesheet',
      entityId: id,
      newValues: { status: nextStatus, periodId: current.period_id, hours },
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

  if (NOT_IN_REVIEW.includes(current.status)) {
    const err = new Error(`Only a timesheet under review can be approved (current status: ${current.status})`);
    err.status = 400;
    throw err;
  }

  // Determine organization workflow steps
  const emp = db.getOne(`SELECT entity FROM employees WHERE id = ?`, [current.employee_id]);
  const orgCfg = getOrgConfig(emp ? emp.entity : 'MGH Dominicana SRL');
  const steps = (orgCfg && orgCfg.steps && orgCfg.steps.length ? orgCfg.steps : null) || DEFAULT_STEPS;

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
  if (NOT_IN_REVIEW.includes(current.status)) {
    const err = new Error(`Only a timesheet under review can be returned (current status: ${current.status})`);
    err.status = 400;
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

// Reviewer adjustment of the submitted hours. Only while under review; omitted fields keep their stored value.
function saveTimesheetHours(id, body = {}, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM timesheets WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Timesheet not found');
    err.status = 404;
    throw err;
  }
  if (NOT_IN_REVIEW.includes(current.status)) {
    const err = new Error(`Hours can only be adjusted while the timesheet is under review (current status: ${current.status})`);
    err.status = 400;
    throw err;
  }
  const pick = (k, col) => (body[k] != null && body[k] !== '' ? Number(body[k]) : Number(current[col]) || 0);
  const reg = pick('reg', 'regular_hours'), ot = pick('ot', 'overtime_hours'), pto = pick('pto', 'pto_hours'), hol = pick('hol', 'holiday_hours');
  if ([reg, ot, pto, hol].some((n) => isNaN(n) || n < 0)) {
    const err = new Error('Hours must be non-negative numbers');
    err.status = 400;
    throw err;
  }

  const total = reg + ot + pto + hol;

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
  const range = periodRange(ts.period) || { start: ts.period, end: ts.period };
  const startDate = range.start;
  const endDate = range.end;

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
      cutoff: range.cutoff || '',
      payDate: range.payDate || '',
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
  computeHours,
  periodIdForDate,
  EDITABLE,
};
