const db = require('../db');
const { logAction } = require('./audit.controller');

function listAdjustments(empId = null, empName = null) {
  let sql = `SELECT * FROM payroll_adjustments`;
  const params = [];
  if (empId) {
    sql += ` WHERE (id = ? OR name = ?)`;
    params.push(empId, empName || '');
  }
  sql += ` ORDER BY created_at ASC`;
  const rows = db.query(sql, params);
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    avatar: a.avatar,
    type: a.type,
    cat: a.cat,
    kind: a.kind,
    amt: a.amt,
    tax: a.tax,
    taxTone: a.taxTone,
    target: a.target,
    by: a.by_user,
    status: a.status,
  }));
}

function createAdjustment(data, user = 'Elena Rostova', ip = '127.0.0.1') {
  const amt = Number(data.amt);
  if (!data.name || !data.type || isNaN(amt)) {
    const err = new Error('name, type and numeric amt are required');
    err.status = 400;
    throw err;
  }

  const id = data.id || `ADJ-${Date.now()}`;
  const adj = {
    id,
    name: data.name,
    role: data.role || '',
    avatar: data.avatar || null,
    type: data.type,
    cat: data.cat || null,
    kind: data.kind || (amt < 0 ? 'deduction' : 'bonus'),
    amt,
    tax: data.tax || null,
    taxTone: data.taxTone || 'info',
    target: data.target || null,
    by_user: data.by || `${user} • just now`,
    status: data.status || 'Pending Approval',
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO payroll_adjustments (id, name, role, avatar, type, cat, kind, amt, tax, taxTone, target, by_user, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adj.id,
        adj.name,
        adj.role,
        adj.avatar,
        adj.type,
        adj.cat,
        adj.kind,
        adj.amt,
        adj.tax,
        adj.taxTone,
        adj.target,
        adj.by_user,
        adj.status,
      ]
    );

    logAction({
      actor: user,
      action: 'CREATE_ADJUSTMENT',
      entityType: 'adjustment',
      entityId: adj.id,
      newValues: adj,
      ip,
    });
  });

  return { ...adj, by: adj.by_user };
}

function updateAdjustment(id, patch, user = 'Elena Rostova', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM payroll_adjustments WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Adjustment not found');
    err.status = 404;
    throw err;
  }

  const nextStatus = patch.status ? String(patch.status) : current.status;

  db.transaction(() => {
    db.execute(
      `UPDATE payroll_adjustments 
       SET status = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [nextStatus, id]
    );

    logAction({
      actor: user,
      action: 'UPDATE_ADJUSTMENT',
      entityType: 'adjustment',
      entityId: id,
      oldValues: { status: current.status },
      newValues: { status: nextStatus },
      ip,
    });
  });

  return {
    ...current,
    status: nextStatus,
    by: current.by_user,
  };
}

module.exports = {
  listAdjustments,
  createAdjustment,
  updateAdjustment,
};
