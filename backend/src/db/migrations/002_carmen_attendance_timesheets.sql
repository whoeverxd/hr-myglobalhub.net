-- Migration: 002_carmen_attendance_timesheets.sql
-- Attendance, Exceptions, Holidays, Leave Requests, Organizations & Timesheets for PostgreSQL

CREATE TABLE IF NOT EXISTS attendance_punches (
  id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(32) NOT NULL,
  date DATE NOT NULL,
  in_time VARCHAR(10) NOT NULL,
  out_lunch VARCHAR(10),
  in_lunch VARCHAR(10),
  out_time VARCHAR(10) NOT NULL,
  status VARCHAR(50) DEFAULT 'Regular',
  location VARCHAR(50) DEFAULT 'office',
  reg_hours DECIMAL(8,2) NOT NULL DEFAULT 8.00,
  ot_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_punches_emp_date ON attendance_punches (employee_id, date);

CREATE TABLE IF NOT EXISTS attendance_exceptions (
  id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(32) NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  suggested_action TEXT,
  resolved_by VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exceptions_emp ON attendance_exceptions (employee_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON attendance_exceptions (status);

CREATE TABLE IF NOT EXISTS statutory_holidays (
  id VARCHAR(64) PRIMARY KEY,
  date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  jurisdiction VARCHAR(50) NOT NULL,
  is_statutory BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(32) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  reason TEXT NOT NULL,
  hours_deducted DECIMAL(8,2) NOT NULL DEFAULT 8.00,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Supervisor',
  approved_by VARCHAR(100),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timesheets (
  id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(32) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  period_id VARCHAR(32) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Draft',
  step INT NOT NULL DEFAULT 0,
  regular_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  overtime_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  pto_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  holiday_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  total_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  supervisor_approved_by VARCHAR(100),
  supervisor_approved_at TIMESTAMPTZ,
  pm_approved_by VARCHAR(100),
  pm_approved_at TIMESTAMPTZ,
  return_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES pay_periods (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_timesheet_emp_period ON timesheets (employee_id, period_id);

CREATE TABLE IF NOT EXISTS timesheet_daily_hours (
  id VARCHAR(64) PRIMARY KEY,
  timesheet_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  regular_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  overtime_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  daily_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (timesheet_id) REFERENCES timesheets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  country VARCHAR(50) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  standard_daily_hours DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  standard_weekly_hours DECIMAL(5,2) NOT NULL DEFAULT 40.00,
  overtime_threshold_daily DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
