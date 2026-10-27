#!/usr/bin/env node
/**
 * MGH Payroll — Migrador Integral de Base de Datos y Colecciones a Cloud Firestore
 * Proyecto Destino: hr-myglobalhub-net
 */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const firebaseService = require('../src/services/firebase.service');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'firestore_cache.json');

async function migrate() {
  console.log('\n=============================================================');
  console.log('   MGH Payroll — Migrador a Proyecto Real: hr-myglobalhub-net');
  console.log('=============================================================\n');

  if (!fs.existsSync(CACHE_FILE)) {
    console.error(`❌ Error: No se encontró el archivo de datos ${CACHE_FILE}`);
    process.exit(1);
  }

  const rawCache = fs.readFileSync(CACHE_FILE, 'utf8');
  const cacheData = JSON.parse(rawCache);

  console.log('🔍 Probando conexión con el proyecto destino de Firebase...');
  const conn = await firebaseService.testConnection();

  if (!conn.connected) {
    console.error('\n❌ No se pudo conectar a Cloud Firestore en el proyecto destino:');
    console.error(`   - Código: ${conn.code}`);
    console.error(`   - Error:  ${conn.error}`);
    console.error('\n👉 Requisito pendiente:');
    console.error('   Otorga permisos de Administrador a la cuenta de servicio en Google Cloud IAM:');
    console.error('   1. Abre: https://console.cloud.google.com/iam-admin/iam?project=hr-myglobalhub-net');
    console.error('   2. Edita la cuenta servicebackend@hr-myglobalhub-net.iam.gserviceaccount.com');
    console.error('   3. Asigna los roles:');
    console.error('      • Firebase Admin SDK Administrator Service Agent (roles/firebase.admin)');
    console.error('      • Cloud Datastore User (roles/datastore.user)');
    console.error('   O descarga la clave privada directamente desde:');
    console.error('   Firebase Console -> Configuración del proyecto -> Cuentas de servicio -> Generar nueva clave privada.\n');
    process.exit(1);
  }

  console.log(`✅ Conexión confirmada con [${conn.projectId}]`);
  const firestore = firebaseService.getFirestore();

  const collections = Object.keys(cacheData).filter(c => !c.startsWith('_system'));
  console.log(`\n📦 Colecciones a migrar: ${collections.length}\n`);

  let grandTotalDocs = 0;
  const BATCH_SIZE = 400;

  for (const colName of collections) {
    const docsMap = cacheData[colName];
    const docEntries = Object.entries(docsMap || {});

    if (docEntries.length === 0) {
      console.log(`  ℹ️  ${colName.padEnd(25)} : 0 documentos (omitido)`);
      continue;
    }

    let colCommitted = 0;
    for (let i = 0; i < docEntries.length; i += BATCH_SIZE) {
      const chunk = docEntries.slice(i, i + BATCH_SIZE);
      const batch = firestore.batch();

      for (const [docId, docData] of chunk) {
        const id = String(docId || docData.id);
        const docRef = firestore.collection(colName).doc(id);

        const clean = {};
        for (const [k, v] of Object.entries(docData)) {
          if (v !== undefined) {
            clean[k] = v;
          }
        }
        clean._migratedAt = new Date().toISOString();

        batch.set(docRef, clean, { merge: true });
      }

      await batch.commit();
      colCommitted += chunk.length;
    }

    console.log(`  ✅ ${colName.padEnd(25)} : ${colCommitted} documentos subidos exitosamente.`);
    grandTotalDocs += colCommitted;
  }

  console.log('\n=============================================================');
  console.log(`🎉 MIGRACIÓN COMPLETADA: ${grandTotalDocs} documentos transferidos a hr-myglobalhub-net.`);
  console.log('=============================================================\n');
  process.exit(0);
}

migrate().catch(err => {
  console.error('\n❌ Error fatal durante la migración:', err);
  process.exit(1);
});
