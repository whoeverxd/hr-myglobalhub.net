-- Migration: 007_agile_tasks_and_sprints.sql
-- Native Agile Project Management (Replacement of Jira)

CREATE TABLE IF NOT EXISTS project_statuses (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  color VARCHAR(30) DEFAULT '#3b82f6',
  position INT NOT NULL DEFAULT 0,
  is_default INT DEFAULT 0,
  is_done INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_statuses_proj ON project_statuses (project_id);
CREATE INDEX IF NOT EXISTS idx_project_statuses_pos ON project_statuses (project_id, position);

CREATE TABLE IF NOT EXISTS sprints (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  name VARCHAR(150) NOT NULL,
  goal TEXT,
  start_date VARCHAR(50),
  end_date VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
  velocity_points REAL DEFAULT 0,
  completed_at VARCHAR(50),
  created_by VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sprints_proj ON sprints (project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints (status);

CREATE TABLE IF NOT EXISTS project_tasks (
  id VARCHAR(64) PRIMARY KEY,
  task_key VARCHAR(50) UNIQUE NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  sprint_id VARCHAR(64),
  status_id VARCHAR(64) NOT NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) NOT NULL DEFAULT 'Task',
  priority VARCHAR(30) NOT NULL DEFAULT 'Medium',
  estimate_hours REAL DEFAULT 0,
  story_points INT DEFAULT 0,
  assignee_id VARCHAR(64),
  assignee_name VARCHAR(150),
  assignee_avatar VARCHAR(500),
  reporter_id VARCHAR(64),
  reporter_name VARCHAR(150),
  order_index INT DEFAULT 0,
  origin_jira_key VARCHAR(50),
  origin_jira_url VARCHAR(500),
  labels TEXT,
  logged_hours REAL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ptasks_key ON project_tasks (task_key);
CREATE INDEX IF NOT EXISTS idx_ptasks_proj ON project_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_ptasks_sprint ON project_tasks (sprint_id);
CREATE INDEX IF NOT EXISTS idx_ptasks_status ON project_tasks (status_id);
CREATE INDEX IF NOT EXISTS idx_ptasks_assignee ON project_tasks (assignee_id);
CREATE INDEX IF NOT EXISTS idx_ptasks_jira ON project_tasks (origin_jira_key);

CREATE TABLE IF NOT EXISTS project_members (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(150),
  user_email VARCHAR(150),
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pmembers_proj_user ON project_members (project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_pmembers_user ON project_members (user_id);
