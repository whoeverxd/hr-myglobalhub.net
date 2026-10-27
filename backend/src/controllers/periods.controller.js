const db = require('../db');
const { STATUSES, SEALED, LOCKED, defaultStatus, buildPeriods } = require('../payroll');
const { logAction } = require('./audit.controller');

function ensurePeriodsForYear(year) {
  const existing = db.getOne('SELECT COUNT(*) as c FROM pay_periods WHERE year = ?', [year]);
  if (!existing || existing.c === 0) {
    const generated = buildPeriods(year);
    if (generated && generated.length > 0) {
      db.transaction(() => {
        for (const p of generated) {
          db.execute(
            `INSERT INTO pay_periods (id, year, period_number, start_date, end_date, pay_date, cutoff, status, is_locked)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, year, p.n, p.start, p.end, p.payDate, p.cutoff, p.status, p.locked ? 1 : 0]
          );
        }
      });
    }
  }
}

function listPeriods(year = new Date().getFullYear()) {
  ensurePeriodsForYear(year);
  const rows = db.query(
    `SELECT * FROM pay_periods WHERE year = ? ORDER BY period_number ASC`,
    [year]
  );
  return rows.map((p) => ({
    id: p.id,
    n: p.period_number,
    start: p.start_date,
    end: p.end_date,
    payDate: p.pay_date,
    cutoff: p.cutoff,
    status: p.status,
    locked: Boolean(p.is_locked),
  }));
}

function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const todayStr = now.toISOString().slice(0, 10);
  ensurePeriodsForYear(year);

  // Look for the period containing today
  let row = db.getOne(
    `SELECT * FROM pay_periods WHERE year = ? AND start_date <= ? AND end_date >= ? ORDER BY period_number ASC LIMIT 1`,
    [year, todayStr, todayStr]
  );

  // Fallback to latest open or current
  if (!row) {
    row = db.getOne(
      `SELECT * FROM pay_periods WHERE year = ? AND status = 'Open' ORDER BY period_number ASC LIMIT 1`,
      [year]
    );
  }

  if (!row) {
    row = db.getOne(
      `SELECT * FROM pay_periods WHERE year = ? ORDER BY period_number DESC LIMIT 1`,
      [year]
    );
  }

  if (row) {
    return {
      id: row.id,
      code: row.id,
      n: row.period_number,
      year: row.year,
      start: row.start_date,
      end: row.end_date,
      payDate: row.pay_date,
      cutoff: row.cutoff,
      status: row.status,
      locked: Boolean(row.is_locked),
    };
  }

  return buildPeriods(year).find(p => p.start <= todayStr && p.end >= todayStr) || buildPeriods(year)[0];
}

function getPeriodOverrides() {
  const rows = db.query(`SELECT id, period_number, status FROM pay_periods WHERE year = 2025`);
  const overrides = {};
  for (const r of rows) {
    const def = defaultStatus(r.period_number);
    if (r.status !== def) {
      overrides[r.id] = r.status;
    }
  }
  return overrides;
}


function updatePeriodStatus(id, status, user = 'Elena Rostova', ip = '127.0.0.1') {
  if (!STATUSES.includes(status)) {
    throw new Error('Invalid status');
  }

  const period = db.getOne(`SELECT * FROM pay_periods WHERE id = ?`, [id]);
  if (!period) {
    const err = new Error('Unknown pay period');
    err.status = 404;
    throw err;
  }

  if (SEALED.includes(period.status)) {
    const err = new Error(
      `${id} is ${period.status} and immutable. Post a Payroll Adjustment in the next open period instead.`
    );
    err.status = 409;
    throw err;
  }

  const isLocked = LOCKED.includes(status) ? 1 : 0;

  db.transaction(() => {
    db.execute(
      `UPDATE pay_periods 
       SET status = ?, is_locked = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [status, isLocked, id]
    );

    logAction({
      actor: user,
      action: 'UPDATE_PERIOD_STATUS',
      entityType: 'pay_period',
      entityId: id,
      oldValues: { status: period.status, is_locked: period.is_locked },
      newValues: { status, is_locked: isLocked },
      ip,
    });
  });

  return { id, status };
}

module.exports = {
  listPeriods,
  getCurrentPeriod,
  ensurePeriodsForYear,
  getPeriodOverrides,
  updatePeriodStatus,
};

