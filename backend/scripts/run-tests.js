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
const failures = [];

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
        // The clone above was created and deleted without anything ever pointing at
        // it: connection.js reads DB_FILE, which was never set, so every test run
        // wrote straight into data/payroll.db -- the dev database. The suite said
        // "SQLite aislado" and was only half right.
        DB_FILE: testDb,
      }
    });

    if (res.status === 0) {
      passed++;
      console.log('✓ PASS');
    } else {
      // No fail-fast. Stopping at the first failure reported "20 pasados, 1 fallidos.
      // Total: 23 suites", which reads as 22/23 while hiding that 2 suites never ran.
      // A partial run that looks like a full one is worse than a red one.
      failures.push(file);
      console.log('✖ FAIL');
      console.error(res.stderr || res.stdout);
      process.exitCode = 1;
    }
  }
} finally {
  cleanupTestDb();
}

console.log(
  `\nResultado: ${passed} pasados, ${failures.length} fallidos, ${files.length} ejecutados de ${files.length} suites.`
);
if (failures.length > 0) {
  console.log(`Suites en rojo:\n${failures.map((f) => `  • ${f}`).join('\n')}\n`);
  process.exit(1);
}
console.log('');

