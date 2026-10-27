const db = require('../db');
const { logAction } = require('./audit.controller');

function listOrganizations() {
  const rows = db.query(`SELECT * FROM organization_configs ORDER BY id ASC`);
  return rows.map((r) => ({
    id: r.id,
    short: r.short_name,
    country: r.country,
    currency: r.currency,
    timezone: r.timezone,
    language: r.language,
    locale: r.locale,
    hour12: Boolean(r.hour12),
    workdays: r.workdays,
    payroll: r.payroll_rule,
    ot: {
      rule: r.ot_rule,
      daily: r.ot_daily_threshold,
      weekly: r.ot_weekly_threshold,
    },
    steps: r.workflow_steps_json ? JSON.parse(r.workflow_steps_json) : [],
  }));
}

function getOrgConfig(orgId) {
  const row = db.getOne(`SELECT * FROM organization_configs WHERE id = ?`, [orgId]);
  if (!row) {
    const all = listOrganizations();
    return all[0] || null;
  }
  return {
    id: row.id,
    short: row.short_name,
    country: row.country,
    currency: row.currency,
    timezone: row.timezone,
    language: row.language,
    locale: row.locale,
    hour12: Boolean(row.hour12),
    workdays: row.workdays,
    payroll: row.payroll_rule,
    ot: {
      rule: row.ot_rule,
      daily: row.ot_daily_threshold,
      weekly: row.ot_weekly_threshold,
    },
    steps: row.workflow_steps_json ? JSON.parse(row.workflow_steps_json) : [],
  };
}

function updateOrgConfig(orgId, patch, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM organization_configs WHERE id = ?`, [orgId]);
  if (!current) {
    const err = new Error('Organization not found');
    err.status = 404;
    throw err;
  }

  const nextOtRule = patch.ot?.rule || patch.ot_rule || current.ot_rule;
  const nextDaily = patch.ot?.daily != null ? Number(patch.ot.daily) : current.ot_daily_threshold;
  const nextWeekly = patch.ot?.weekly != null ? Number(patch.ot.weekly) : current.ot_weekly_threshold;
  const nextStepsJson = patch.steps ? JSON.stringify(patch.steps) : current.workflow_steps_json;

  db.transaction(() => {
    db.execute(
      `UPDATE organization_configs
       SET ot_rule = ?, ot_daily_threshold = ?, ot_weekly_threshold = ?, workflow_steps_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [nextOtRule, nextDaily, nextWeekly, nextStepsJson, orgId]
    );

    logAction({
      actor: user,
      action: 'UPDATE_ORGANIZATION_CONFIG',
      entityType: 'organization_config',
      entityId: orgId,
      newValues: { ot_rule: nextOtRule, daily: nextDaily, weekly: nextWeekly },
      ip,
    });
  });

  return getOrgConfig(orgId);
}

/**
 * Pure overtime splitting calculation adhering to jurisdiction rules.
 * @param {Array<number>} dailyHours - List of hours worked per day in the pay period.
 * @param {Object} otConfig - Overtime rules configuration { rule: 'weekly'|'daily'|'both'|'custom', weekly: 44, daily: 8 }
 * @returns {{ regular: number, overtime: number, total: number }}
 */
function splitOT(dailyHours = [], otConfig = { rule: 'weekly', weekly: 44, daily: 8 }) {
  const { rule = 'weekly', weekly = 44, daily = 8 } = otConfig;
  const total = dailyHours.reduce((acc, h) => acc + (Number(h) || 0), 0);

  if (rule === 'daily') {
    let reg = 0;
    let ot = 0;
    for (const h of dailyHours) {
      const val = Number(h) || 0;
      reg += Math.min(val, daily);
      ot += Math.max(0, val - daily);
    }
    return { regular: Number(reg.toFixed(2)), overtime: Number(ot.toFixed(2)), total: Number(total.toFixed(2)) };
  }

  if (rule === 'both') {
    let reg = 0;
    let ot = 0;
    for (const h of dailyHours) {
      const val = Number(h) || 0;
      const dayReg = Math.min(val, daily);
      const dayOt = Math.max(0, val - daily);
      reg += dayReg;
      ot += dayOt;
    }
    // Any weekly hours exceeding weekly threshold also become OT
    if (reg > weekly) {
      const extraOt = reg - weekly;
      reg = weekly;
      ot += extraOt;
    }
    return { regular: Number(reg.toFixed(2)), overtime: Number(ot.toFixed(2)), total: Number(total.toFixed(2)) };
  }

  // Default: weekly rule
  const regular = Math.min(total, weekly);
  const overtime = Math.max(0, total - weekly);
  return { regular: Number(regular.toFixed(2)), overtime: Number(overtime.toFixed(2)), total: Number(total.toFixed(2)) };
}

module.exports = {
  listOrganizations,
  getOrgConfig,
  updateOrgConfig,
  splitOT,
};
