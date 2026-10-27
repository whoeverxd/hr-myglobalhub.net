-- Migration: 005_jira_issues_cache.sql
-- Jira Cloud issues cache and synchronization tracking for PostgreSQL / SQLite

CREATE TABLE IF NOT EXISTS jira_issues_cache (
  key VARCHAR(50) PRIMARY KEY,
  project_key VARCHAR(50) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  issue_type VARCHAR(50) DEFAULT 'Task',
  status VARCHAR(50) DEFAULT 'In Progress',
  assignee_name VARCHAR(150),
  assignee_email VARCHAR(150),
  assignee_avatar VARCHAR(500),
  estimate_hours REAL DEFAULT 4.0,
  logged_hours REAL DEFAULT 0.0,
  url VARCHAR(500),
  jira_created_at TIMESTAMPTZ,
  jira_updated_at TIMESTAMPTZ,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jira_cache_project ON jira_issues_cache (project_key);
CREATE INDEX IF NOT EXISTS idx_jira_cache_status ON jira_issues_cache (status);
CREATE INDEX IF NOT EXISTS idx_jira_cache_assignee ON jira_issues_cache (assignee_email);

CREATE TABLE IF NOT EXISTS jira_sync_status (
  id VARCHAR(50) PRIMARY KEY,
  project_key VARCHAR(50),
  last_sync_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'IDLE',
  total_synced INT DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_projects (
  id VARCHAR(50) PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  lead VARCHAR(150),
  people INT DEFAULT 1,
  budget NUMERIC(12,2) DEFAULT 50000,
  spent NUMERIC(12,2) DEFAULT 0,
  hrs NUMERIC(10,2) DEFAULT 0,
  bill NUMERIC(5,2) DEFAULT 100,
  st VARCHAR(50) DEFAULT 'On track',
  jira_id VARCHAR(50),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jira_projects_key ON jira_projects (key);

