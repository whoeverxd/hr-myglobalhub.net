// Database access layer. Delegated to Cloud Firestore / Active adapter in ./db/index.js.
const db = require('./db/index');

module.exports = {
  ...db,
  // Backwards compatibility helpers
  load: () => ({
    adjustments: require('./controllers/adjustments.controller').listAdjustments(),
    worklogs: require('./controllers/worklogs.controller').listWorklogs(),
    proofs: require('./controllers/proofs.controller').listProofs(),
    employees: require('./controllers/employees.controller').listEmployees(),
    periodOverrides: require('./controllers/periods.controller').getPeriodOverrides(),
  }),
  save: () => {
    /* Firestore adapter handles real-time cloud persistence automatically */
  },
  resetEmpty: () => {
    // Clears all relational tables to a pristine empty state (no users, no employees)
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM sessions;
      DELETE FROM users;
      DELETE FROM worklogs;
      DELETE FROM payroll_adjustments;
      DELETE FROM payment_proofs;
      DELETE FROM timesheets;
      DELETE FROM leave_requests;
      DELETE FROM attendance_punches;
      DELETE FROM attendance_exceptions;
      DELETE FROM daily_activities;
      DELETE FROM payroll_signoffs;
      DELETE FROM rollout_stages;
      DELETE FROM holidays;
      DELETE FROM organization_configs;
      DELETE FROM employees;
      DELETE FROM pay_periods;
      DELETE FROM payroll_runs;
      DELETE FROM payroll_run_items;
      DELETE FROM file_attachments;
      DELETE FROM jira_issues_cache;
      DELETE FROM jira_sync_status;
      DELETE FROM jira_projects;
      DELETE FROM statutory_holidays;
      DELETE FROM timesheet_daily_hours;
      DELETE FROM organizations;
      DELETE FROM auth_sessions;
      DELETE FROM role_permissions;
      DELETE FROM audit_logs;
      PRAGMA foreign_keys = ON;
    `);
  },
  reset: () => {
    // Re-seeds SQLite database
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM sessions;
      DELETE FROM users;
      DELETE FROM worklogs;
      DELETE FROM payroll_adjustments;
      DELETE FROM payment_proofs;
      DELETE FROM timesheets;
      DELETE FROM leave_requests;
      DELETE FROM attendance_punches;
      DELETE FROM attendance_exceptions;
      DELETE FROM daily_activities;
      DELETE FROM payroll_signoffs;
      DELETE FROM rollout_stages;
      DELETE FROM holidays;
      DELETE FROM organization_configs;
      DELETE FROM employees;
      DELETE FROM pay_periods;
      PRAGMA foreign_keys = ON;
    `);
    const { seedDatabaseIfEmpty } = require('./db/seeder');
    seedDatabaseIfEmpty();
  },
};

