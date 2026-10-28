const db = require('../db');
const { logAction } = require('./audit.controller');

function listWorklogs(empId = null) {
  let sql = `SELECT * FROM worklogs`;
  const params = [];
  if (empId) {
    sql += ` WHERE employee_id = ?`;
    params.push(empId);
  }
  sql += ` ORDER BY created_at ASC`;
  const rows = db.query(sql, params);
  return rows.map((w) => ({
    id: w.id,
    key: w.issue_key,
    title: w.title,
    desc: w.desc,
    hrs: w.hrs,
    employeeId: w.employee_id,
  }));
}

function addWorklog(data, user = 'System', ip = '127.0.0.1') {
  const hrs = Number(data.hrs);
  if (!data.key || !(hrs > 0 && hrs <= 12)) {
    const err = new Error('key and hrs (0–12) are required');
    err.status = 400;
    throw err;
  }

  const log = {
    id: data.id || 'wl-' + Date.now(),
    key: data.key,
    title: data.title || '',
    desc: data.desc || '—',
    hrs,
    employee_id: data.employeeId || 'MGH-1042',
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO worklogs (id, issue_key, title, desc, hrs, employee_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [log.id, log.key, log.title, log.desc, log.hrs, log.employee_id]
    );

    logAction({
      actor: user,
      action: 'ADD_WORKLOG',
      entityType: 'worklog',
      entityId: log.id,
      newValues: log,
      ip,
    });
  });

  return {
    id: log.id,
    key: log.key,
    title: log.title,
    desc: log.desc,
    hrs: log.hrs,
  };
}

function deleteWorklog(id, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM worklogs WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Worklog not found');
    err.status = 404;
    throw err;
  }

  db.transaction(() => {
    db.execute(`DELETE FROM worklogs WHERE id = ?`, [id]);
    logAction({
      actor: user,
      action: 'DELETE_WORKLOG',
      entityType: 'worklog',
      entityId: id,
      oldValues: current,
      ip,
    });
  });

  return true;
}

module.exports = {
  listWorklogs,
  addWorklog,
  deleteWorklog,
};
