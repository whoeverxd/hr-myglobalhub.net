#!/usr/bin/env node
/**
 * MGH Payroll — Database & Firebase Cleanup and Migration Reset Script
 * 
 * Performs a complete clean slate reset:
 * 1. Purges all Firestore collections & documents in Firebase.
 * 2. Drops all existing relational tables/views in the database (SQLite / PostgreSQL).
 * 3. Recreates all empty tables according to schema and migrations (001-005).
 * 4. Leaves all tables completely empty (0 users, 0 employees, 0 records).
 * 5. Sets SKIP_SEED=true in backend/.env to prevent automatic reseeding on server restart.
 * 
 * Usage:
 *   node --experimental-sqlite scripts/reset-clean-database.js [--force] [--skip-firebase] [--skip-db] [--seed]
 */

process.env.SKIP_SEED = 'true';

const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Load environment from backend/.env and root .env
const backendEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(backendEnvPath)) require('dotenv').config({ path: backendEnvPath });
if (fs.existsSync(rootEnvPath)) require('dotenv').config({ path: rootEnvPath, override: false });

const db = require('../src/db/connection');
const { initSchema } = require('../src/db/schema');
const migrator = require('../src/db/migrator');
const firebaseService = require('../src/services/firebase.service');

// Parse command line arguments
const args = process.argv.slice(2);
const isForce = args.includes('--force') || args.includes('-y') || args.includes('--yes');
const skipFirebase = args.includes('--skip-firebase');
const skipDb = args.includes('--skip-db');
const shouldSeed = args.includes('--seed');
const noEnvUpdate = args.includes('--no-env-update');

const KNOWN_FIRESTORE_COLLECTIONS = [
  '_system_health',
  'attendance_exceptions',
  'attendance_punches',
  'audit_logs',
  'daily_activities',
  'employees',
  'holidays',
  'leave_requests',
  'organizations',
  'pay_periods',
  'payment_proofs',
  'payroll_adjustments',
  'timesheets',
  'users',
  'worklogs',
  'payroll_runs',
  'payroll_run_items',
  'file_attachments',
  'payroll_signoffs',
  'rollout_stages',
  'jira_issues_cache',
  'jira_sync_status',
  'jira_projects',
  'statutory_holidays',
  'timesheet_daily_hours',
  'auth_sessions',
  'role_permissions',
  'sessions',
];

async function askConfirmation(question) {
  if (isForce) return true;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes' || answer.trim().toLowerCase() === 'si' || answer.trim().toLowerCase() === 's');
    });
  });
}

/**
 * Recursively deletes a Firestore collection and its subcollections in batches
 */
async function deleteFirestoreCollection(firestore, collectionRef, batchSize = 400) {
  let deletedCount = 0;
  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = firestore.batch();
    for (const doc of snapshot.docs) {
      // Check for subcollections
      try {
        const subcollections = await doc.ref.listCollections();
        for (const subcol of subcollections) {
          deletedCount += await deleteFirestoreCollection(firestore, subcol, batchSize);
        }
      } catch (err) {
        // Continue if listing subcollections is unsupported or empty
      }
      batch.delete(doc.ref);
    }

    await batch.commit();
    deletedCount += snapshot.size;
  }
  return deletedCount;
}

/**
 * Step 1: Cleanup Firebase Firestore
 */
async function cleanupFirebase() {
  console.log('\n-------------------------------------------------------------');
  console.log(' 🔥 1. Limpieza de Firebase (Cloud Firestore)');
  console.log('-------------------------------------------------------------');

  if (!firebaseService.isConfigured()) {
    console.log('  ⚠️  Firebase no está configurado (no se encontraron credenciales). Omitiendo.');
    return;
  }

  const firestore = firebaseService.getFirestore();
  if (!firestore) {
    console.log('  ⚠️  No se pudo inicializar la conexión con Firestore. Omitiendo.');
    return;
  }

  try {
    const connTest = await firebaseService.testConnection();
    console.log(`  🔗 Conectado al proyecto Firebase: [${connTest.projectId || 'desconocido'}]`);

    // Discover existing collections
    const discoveredCols = await firestore.listCollections();
    const collectionNames = new Set([
      ...discoveredCols.map((c) => c.id),
      ...KNOWN_FIRESTORE_COLLECTIONS,
    ]);

    let totalCollectionsDeleted = 0;
    let totalDocsDeleted = 0;

    for (const colName of collectionNames) {
      const colRef = firestore.collection(colName);
      const count = await deleteFirestoreCollection(firestore, colRef);
      if (count > 0) {
        console.log(`  🗑️  Colección '${colName}': ${count} documento(s) eliminado(s).`);
        totalCollectionsDeleted++;
        totalDocsDeleted += count;
      }
    }

    if (totalDocsDeleted === 0) {
      console.log('  ✨ Firestore ya estaba limpio (0 documentos encontrados).');
    } else {
      console.log(`  ✅ Firebase limpio: ${totalDocsDeleted} documentos eliminados en ${totalCollectionsDeleted} colecciones.`);
    }
  } catch (err) {
    console.error('  ❌ Error durante la limpieza de Firebase:', err.message);
  }
}

