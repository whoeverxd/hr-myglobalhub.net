#!/usr/bin/env node
/**
 * MGH Payroll — Standalone Seeder Script
 * 
 * Re-populates the database with initial sample users, employees, pay periods,
 * and configuration for development or testing on demand.
 * 
 * Usage:
 *   node --experimental-sqlite scripts/seed-database.js
 */

process.env.SKIP_SEED = 'false';
process.env.AUTO_SEED = 'true';

const path = require('path');
const fs = require('fs');

const backendEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(backendEnvPath)) require('dotenv').config({ path: backendEnvPath });

const db = require('../src/db');
const { seedDatabaseIfEmpty } = require('../src/db/seeder');

console.log('\n=============================================================');
console.log('   MGH Payroll — Sembrador de Datos Demo / Testing');
console.log('=============================================================\n');

try {
  seedDatabaseIfEmpty();
  console.log('\n✅ Base de datos sembrada con éxito.');
  
  const userCount = db.getOne('SELECT COUNT(*) as c FROM users').c;
  const empCount = db.getOne('SELECT COUNT(*) as c FROM employees').c;
  const periodCount = db.getOne('SELECT COUNT(*) as c FROM pay_periods').c;
  
  console.log(`  • Usuarios: ${userCount}`);
  console.log(`  • Empleados: ${empCount}`);
  console.log(`  • Periodos de pago: ${periodCount}`);
  console.log('\n=============================================================\n');
} catch (err) {
  console.error('❌ Error sembrando base de datos:', err);
  process.exit(1);
}
