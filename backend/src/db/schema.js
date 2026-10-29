const { exec } = require('./connection');

function initSchema() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS pay_periods (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      period_number INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      pay_date TEXT NOT NULL,
      cutoff TEXT NOT NULL,
      status TEXT NOT NULL,
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_periods_year ON pay_periods (year);
    CREATE INDEX IF NOT EXISTS idx_periods_status ON pay_periods (status);

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      nid TEXT,
      dob TEXT,
      entity TEXT NOT NULL,
      dept TEXT NOT NULL,
      role TEXT NOT NULL,
      mgr TEXT,
      type TEXT NOT NULL,
      start_date TEXT,
      loc TEXT,
      freq TEXT DEFAULT 'Bi-Weekly',
      rate REAL NOT NULL DEFAULT 0,
      cur TEXT DEFAULT 'USD',
      ot INTEGER DEFAULT 1,
      tax TEXT,
      pmethod TEXT DEFAULT 'Bank Deposit',
      bank TEXT,
      acct TEXT,
      routing TEXT,
      alloc REAL DEFAULT 100,
      crypto_wallet TEXT,
      crypto_asset TEXT,
      crypto_network TEXT,
      crypto_alloc REAL DEFAULT 0,
      jira TEXT,
      project TEXT,
      avatar TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      raw_meta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_employees_status ON employees (status);
    CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees (dept);

    CREATE TABLE IF NOT EXISTS worklogs (
      id TEXT PRIMARY KEY,
      issue_key TEXT NOT NULL,
      title TEXT NOT NULL,
      desc TEXT DEFAULT '—',
      hrs REAL NOT NULL,
      employee_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_worklogs_issue ON worklogs (issue_key);

    CREATE TABLE IF NOT EXISTS payroll_adjustments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      avatar TEXT,
      type TEXT NOT NULL,
      cat TEXT,
      kind TEXT NOT NULL,
      amt REAL NOT NULL,
      tax TEXT,
      taxTone TEXT DEFAULT 'info',
      target TEXT,
      by_user TEXT,
      status TEXT NOT NULL DEFAULT 'Pending Approval',
      period_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (period_id) REFERENCES pay_periods (id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_adjustments_status ON payroll_adjustments (status);
    CREATE INDEX IF NOT EXISTS idx_adjustments_kind ON payroll_adjustments (kind);

    CREATE TABLE IF NOT EXISTS payment_proofs (
      id TEXT PRIMARY KEY,
      transfer TEXT NOT NULL,
      bank TEXT NOT NULL,
      amount TEXT,
      ref TEXT NOT NULL,
      date TEXT NOT NULL,
      file TEXT,
      thumb TEXT,
      type TEXT,
      created_when TEXT,
      emp_id TEXT,
      period_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL DEFAULT 'System',
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      entity TEXT NOT NULL DEFAULT 'My Global Hub Dominicana SRL',
      employee_id TEXT,
      avatar TEXT,
      is_active INTEGER DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ip_address TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

    CREATE TABLE IF NOT EXISTS payroll_runs (
      id TEXT PRIMARY KEY,
      period_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      period_number INTEGER NOT NULL,
      entity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft',
      currency TEXT DEFAULT 'USD',
      total_employees INTEGER DEFAULT 0,
      total_hours REAL DEFAULT 0,
      total_gross REAL DEFAULT 0,
      total_deductions REAL DEFAULT 0,
      total_net REAL DEFAULT 0,
      rules_version TEXT DEFAULT '2025.1',
      pm_approved_by TEXT,
      pm_approved_at TEXT,
      owner_approved_by TEXT,
      owner_approved_at TEXT,
      approved_by TEXT,
      approved_at TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (period_id) REFERENCES pay_periods (id)
    );

    CREATE INDEX IF NOT EXISTS idx_runs_period ON payroll_runs (period_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON payroll_runs (status);

    CREATE TABLE IF NOT EXISTS payroll_run_items (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      employee_role TEXT,
      rate REAL NOT NULL,
      reg_hours REAL DEFAULT 80,
      ot_hours REAL DEFAULT 0,
      pto_hours REAL DEFAULT 0,
      gross_pay REAL NOT NULL,
      total_deductions REAL NOT NULL,
      net_pay REAL NOT NULL,
      deductions_json TEXT,
      adjustments_json TEXT,
      payout_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES payroll_runs (id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees (id)
    );

    CREATE INDEX IF NOT EXISTS idx_run_items_run ON payroll_run_items (run_id);
    CREATE INDEX IF NOT EXISTS idx_run_items_emp ON payroll_run_items (employee_id);

    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);

    CREATE TABLE IF NOT EXISTS organization_configs (
      id TEXT PRIMARY KEY,
      short_name TEXT NOT NULL,
      country TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      timezone TEXT NOT NULL DEFAULT 'America/Santo_Domingo',
      language TEXT NOT NULL DEFAULT 'es',
      locale TEXT NOT NULL DEFAULT 'es-DO',
      hour12 INTEGER NOT NULL DEFAULT 0,
      workdays TEXT NOT NULL DEFAULT 'Mon–Fri',
      payroll_rule TEXT NOT NULL DEFAULT 'Bi-weekly',
      ot_rule TEXT NOT NULL DEFAULT 'weekly',
      ot_daily_threshold REAL NOT NULL DEFAULT 8,
      ot_weekly_threshold REAL NOT NULL DEFAULT 44,
      workflow_steps_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      country TEXT NOT NULL,
      region TEXT DEFAULT 'National',
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      is_paid INTEGER NOT NULL DEFAULT 1,
      is_working INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES organization_configs (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_holidays_org_date ON holidays (org_id, date);

    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT,
      type TEXT NOT NULL,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'Pending Supervisor',
      history_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_leave_emp ON leave_requests (employee_id);
    CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests (status);

    CREATE TABLE IF NOT EXISTS timesheets (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      period_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft',
      step_index INTEGER NOT NULL DEFAULT 0,
      regular_hours REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      pto_hours REAL NOT NULL DEFAULT 0,
      holiday_hours REAL NOT NULL DEFAULT 0,
      total_hours REAL NOT NULL DEFAULT 0,
      history_json TEXT,
      submitted_at TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
      FOREIGN KEY (period_id) REFERENCES pay_periods (id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_timesheets_emp_period ON timesheets (employee_id, period_id);
    CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets (status);

    CREATE TABLE IF NOT EXISTS attendance_punches (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      clock_in TEXT,
      lunch_out TEXT,
      lunch_in TEXT,
      clock_out TEXT,
      day_type TEXT NOT NULL DEFAULT 'Regular',
      mode TEXT NOT NULL DEFAULT 'office',
      hours REAL NOT NULL DEFAULT 0,
      overtime REAL NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_punches_emp_date ON attendance_punches (employee_id, date);

    CREATE TABLE IF NOT EXISTS attendance_exceptions (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      suggested_action TEXT,
      resolved_by TEXT,
      resolved_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_exceptions_emp ON attendance_exceptions (employee_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_status ON attendance_exceptions (status);

    CREATE TABLE IF NOT EXISTS daily_activities (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      jira_key TEXT,
      jira_summary TEXT,
      hours REAL NOT NULL,
      work_type TEXT NOT NULL,
      description TEXT,
      evidences_json TEXT,
      links_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_activities_emp_date ON daily_activities (employee_id, date);

    CREATE TABLE IF NOT EXISTS file_attachments (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      access_token TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_files_category ON file_attachments (category);

    CREATE TABLE IF NOT EXISTS payroll_signoffs (
      id TEXT PRIMARY KEY,
      period_id TEXT NOT NULL,
      department TEXT NOT NULL,
      signed_by TEXT NOT NULL,
      signature_hash TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (period_id) REFERENCES pay_periods (id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_signoffs_period_dept ON payroll_signoffs (period_id, department);

    CREATE TABLE IF NOT EXISTS rollout_stages (
      id TEXT PRIMARY KEY,
      phase INTEGER NOT NULL,
      org_id TEXT NOT NULL,
      short_name TEXT NOT NULL,
      country TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PLANNED',
      effective_date TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES organization_configs (id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_rollout_phase ON rollout_stages (phase);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rollout_org ON rollout_stages (org_id);

    CREATE TABLE IF NOT EXISTS jira_issues_cache (
      key TEXT PRIMARY KEY,
      project_key TEXT NOT NULL,
      summary TEXT NOT NULL,
      issue_type TEXT DEFAULT 'Task',
      status TEXT DEFAULT 'In Progress',
      assignee_name TEXT,
      assignee_email TEXT,
      assignee_avatar TEXT,
      estimate_hours REAL DEFAULT 4.0,
      logged_hours REAL DEFAULT 0.0,
      url TEXT,
      jira_created_at TEXT,
      jira_updated_at TEXT,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jira_cache_project ON jira_issues_cache (project_key);
    CREATE INDEX IF NOT EXISTS idx_jira_cache_status ON jira_issues_cache (status);
    CREATE INDEX IF NOT EXISTS idx_jira_cache_assignee ON jira_issues_cache (assignee_email);

    CREATE TABLE IF NOT EXISTS jira_sync_status (
      id TEXT PRIMARY KEY,
      project_key TEXT,
      last_sync_at TEXT,
      status TEXT NOT NULL DEFAULT 'IDLE',
      total_synced INTEGER DEFAULT 0,
      last_error TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jira_projects (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      lead TEXT,
      people INTEGER DEFAULT 1,
      budget REAL DEFAULT 50000,
      spent REAL DEFAULT 0,
      hrs REAL DEFAULT 0,
      bill REAL DEFAULT 100,
      st TEXT DEFAULT 'On track',
      jira_id TEXT,
      last_sync_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contractors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      country TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      start_date TEXT,
      end_date TEXT,
      basis TEXT NOT NULL DEFAULT 'Hourly',
      rate REAL NOT NULL DEFAULT 0,
      cur TEXT NOT NULL DEFAULT 'USD',
      method TEXT NOT NULL DEFAULT 'Coinbase',
      wallet TEXT,
      wallet_full TEXT,
      asset TEXT DEFAULT 'USDC',
      network TEXT DEFAULT 'Base',
      delivery TEXT DEFAULT 'Cash Pickup',
      receiver TEXT,
      city TEXT,
      bank TEXT,
      acct TEXT,
      pay_cur TEXT DEFAULT 'USD',
      fx REAL DEFAULT 1.0,
      wu_fee REAL DEFAULT 4.99,
      status TEXT NOT NULL DEFAULT 'Active',
      entity TEXT NOT NULL DEFAULT 'MGH Dominicana SRL',
      employee_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contractors_status ON contractors (status);
    CREATE INDEX IF NOT EXISTS idx_contractors_country ON contractors (country);

    CREATE TABLE IF NOT EXISTS contractor_payments (
      id TEXT PRIMARY KEY,
      contractor_id TEXT NOT NULL,
      period_id TEXT NOT NULL DEFAULT 'PP-2025-08',
      hours REAL,
      amount REAL NOT NULL,
      fee REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Calculated',
      date TEXT,
      cb_id TEXT,
      hash TEXT,
      mtcn TEXT,
      notes TEXT,
      receipt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contractor_id) REFERENCES contractors (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cpay_contractor ON contractor_payments (contractor_id);
    CREATE INDEX IF NOT EXISTS idx_cpay_period ON contractor_payments (period_id);
    CREATE INDEX IF NOT EXISTS idx_cpay_status ON contractor_payments (status);

    CREATE TABLE IF NOT EXISTS project_statuses (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      position INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      is_done INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_project_statuses_proj ON project_statuses (project_id);
    CREATE INDEX IF NOT EXISTS idx_project_statuses_pos ON project_statuses (project_id, position);

    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      goal TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'PLANNED',
      velocity_points REAL DEFAULT 0,
      completed_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sprints_proj ON sprints (project_id);
    CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints (status);

    CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY,
      task_key TEXT UNIQUE NOT NULL,
      project_id TEXT NOT NULL,
      sprint_id TEXT,
      status_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      task_type TEXT NOT NULL DEFAULT 'Task',
      priority TEXT NOT NULL DEFAULT 'Medium',
      estimate_hours REAL DEFAULT 0,
      story_points INTEGER DEFAULT 0,
      assignee_id TEXT,
      assignee_name TEXT,
      assignee_avatar TEXT,
      reporter_id TEXT,
      reporter_name TEXT,
      order_index INTEGER DEFAULT 0,
      origin_jira_key TEXT,
      origin_jira_url TEXT,
      labels TEXT,
      logged_hours REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ptasks_key ON project_tasks (task_key);
    CREATE INDEX IF NOT EXISTS idx_ptasks_proj ON project_tasks (project_id);
    CREATE INDEX IF NOT EXISTS idx_ptasks_sprint ON project_tasks (sprint_id);
    CREATE INDEX IF NOT EXISTS idx_ptasks_status ON project_tasks (status_id);
    CREATE INDEX IF NOT EXISTS idx_ptasks_assignee ON project_tasks (assignee_id);
    CREATE INDEX IF NOT EXISTS idx_ptasks_jira ON project_tasks (origin_jira_key);

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_email TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_pmembers_proj_user ON project_members (project_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_pmembers_user ON project_members (user_id);
  `;

  // Safe backward-compatible migrations for existing databases
  try { exec(`ALTER TABLE contractors ADD COLUMN employee_id TEXT;`); } catch (_) {}
  try { exec(`CREATE INDEX IF NOT EXISTS idx_contractors_employee ON contractors (employee_id);`); } catch (_) {}

  exec(ddl);

  try { exec(`ALTER TABLE payroll_runs ADD COLUMN pm_approved_by TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE payroll_runs ADD COLUMN pm_approved_at TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE payroll_runs ADD COLUMN owner_approved_by TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE payroll_runs ADD COLUMN owner_approved_at TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE contractors ADD COLUMN employee_id TEXT;`); } catch (_) {}
  try { exec(`CREATE INDEX IF NOT EXISTS idx_contractors_employee ON contractors (employee_id);`); } catch (_) {}
  // Reviewer decision per activity (partial approval of hours): pending | approved | partial | rejected
  try { exec(`ALTER TABLE daily_activities ADD COLUMN review_status TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE daily_activities ADD COLUMN approved_hours REAL;`); } catch (_) {}
  try { exec(`ALTER TABLE daily_activities ADD COLUMN review_comment TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE daily_activities ADD COLUMN reviewed_by TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE daily_activities ADD COLUMN reviewed_at TEXT;`); } catch (_) {}
  // Meeting logged by a PM/supervisor for several attendees: shared id + who logged it (null = the owner)
  // Proofs belong to one payslip line: transfer + employee + period (it used to be one proof per transfer for everybody)
  try { exec(`ALTER TABLE payment_proofs ADD COLUMN emp_id TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE payment_proofs ADD COLUMN period_id TEXT;`); } catch (_) {}
  try { exec(`DROP INDEX IF EXISTS idx_proofs_transfer;`); } catch (_) {}
  try { exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_proofs_line ON payment_proofs (transfer, emp_id, period_id);`); } catch (_) {}
  try { exec(`ALTER TABLE daily_activities ADD COLUMN meeting_id TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE daily_activities ADD COLUMN logged_by TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE payroll_runs ADD COLUMN paid_by TEXT;`); } catch (_) {}
  // 1 = the password was set by an administrator; the user must replace it on next sign-in
  try { exec(`ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;`); } catch (_) {}
  // An adjustment belongs to one employee and one period; paid_run_id = the run that paid it (never paid twice)
  try { exec(`ALTER TABLE payroll_adjustments ADD COLUMN employee_id TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE payroll_adjustments ADD COLUMN period_id TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE payroll_adjustments ADD COLUMN paid_run_id TEXT;`); } catch (_) {}
  try { exec(`CREATE INDEX IF NOT EXISTS idx_adjustments_emp_period ON payroll_adjustments (employee_id, period_id);`); } catch (_) {}
}

module.exports = { initSchema };
