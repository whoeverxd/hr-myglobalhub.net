-- Migration: 003_activities_storage_rails.sql
-- Daily Activities, File Attachments and Payment Rails for PostgreSQL

CREATE TABLE IF NOT EXISTS daily_activities (
  id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(32) NOT NULL,
  date DATE NOT NULL,
  jira_key VARCHAR(50),
  jira_summary VARCHAR(255),
  hours DECIMAL(8,2) NOT NULL,
  work_type VARCHAR(50) NOT NULL,
  description TEXT,
  evidences_json JSONB,
  links_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activities_emp_date ON daily_activities (employee_id, date);

CREATE TABLE IF NOT EXISTS file_attachments (
  id VARCHAR(64) PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  access_token VARCHAR(64),
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_category ON file_attachments (category);

CREATE TABLE IF NOT EXISTS payment_proofs (
  id VARCHAR(64) PRIMARY KEY,
  transfer VARCHAR(50) NOT NULL,
  bank VARCHAR(100) NOT NULL,
  amount VARCHAR(50) NOT NULL,
  ref VARCHAR(255),
  date DATE NOT NULL,
  file VARCHAR(255),
  thumb TEXT,
  type VARCHAR(50),
  created_when VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
