const db = require('../db');
const { logAction } = require('./audit.controller');

function listPunches({ empId, date, dateFrom, dateTo } = {}) {
  let sql = `SELECT * FROM attendance_punches WHERE 1=1`;
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

  sql += ` ORDER BY date DESC, employee_id ASC`;
  return db.query(sql, params).map((p) => ({
    id: p.id,
    emp: p.employee_id,
    date: p.date,
    clock_in: p.clock_in,
    lunch_out: p.lunch_out,
    lunch_in: p.lunch_in,
    clock_out: p.clock_out,
    day_type: p.day_type,
    mode: p.mode,
    hours: p.hours,
    overtime: p.overtime,
    note: p.note,
  }));
}

function recordPunch(data, user = 'System', ip = '127.0.0.1') {
  const { empId, date, clock_in, lunch_out, lunch_in, clock_out, day_type, mode, note, hours, overtime } = data;
  if (!empId || !date) {
    const err = new Error('empId and date are required');
    err.status = 400;
    throw err;
  }

  const id = data.id || `PUNCH-${empId}-${date.replace(/-/g, '')}`;

  db.transaction(() => {
    db.execute(
      `INSERT INTO attendance_punches (id, employee_id, date, clock_in, lunch_out, lunch_in, clock_out, day_type, mode, hours, overtime, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(employee_id, date) DO UPDATE SET
         clock_in = coalesce(excluded.clock_in, attendance_punches.clock_in),
         lunch_out = coalesce(excluded.lunch_out, attendance_punches.lunch_out),
         lunch_in = coalesce(excluded.lunch_in, attendance_punches.lunch_in),
         clock_out = coalesce(excluded.clock_out, attendance_punches.clock_out),
         day_type = coalesce(excluded.day_type, attendance_punches.day_type),
         mode = coalesce(excluded.mode, attendance_punches.mode),
         hours = coalesce(excluded.hours, attendance_punches.hours),
         overtime = coalesce(excluded.overtime, attendance_punches.overtime),
         note = coalesce(excluded.note, attendance_punches.note),
         updated_at = datetime('now')`,
      [
        id,
        empId,
        date,
        clock_in || null,
        lunch_out || null,
        lunch_in || null,
        clock_out || null,
        day_type || 'Regular',
        mode || 'office',
        hours != null ? Number(hours) : 0,
        overtime != null ? Number(overtime) : 0,
        note || null,
      ]
    );

    logAction({
      actor: user,
      action: 'RECORD_ATTENDANCE_PUNCH',
      entityType: 'attendance_punch',
      entityId: id,
      newValues: { empId, date, clock_in, clock_out, hours },
      ip,
    });
  });

  return listPunches({ empId, date })[0];
}

function listExceptions({ status, resolved, empId } = {}) {
  let sql = `SELECT * FROM attendance_exceptions WHERE 1=1`;
  const params = [];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  } else if (resolved !== undefined) {
    if (resolved === true || resolved === 'true') {
      sql += ` AND status = 'resolved'`;
    } else {
      sql += ` AND status != 'resolved'`;
    }
  }
  if (empId) {
    sql += ` AND employee_id = ?`;
    params.push(empId);
  }

  sql += ` ORDER BY date DESC, created_at DESC`;
  return db.query(sql, params).map((e) => ({
    id: e.id,
    emp: e.employee_id,
    date: e.date,
    type: e.type,
    severity: e.severity,
    status: e.status,
    suggestedAction: e.suggested_action,
    resolvedBy: e.resolved_by,
    resolvedAt: e.resolved_at,
    notes: e.notes,
  }));
}

function resolveException(id, { status = 'resolved', notes = '' } = {}, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM attendance_exceptions WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Exception not found');
    err.status = 404;
    throw err;
  }

  db.transaction(() => {
    db.execute(
      `UPDATE attendance_exceptions
       SET status = ?, resolved_by = ?, resolved_at = datetime('now'), notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [status, user, notes, id]
    );

    logAction({
      actor: user,
      action: 'RESOLVE_ATTENDANCE_EXCEPTION',
      entityType: 'attendance_exception',
      entityId: id,
      oldValues: { status: current.status },
      newValues: { status, notes, resolved_by: user },
      ip,
    });
  });

  return db.getOne(`SELECT * FROM attendance_exceptions WHERE id = ?`, [id]);
}

function listHolidays(filter = {}) {
  const orgId = typeof filter === 'string' ? filter : filter?.orgId;
  const year = typeof filter === 'object' ? filter?.year : undefined;

  let sql = `SELECT * FROM holidays WHERE 1=1`;
  const params = [];
  if (orgId) {
    sql += ` AND org_id = ?`;
    params.push(orgId);
  }
  if (year) {
    sql += ` AND date LIKE ?`;
    params.push(`${year}-%`);
  }
  sql += ` ORDER BY date ASC`;

  return db.query(sql, params).map((h) => ({
    id: h.id,
    org: h.org_id,
    country: h.country,
    region: h.region,
    date: h.date,
    desc: h.description,
    paid: Boolean(h.is_paid),
    working: Boolean(h.is_working),
  }));
}

function createHoliday(data, user = 'System', ip = '127.0.0.1') {
  const { orgId, country, region, date, description, paid = true, working = false } = data;
  if (!orgId || !date || !description) {
    const err = new Error('orgId, date and description are required');
    err.status = 400;
    throw err;
  }

  const id = data.id || `H-${Date.now()}`;
  db.transaction(() => {
    db.execute(
      `INSERT INTO holidays (id, org_id, country, region, date, description, is_paid, is_working)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, country || 'Dominican Republic', region || 'National', date, description, paid ? 1 : 0, working ? 1 : 0]
    );

    logAction({
      actor: user,
      action: 'CREATE_HOLIDAY',
      entityType: 'holiday',
      entityId: id,
      newValues: { orgId, date, description },
      ip,
    });
  });

  return { id, org: orgId, date, desc: description, paid: Boolean(paid), working: Boolean(working) };
}

function deleteHoliday(id, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM holidays WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Holiday not found');
    err.status = 404;
    throw err;
  }

  db.transaction(() => {
    db.execute(`DELETE FROM holidays WHERE id = ?`, [id]);
    logAction({
      actor: user,
      action: 'DELETE_HOLIDAY',
      entityType: 'holiday',
      entityId: id,
      oldValues: current,
      ip,
    });
  });

  return { ok: true, deleted: id };
}

module.exports = {
  listPunches,
  recordPunch,
  listExceptions,
  resolveException,
  listHolidays,
  createHoliday,
  deleteHoliday,
};
