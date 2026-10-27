-- Migration: 006_contractors.sql
-- Contractors and Contractor Payments for MGH Payroll & Timekeeping

CREATE TABLE IF NOT EXISTS contractors (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(150) NOT NULL,
  country VARCHAR(100) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(50),
  start_date VARCHAR(50),
  end_date VARCHAR(50),
  basis VARCHAR(30) NOT NULL DEFAULT 'Hourly',
  rate REAL NOT NULL DEFAULT 0,
  cur VARCHAR(10) NOT NULL DEFAULT 'USD',
  method VARCHAR(30) NOT NULL DEFAULT 'Coinbase',
  wallet VARCHAR(150),
  wallet_full TEXT,
  asset VARCHAR(20) DEFAULT 'USDC',
  network VARCHAR(30) DEFAULT 'Base',
  delivery VARCHAR(30) DEFAULT 'Cash Pickup',
  receiver VARCHAR(150),
  city VARCHAR(100),
  bank VARCHAR(100),
  acct VARCHAR(100),
  pay_cur VARCHAR(10) DEFAULT 'USD',
  fx REAL DEFAULT 1.0,
  wu_fee REAL DEFAULT 4.99,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  entity VARCHAR(100) NOT NULL DEFAULT 'MGH Dominicana SRL',
  employee_id VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contractors_status ON contractors (status);
CREATE INDEX IF NOT EXISTS idx_contractors_country ON contractors (country);
CREATE INDEX IF NOT EXISTS idx_contractors_employee ON contractors (employee_id);

CREATE TABLE IF NOT EXISTS contractor_payments (
  id VARCHAR(64) PRIMARY KEY,
  contractor_id VARCHAR(32) NOT NULL,
  period_id VARCHAR(32) NOT NULL DEFAULT 'PP-2025-08',
  hours REAL,
  amount REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Calculated',
  date VARCHAR(50),
  cb_id VARCHAR(64),
  hash VARCHAR(128),
  mtcn VARCHAR(64),
  notes TEXT,
  receipt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (contractor_id) REFERENCES contractors (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cpay_contractor ON contractor_payments (contractor_id);
CREATE INDEX IF NOT EXISTS idx_cpay_period ON contractor_payments (period_id);
CREATE INDEX IF NOT EXISTS idx_cpay_status ON contractor_payments (status);
