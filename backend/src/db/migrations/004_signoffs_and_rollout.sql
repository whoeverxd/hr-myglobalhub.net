-- Migration: 004_signoffs_and_rollout.sql
-- Digital sign-offs and progressive rollout tracking for PostgreSQL

CREATE TABLE IF NOT EXISTS payroll_signoffs (
  id VARCHAR(64) PRIMARY KEY,
  period_id VARCHAR(32) NOT NULL,
  department VARCHAR(32) NOT NULL,
  signed_by VARCHAR(100) NOT NULL,
  signature_hash VARCHAR(128) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (period_id) REFERENCES pay_periods (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signoffs_period_dept ON payroll_signoffs (period_id, department);

CREATE TABLE IF NOT EXISTS rollout_stages (
  id VARCHAR(64) PRIMARY KEY,
  phase INT NOT NULL,
  org_id VARCHAR(64) NOT NULL,
  short_name VARCHAR(50) NOT NULL,
  country VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
  effective_date DATE NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (org_id) REFERENCES organization_configs (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rollout_phase ON rollout_stages (phase);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rollout_org ON rollout_stages (org_id);
