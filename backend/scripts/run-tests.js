const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testDir = path.join(__dirname, '..', 'test');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js')).sort();

const srcDb = path.join(__dirname, '..', 'data', 'payroll.db');
const testDb = path.join(__dirname, '..', 'data', 'test-run.db');

function cleanupTestDb() {
  for (const ext of ['', '-wal', '-shm']) {
    const f = testDb + ext;
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch (_) {}
    }
  }
}

// Ensure clean slate
cleanupTestDb();

// Clone db so tests never mutate dev/production data
if (fs.existsSync(srcDb)) {
  fs.copyFileSync(srcDb, testDb);
}

console.log(`\nEjecutando ${files.length} suites de pruebas en modo 100% LOCAL (SQLite aislado — Cero consumo de cuota Firebase)...\n`);

let passed = 0;
let failed = 0;

try {
  for (const file of files) {
    const filePath = path.join('test', file);
    process.stdout.write(`• ${file.padEnd(35)} `);
    const res = spawnSync('node', ['--test', filePath], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_CLIENT: 'sqlite',
        DISABLE_REMOTE_FIREBASE: 'true',
      }
    });

    if (res.status === 0) {
      passed++;
      console.log('✓ PASS');
    } else {
      failed++;
      console.log('✖ FAIL');
      console.error(res.stderr || res.stdout);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  cleanupTestDb();
}

console.log(`\nResultado: ${passed} pasados, ${failed} fallidos. Total: ${files.length} suites.\n`);
if (failed > 0) {
  process.exit(1);
}

