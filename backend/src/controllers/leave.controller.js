const db = require('../db');
const { logAction } = require('./audit.controller');

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
    type: l.type,
    from: l.from_date,
    to: l.to_date,
    reason: l.reason,
    status: l.status,
    history: l.history_json ? JSON.parse(l.history_json) : [],
    createdAt: l.created_at,
  }));
}

function createLeaveRequest(data, user = 'System', ip = '127.0.0.1') {
  const { empId, name, type, fromDate, toDate, reason } = data;
  if (!empId || !type || !fromDate || !toDate) {
    const err = new Error('empId, type, fromDate and toDate are required');
    err.status = 400;
    throw err;
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
  listLeaveRequests,
  createLeaveRequest,
  reviewLeaveRequest,
};
