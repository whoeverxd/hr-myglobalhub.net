require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const firebaseService = require('../src/services/firebase.service');

async function main() {
  console.log('\n======================================================');
  console.log('   MGH Timekeeping & Payroll — Test de Firebase');
  console.log('======================================================\n');

  const configured = firebaseService.isConfigured();
  if (!configured) {
    console.log('⚠️  ESTADO: Credenciales NO detectadas.');
    console.log('\nPara conectar:');
    console.log('1. Descarga la clave de servicio en formato JSON desde Firebase Console:');
    console.log('   Configuración del proyecto -> Cuentas de servicio -> Generar nueva clave privada');
    console.log('2. Guarda el archivo en:');
    console.log('   backend/config/firebase-service-account.json');
    console.log('3. Vuelve a ejecutar este comando.\n');
    process.exit(1);
  }

  console.log('🔍 Credenciales detectadas. Probando conexión en vivo con Cloud Firestore...');
  const result = await firebaseService.testConnection();

  if (result.connected) {
    console.log('✅ ¡CONEXIÓN EXITOSA CON CLOUD FIRESTORE!');
    console.log(`   - Proyecto: ${result.projectId}`);
    console.log(`   - Origen credencial: ${result.source}`);
    console.log(`   - Documento de sondeo creado/leído: _system_health/connection_probe`);
    console.log(`   - Timestamp: ${result.serverTimestamp}`);
    console.log('\nEl backend ya puede operar y sincronizar datos con Firebase.\n');
    process.exit(0);
  } else {
    console.error('❌ ESTADO DE FIRESTORE:');
    console.error(`   - Código: ${result.code}`);
    console.error(`   - Mensaje: ${result.error}`);

    if (result.needsDatabaseCreation) {
      console.log('\n👉 PASO PENDIENTE:');
      console.log(`   1. Entra a este enlace directo: https://console.firebase.google.com/project/${result.projectId}/firestore`);
      console.log('   2. Haz clic en el botón "Crear base de datos" ("Create database").');
      console.log('   3. Elige la ubicación (ej. nam5 o us-central1) y haz clic en "Habilitar".');
      console.log('   4. Una vez creada (toma ~30 segundos), vuelve a ejecutar este comando:');
      console.log('      npm run firebase:test\n');
    } else {
      console.log('\nSugerencia: Verifica la configuración y permisos en la consola de Firebase.');
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
