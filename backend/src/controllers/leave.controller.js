const db = require('../db');
const { logAction } = require('./audit.controller');

// Canonical leave types (English, as the attendance engine and payroll expect) and the labels the screen may send.
// The leave form used to store the on-screen translation ("Sin goce de sueldo"), which payroll then read as PAID leave.
const LEAVE_TYPES = {
  Vacation: ['vacaciones'],
  Sick: ['enfermedad', 'licencia médica', 'licencia medica'],
  Personal: [],
  Bereavement: ['duelo'],
  'Jury Duty': ['servicio de jurado'],
  Maternity: ['maternidad'],
  Paternity: ['paternidad'],
  Unpaid: ['sin goce de sueldo', 'sin goce', 'no pagado', 'no remunerado'],
};
function canonicalLeaveType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (!t) return null;
  for (const [key, aliases] of Object.entries(LEAVE_TYPES)) {
    if (key.toLowerCase() === t || aliases.includes(t)) return key;
  }
  return null;
}
// Unknown legacy values count as paid, as before; only unpaid leave is excluded from payroll credit
const isPaidLeave = (type) => (canonicalLeaveType(type) || type) !== 'Unpaid';
// Requests that still hold their dates: a new one may not overlap them
const isActive = (status) => /^pending/i.test(String(status || '')) || status === 'Approved';
const isYmd = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const fmtDay = (d) => { const [y, m, dd] = String(d).split('-'); return `${dd}/${m}/${y}`; };

function listLeaveRequests({ empId, status } = {}) {
  let sql = `SELECT * FROM leave_requests WHERE 1=1`;
  const params = [];

  if (empId) {
    sql += ` AND employee_id = ?`;
    params.push(empId);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY from_date DESC, created_at DESC`;
  return db.query(sql, params).map((l) => ({
    id: l.id,
    emp: l.employee_id,
    name: l.employee_name,
    type: canonicalLeaveType(l.type) || l.type,
    paid: isPaidLeave(l.type),
    from: l.from_date,
    to: l.to_date,
    reason: l.reason,
    status: l.status,
    history: l.history_json ? JSON.parse(l.history_json) : [],
    createdAt: l.created_at,
  }));
}

function createLeaveRequest(data, user = 'System', ip = '127.0.0.1') {
  const { empId, name, fromDate, toDate, reason } = data;
  const fail = (status, msg) => { const err = new Error(msg); err.status = status; throw err; };
  if (!empId || !data.type || !fromDate || !toDate) fail(400, 'Indica el empleado, el tipo de licencia y las fechas de inicio y fin.');
  const type = canonicalLeaveType(data.type);
  if (!type) fail(400, `Tipo de licencia no válido: "${data.type}".`);
  if (!isYmd(fromDate) || !isYmd(toDate)) fail(400, 'Las fechas deben tener el formato AAAA-MM-DD.');
  if (toDate < fromDate) fail(400, 'La fecha de fin debe ser igual o posterior a la de inicio.');

  // One active request per day: retrying the form (or changing only the type) used to pile up duplicates
  const clash = db.query(`SELECT id, type, from_date, to_date, status FROM leave_requests WHERE employee_id = ? AND from_date <= ? AND to_date >= ?`, [empId, toDate, fromDate])
    .find((l) => isActive(l.status));
  if (clash) {
    fail(409, `Ya hay una solicitud ${clash.id} (${canonicalLeaveType(clash.type) || clash.type}, ${fmtDay(clash.from_date)} → ${fmtDay(clash.to_date)}) que cubre esas fechas. Cancélala primero si quieres cambiarla.`);
  }

  const id = data.id || `LV-${Date.now()}`;
  const history = [
    {
      at: new Date().toISOString(),
      actor: name || user,
      role: 'Employee',
      to: 'Pending Supervisor',
      comment: reason || '',
    },
  ];

  db.transaction(() => {
    db.execute(
      `INSERT INTO leave_requests (id, employee_id, employee_name, type, from_date, to_date, reason, status, history_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, empId, name || null, type, fromDate, toDate, reason || null, 'Pending Supervisor', JSON.stringify(history)]
    );

    logAction({
      actor: user,
      action: 'SUBMIT_LEAVE_REQUEST',
      entityType: 'leave_request',
      entityId: id,
      newValues: { empId, type, fromDate, toDate, reason },
      ip,
    });
  });

  const list = listLeaveRequests({ empId });
  return list.find((l) => l.id === id) || list[0];
}

function reviewLeaveRequest(id, { action, comment = '', role = 'Supervisor' } = {}, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM leave_requests WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Leave request not found');
    err.status = 404;
    throw err;
  }

  // Only a pending request can be approved or rejected; a decided one can at most be cancelled (Approved → Cancelled)
  const pending = /^pending/i.test(String(current.status || ''));
  const allowed = action === 'cancel' ? pending || current.status === 'Approved' : pending;
  if (['approve', 'reject', 'cancel'].includes(action) && !allowed) {
    const err = new Error(`Leave request is ${current.status}; it can no longer be ${action === 'cancel' ? 'cancelled' : action + 'd'}`);
    err.status = 409;
    throw err;
  }

  // Overlapping requests created before the duplicate check: only one of them can end up approved
  if (action === 'approve' && current.status !== 'Pending Supervisor') {
    const other = db.query(`SELECT id FROM leave_requests WHERE employee_id = ? AND id <> ? AND status = 'Approved' AND from_date <= ? AND to_date >= ?`,
      [current.employee_id, id, current.to_date, current.from_date])[0];
    if (other) {
      const err = new Error(`Ya hay una licencia aprobada (${other.id}) en esas fechas. Rechaza o cancela esta solicitud.`);
      err.status = 409;
      throw err;
    }
  }

  let nextStatus;
  if (action === 'reject') {
    nextStatus = 'Rejected';
  } else if (action === 'cancel') {
    nextStatus = 'Cancelled';
  } else if (action === 'approve') {
    if (current.status === 'Pending Supervisor') {
      nextStatus = 'Pending HR';
    } else {
      nextStatus = 'Approved';
    }
  } else {
    const err = new Error('Invalid review action. Expected approve, reject, or cancel.');
    err.status = 400;
    throw err;
  }

  const history = current.history_json ? JSON.parse(current.history_json) : [];
  history.push({
    at: new Date().toISOString(),
    actor: user,
    role,
    to: nextStatus,
    comment,
  });

  db.transaction(() => {
    db.execute(
      `UPDATE leave_requests
       SET status = ?, history_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [nextStatus, JSON.stringify(history), id]
    );

    logAction({
      actor: user,
      action: 'REVIEW_LEAVE_REQUEST',
      entityType: 'leave_request',
      entityId: id,
      oldValues: { status: current.status },
      newValues: { status: nextStatus, comment },
      ip,
    });
  });

  return listLeaveRequests().find((x) => x.id === id);
}

module.exports = {
  LEAVE_TYPES,
  canonicalLeaveType,
  isPaidLeave,
  listLeaveRequests,
  createLeaveRequest,
  reviewLeaveRequest,
};