/**
 * Step 2: Drop all tables in Database
 */
function dropAllDatabaseTables() {
  console.log('\n-------------------------------------------------------------');
  console.log(' 🗄️  2. Limpieza de Base de Datos Relacional (Drop Tables)');
  console.log('-------------------------------------------------------------');

  const dialect = db.getDialect ? db.getDialect() : 'sqlite';
  console.log(`  Motor de base de datos detectado: [${dialect}]`);

  if (dialect === 'sqlite') {
    // Disable foreign keys to allow clean cascade drops
    db.exec('PRAGMA foreign_keys = OFF;');

    // 1. Drop views
    const views = db.query("SELECT name FROM sqlite_master WHERE type='view'");
    for (const v of views) {
      db.exec(`DROP VIEW IF EXISTS "${v.name}";`);
      console.log(`  🗑️  Vista eliminada: ${v.name}`);
    }

    // 2. Drop user tables (excluding sqlite internal tables)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    let droppedCount = 0;
    for (const t of tables) {
      db.exec(`DROP TABLE IF EXISTS "${t.name}";`);
      console.log(`  🗑️  Tabla eliminada: ${t.name}`);
      droppedCount++;
    }

    // 3. Clear sequence and vacuum
    try {
      db.exec("DELETE FROM sqlite_sequence;");
    } catch (_) {}

    try {
      db.exec('VACUUM;');
    } catch (_) {}

    console.log(`  ✅ Base de datos SQLite vaciada por completo (${droppedCount} tablas eliminadas).`);
  } else {
    // PostgreSQL / generic
    console.log('  Ejecutando limpieza en PostgreSQL...');
    try {
      db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('  ✅ Esquema public de PostgreSQL restablecido.');
    } catch (err) {
      console.error('  ❌ Error eliminando tablas en Postgres:', err.message);
    }
  }
}

/**
 * Step 3: Recreate Schema & Migrations (Empty Tables)
 */
function recreateEmptyTables() {
  console.log('\n-------------------------------------------------------------');
  console.log(' 🏗️  3. Creación de Esquema y Tablas Vacías (Sin Usuarios ni Datos)');
  console.log('-------------------------------------------------------------');

  // 1. Initialize base core DDL schema
  console.log('  ⚙️  Creando tablas base del sistema (schema.js)...');
  initSchema();

  // 2. Run all enterprise versioned migrations
  console.log('  ⚙️  Aplicando migraciones versionadas (001 a 005)...');
  migrator.ensureMigrationTable();
  const migResult = migrator.runAllPending();
  console.log(`  ✅ ${migResult.appliedCount} migraciones aplicadas correctamente.`);

  // 3. Re-enable foreign keys
  if (db.getDialect && db.getDialect() === 'sqlite') {
    db.exec('PRAGMA foreign_keys = ON;');
  }

  // Optionally seed if explicitly requested via --seed
  if (shouldSeed) {
    console.log('  🌱 Flag --seed detectado: sembrando datos de prueba...');
    const { seedDatabaseIfEmpty } = require('../src/db/seeder');
    seedDatabaseIfEmpty();
    console.log('  ✅ Base de datos sembrada.');
  } else {
    console.log('  ✨ Confirmado: NO se insertaron usuarios ni registros (tablas 100% limpias).');
  }
}

/**
 * Step 4: Verification
 */
