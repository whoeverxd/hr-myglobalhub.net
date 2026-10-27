require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const db = require('../src/db');
const firebaseService = require('../src/services/firebase.service');

const TABLES_TO_SYNC = [
  { table: 'organization_configs', collection: 'organizations', idCol: 'id' },
  { table: 'employees', collection: 'employees', idCol: 'id' },
  { table: 'pay_periods', collection: 'pay_periods', idCol: 'id' },
  { table: 'holidays', collection: 'holidays', idCol: 'id' },
  { table: 'payroll_adjustments', collection: 'payroll_adjustments', idCol: 'id' },
  { table: 'worklogs', collection: 'worklogs', idCol: 'id' },
  { table: 'timesheets', collection: 'timesheets', idCol: 'id' },
  { table: 'daily_activities', collection: 'daily_activities', idCol: 'id' },
  { table: 'attendance_punches', collection: 'attendance_punches', idCol: 'id' },
  { table: 'attendance_exceptions', collection: 'attendance_exceptions', idCol: 'id' },
  { table: 'leave_requests', collection: 'leave_requests', idCol: 'id' },
  { table: 'payment_proofs', collection: 'payment_proofs', idCol: 'id' },
  { table: 'users', collection: 'users', idCol: 'id' },
  { table: 'audit_logs', collection: 'audit_logs', idCol: 'id' },
  { table: 'contractors', collection: 'contractors', idCol: 'id' },
  { table: 'contractor_payments', collection: 'contractor_payments', idCol: 'id' },
  { table: 'payroll_runs', collection: 'payroll_runs', idCol: 'id' },
  { table: 'payroll_run_items', collection: 'payroll_run_items', idCol: 'id' },
  { table: 'sessions', collection: 'sessions', idCol: 'token' },
  { table: 'payroll_signoffs', collection: 'payroll_signoffs', idCol: 'id' },
  { table: 'rollout_stages', collection: 'rollout_stages', idCol: 'id' },
  { table: 'jira_projects', collection: 'jira_projects', idCol: 'key' },
  { table: 'jira_sync_status', collection: 'jira_sync_status', idCol: 'id' },
  { table: 'jira_issues_cache', collection: 'jira_issues_cache', idCol: 'issue_key' },
];

async function syncTable(firestore, tableConfig) {
  const { table, collection, idCol } = tableConfig;
  let rows = [];
  try {
    rows = db.query(`SELECT * FROM ${table}`);
  } catch (err) {
    console.warn(`  ⚠️  Tabla '${table}' no encontrada en SQLite o vacía. Omitiendo.`);
    return 0;
  }

  if (!rows || rows.length === 0) {
    console.log(`  ℹ️  ${table}: 0 registros encontrados.`);
    return 0;
  }

  // Firestore allows up to 500 operations per batch
  const BATCH_SIZE = 450;
  let totalCommitted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = firestore.batch();

    for (const row of chunk) {
      const docId = String(row[idCol] || `${table}_${Math.random().toString(36).substring(2, 9)}`);
      const docRef = firestore.collection(collection).doc(docId);

      // Clean undefined or JSON strings if needed
      const cleanData = {};
      for (const [key, value] of Object.entries(row)) {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      }
      cleanData._syncedAt = new Date().toISOString();

      batch.set(docRef, cleanData, { merge: true });
    }

    await batch.commit();
    totalCommitted += chunk.length;
  }

  console.log(`  ✅ ${table} -> coleccion '${collection}': ${totalCommitted} documentos sincronizados.`);
  return totalCommitted;
}

async function main() {
  console.log('\n=============================================================');
  console.log('   MGH Payroll — Migrador de SQLite a Cloud Firestore');
  console.log('=============================================================\n');

  if (!firebaseService.isConfigured()) {
    console.error('❌ Error: Credenciales de Firebase no encontradas.');
    console.error('Coloca el archivo en backend/config/firebase-service-account.json antes de sincronizar.\n');
    process.exit(1);
  }

  const firestore = firebaseService.getFirestore();
  console.log('🚀 Iniciando sincronización de datos relacionales hacia Firestore...\n');

  let totalDocs = 0;
  for (const t of TABLES_TO_SYNC) {
    const count = await syncTable(firestore, t);
    totalDocs += count;
  }

  console.log(`\n🎉 Sincronización completada con éxito. Total: ${totalDocs} documentos subidos a Firestore.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error durante la migración a Firestore:', err);
  process.exit(1);
});
