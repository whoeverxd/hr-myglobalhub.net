-- Migration: 001_core_schema.sql
-- High-precision PostgreSQL relational schema for MGH Payroll

CREATE TABLE IF NOT EXISTS pay_periods (
  id VARCHAR(32) PRIMARY KEY,
  year INT NOT NULL,
  period_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pay_date DATE NOT NULL,
  cutoff DATE NOT NULL,
  status VARCHAR(32) NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_periods_year ON pay_periods (year);
CREATE INDEX IF NOT EXISTS idx_periods_status ON pay_periods (status);

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(32) PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  nid VARCHAR(50),
  dob DATE,
  entity VARCHAR(255) NOT NULL,
  dept VARCHAR(100) NOT NULL,
  role VARCHAR(100) NOT NULL,
  mgr VARCHAR(100),
  type VARCHAR(50) NOT NULL,
  start_date DATE,
  loc VARCHAR(100),
  freq VARCHAR(50) DEFAULT 'Bi-Weekly',
  rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  cur VARCHAR(10) DEFAULT 'USD',
  ot BOOLEAN DEFAULT TRUE,
  tax VARCHAR(100),
  pmethod VARCHAR(50) DEFAULT 'Bank Deposit',
  bank VARCHAR(100),
  acct VARCHAR(100),
  routing VARCHAR(50),
  alloc DECIMAL(5,2) DEFAULT 100.00,
  crypto_wallet VARCHAR(100),
  crypto_asset VARCHAR(20),
  crypto_network VARCHAR(50),
  crypto_alloc DECIMAL(5,2) DEFAULT 0.00,
  jira VARCHAR(100),
  project VARCHAR(100),
  avatar TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  raw_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_entity ON employees (entity);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees (status);

CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(32),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  avatar TEXT,
  type VARCHAR(100) NOT NULL,
  cat VARCHAR(100) NOT NULL,
  kind VARCHAR(50) NOT NULL,
  amt DECIMAL(12,2) NOT NULL,
  tax VARCHAR(100) NOT NULL,
  tax_tone VARCHAR(50),
  target VARCHAR(255),
  by_user VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  period_id VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE SET NULL,
  FOREIGN KEY (period_id) REFERENCES pay_periods (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS worklogs (
  id VARCHAR(64) PRIMARY KEY,
  issue_key VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  hrs DECIMAL(8,2) NOT NULL,
  employee_id VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id VARCHAR(64) PRIMARY KEY,
  period_id VARCHAR(32) NOT NULL,
  year INT NOT NULL,
  period_number INT NOT NULL,
  entity VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Calculated',
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  total_employees INT NOT NULL,
  total_hours DECIMAL(10,2) NOT NULL,
  total_gross DECIMAL(12,2) NOT NULL,
  total_deductions DECIMAL(12,2) NOT NULL,
  total_net DECIMAL(12,2) NOT NULL,
  rules_version VARCHAR(50) NOT NULL,
  approved_by VARCHAR(100),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (period_id) REFERENCES pay_periods (id)
);

CREATE TABLE IF NOT EXISTS payroll_run_items (
  id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL,
  employee_id VARCHAR(32) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  employee_role VARCHAR(100),
  rate DECIMAL(12,2) NOT NULL,
  reg_hours DECIMAL(8,2) NOT NULL,
  ot_hours DECIMAL(8,2) NOT NULL,
  pto_hours DECIMAL(8,2) NOT NULL,
  gross_pay DECIMAL(12,2) NOT NULL,
  total_deductions DECIMAL(12,2) NOT NULL,
  net_pay DECIMAL(12,2) NOT NULL,
  deductions_json JSONB,
  adjustments_json JSONB,
  payout_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (run_id) REFERENCES payroll_runs (id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees (id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR(50) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  PRIMARY KEY (role, permission)
);
