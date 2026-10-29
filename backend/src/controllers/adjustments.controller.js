const db = require('../db');
const { logAction } = require('./audit.controller');
const { SEALED } = require('../payroll');

const PERIOD_ID = /^PP-\d{4}-\d{2}$/;
const fail = (status, message) => { const err = new Error(message); err.status = status; return err; };

/**
 * An adjustment belongs to ONE employee (employee_id) and is paid in ONE period (period_id) by the payroll run of
 * that period; paid_run_id marks it consumed. Legacy rows without employee_id are listed by name only for the
 * employee's own view and are never paid automatically.
 */
function listAdjustments(empId = null, empName = null) {
  let rows = db.query(`SELECT * FROM payroll_adjustments ORDER BY created_at ASC`);
  if (empId) {
    rows = rows.filter((a) => (a.employee_id ? a.employee_id === empId : Boolean(empName) && a.name === empName));
  }
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
    employeeId: a.employee_id || null,
    periodId: a.period_id || null,
    paidRunId: a.paid_run_id || null,
  }));
}

function createAdjustment(data, user = 'System', ip = '127.0.0.1') {
  const amt = Number(data.amt);
  const employeeId = String(data.employeeId || data.empId || '').trim();
  const periodId = String(data.periodId || data.period || '').trim();
  if (!employeeId || !periodId) throw fail(400, 'employeeId y periodId requeridos');
  if (!PERIOD_ID.test(periodId)) throw fail(400, `periodId inválido: ${periodId} (formato PP-YYYY-NN)`);
  if (!data.type || data.amt === '' || data.amt == null || isNaN(amt)) throw fail(400, 'type and numeric amt are required');
  const emp = db.getOne(`SELECT id, name, role, avatar FROM employees WHERE id = ?`, [employeeId]);
  if (!emp) throw fail(404, `Employee ${employeeId} not found`);
  // A period whose payroll is already approved/paid (or that is sealed) can't take more money: use the next open one
  const period = db.getOne(`SELECT status FROM pay_periods WHERE id = ?`, [periodId]);
  if (period && SEALED.includes(period.status)) throw fail(409, `${periodId} is ${period.status}: post the adjustment in the next open period`);
  const run = db.getOne(`SELECT status FROM payroll_runs WHERE id = ?`, [`PR-${periodId}`]);
  if (run && ['Approved', 'Paid', 'Closed', 'Archived'].includes(run.status)) {
    throw fail(409, `The payroll of ${periodId} is already ${run.status}: post the adjustment in the next open period`);
  }

  const id = data.id || `ADJ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const adj = {
    id,
    employee_id: emp.id,
    period_id: periodId,
    name: emp.name,
    role: data.role || emp.role || '',
    avatar: data.avatar || emp.avatar || null,
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
      `INSERT INTO payroll_adjustments (id, employee_id, period_id, name, role, avatar, type, cat, kind, amt, tax, taxTone, target, by_user, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adj.id,
        adj.employee_id,
        adj.period_id,
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

  return toResponse(adj);
}

function toResponse(a) {
  const { by_user, employee_id, period_id, paid_run_id, ...rest } = a;
  return { ...rest, by: by_user, employeeId: employee_id || null, periodId: period_id || null, paidRunId: paid_run_id || null };
}

function updateAdjustment(id, patch, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM payroll_adjustments WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error('Adjustment not found');
    err.status = 404;
    throw err;
  }
  if (current.paid_run_id) throw fail(409, `Adjustment ${id} was already paid in ${current.paid_run_id} and can't change`);

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

  return toResponse({ ...current, status: nextStatus });
}

module.exports = {
  listAdjustments,
  createAdjustment,
  updateAdjustment,
};