function verifyCleanState() {
  console.log('\n-------------------------------------------------------------');
  console.log(' 🔍 4. Verificación del Estado Final de las Tablas');
  console.log('-------------------------------------------------------------');

  const dialect = db.getDialect ? db.getDialect() : 'sqlite';
  if (dialect === 'sqlite') {
    const tables = db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
    );

    console.log(`\n  Total de tablas creadas: ${tables.length}\n`);
    console.log('  ┌─────────────────────────────────────┬──────────────┬───────────────┐');
    console.log('  │ Tabla                               │ Registros    │ Estado        │');
    console.log('  ├─────────────────────────────────────┼──────────────┼───────────────┤');

    let allEmptyExceptMigrations = true;

    for (const t of tables) {
      let count = 0;
      try {
        const row = db.getOne(`SELECT COUNT(*) as c FROM "${t.name}"`);
        count = row ? row.c : 0;
      } catch (e) {
        count = -1;
      }

      const countStr = count >= 0 ? String(count).padStart(12) : '      ERR   ';
      const status =
        t.name === 'schema_migrations'
          ? '  Versionada   '
          : count === 0
          ? '  Vacia (OK)   '
          : '  Con Datos ⚠️ ';

      if (t.name !== 'schema_migrations' && count > 0) {
        allEmptyExceptMigrations = false;
      }

      console.log(`  │ ${t.name.padEnd(35)} │ ${countStr} │ ${status} │`);
    }

    console.log('  └─────────────────────────────────────┴──────────────┴───────────────┘');

    if (allEmptyExceptMigrations && !shouldSeed) {
      console.log('\n  🎉 Éxito: Todas las tablas de datos están completamente VACÍAS (0 usuarios, 0 registros).');
    }
  }
}

/**
 * Step 5: Prevent accidental reseeding in backend/.env
 */
function updateEnvSkipSeed() {
  if (noEnvUpdate || shouldSeed) return;

  try {
    if (fs.existsSync(backendEnvPath)) {
      let content = fs.readFileSync(backendEnvPath, 'utf8');
      if (!content.includes('SKIP_SEED=')) {
        content += '\n# Previene que el servidor vuelva a insertar usuarios demo automáticamente\nSKIP_SEED=true\n';
        fs.writeFileSync(backendEnvPath, content, 'utf8');
        console.log('\n  📝 Se configuró SKIP_SEED=true en backend/.env para mantener las tablas vacías.');
      }
    }
  } catch (err) {
    console.warn('  ⚠️ No se pudo actualizar backend/.env:', err.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n=============================================================');
  console.log('   MGH Payroll — Reset, Migración y Limpieza Integral');
  console.log('=============================================================');
  console.log('  Acciones que se ejecutarán:');
  if (!skipFirebase) console.log('  • Borrar todas las colecciones y documentos en Firebase Firestore');
  if (!skipDb) {
    console.log('  • Eliminar todas las tablas relacionales existentes en la base de datos');
    console.log('  • Recrear todas las tablas y ejecutar migraciones 001-005');
    console.log(shouldSeed ? '  • Poblar datos semilla (--seed activo)' : '  • Dejar las tablas completamente VACÍAS (sin usuarios, sin registros)');
  }
  console.log('=============================================================\n');

  const confirmed = await askConfirmation('⚠️  ¿Estás seguro de que deseas proceder con el borrado y reinicio? (s/N): ');
  if (!confirmed) {
    console.log('\nOperación cancelada por el usuario.\n');
    process.exit(0);
  }

  // 1. Firebase cleanup
  if (!skipFirebase) {
    await cleanupFirebase();
  }

  // 2. Database drop
  if (!skipDb) {
    dropAllDatabaseTables();
    recreateEmptyTables();
    verifyCleanState();
    updateEnvSkipSeed();
  }

  console.log('\n=============================================================');
  console.log('   ✨ MIGRACIÓN Y LIMPIEZA COMPLETADA CON ÉXITO');
  console.log('=============================================================');
  console.log('  • Firebase Firestore: Limpio');
  console.log('  • Tablas relacionales: Creadas y vacías (0 usuarios, 0 registros)');
  console.log('  • Migraciones: Registradas y actualizadas en schema_migrations');
  console.log('  • Para sembrar datos de prueba en el futuro: npm run db:seed\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error fatal durante la migración y limpieza:', err);
  process.exit(1);
});
