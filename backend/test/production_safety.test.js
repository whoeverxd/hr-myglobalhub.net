// Production safety guards: everything here must hold with NO environment variable set in production.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const db = require('../src/db');
const routes = require('../src/routes');
const { authenticate } = require('../src/middleware/auth.middleware');
const runtime = require('../src/utils/runtime');
const { getUserName } = require('../src/utils/actor');
const { requirePeriodId } = require('../src/utils/period');
const { seedDatabaseIfEmpty } = require('../src/db/seeder');
const { generateSalt, hashPassword, roleForNewLogin } = require('../src/services/auth.service');
const payrollEngine = require('../src/services/payroll-engine.service');
const bankingRailsService = require('../src/services/banking-rails.service');
const payrollController = require('../src/controllers/payroll.controller');
const firestoreAdapter = require('../src/db/adapters/firestore.adapter');

const ENV_KEYS = ['NODE_TEST_CONTEXT', 'NODE_ENV', 'ALLOW_DEV_AUTH', 'ALLOW_DEV_RESET', 'STRICT_AUTH'];

// Runs fn with the given environment (undefined = unset), always restoring the original values
function withEnv(env, fn) {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  try {
    for (const k of ENV_KEYS) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
    return fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const PRODUCTION = {}; // nothing set
const IN_TEST = { NODE_ENV: 'test' };

function callAuth(headers = {}) {
  const req = { headers, originalUrl: '/api/employees' };
  const out = { status: 200, body: null, nextCalled: false };
  const res = {
    status(code) { out.status = code; return this; },
    json(body) { out.body = body; return this; },
  };
  authenticate(req, res, () => { out.nextCalled = true; });
  return { ...out, user: req.user };
}

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    res.status(err.status || 500).json({ error: err.message });
  });
  return http.createServer(app);
}

test('Auth: a request without a token is 401 outside a test process (no env var needed)', () => {
  const r = withEnv(PRODUCTION, () => callAuth({}));
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'Authentication required');
  assert.equal(r.nextCalled, false);
  assert.equal(r.user, undefined, 'no default PM context');
});

test('Auth: x-user-email / x-user headers are ignored outside test/dev', () => {
  const byEmail = withEnv(PRODUCTION, () => callAuth({ 'x-user-email': 'admin@myglobalhub.net' }));
  assert.equal(byEmail.status, 401);
  assert.equal(byEmail.nextCalled, false);
  const byName = withEnv(PRODUCTION, () => callAuth({ 'x-user': 'Admin System' }));
  assert.equal(byName.status, 401);
  // NODE_ENV=production does not matter either way: it is the absence of the opt-in that blocks
  const prod = withEnv({ NODE_ENV: 'production' }, () => callAuth({ 'x-user-email': 'admin@myglobalhub.net' }));
  assert.equal(prod.status, 401);
});

test('Auth: the dev fallback only runs in a test process or with ALLOW_DEV_AUTH=true; STRICT_AUTH wins', () => {
  const inTest = withEnv(IN_TEST, () => callAuth({ 'x-user-email': 'admin@myglobalhub.net' }));
  assert.equal(inTest.nextCalled, true);
  assert.equal(inTest.user.role, 'admin');

  const ctx = withEnv({ NODE_TEST_CONTEXT: 'child-v8' }, () => callAuth({}));
  assert.equal(ctx.nextCalled, true, 'node --test context keeps the fallback');

  const devOptIn = withEnv({ ALLOW_DEV_AUTH: 'true' }, () => callAuth({}));
  assert.equal(devOptIn.nextCalled, true);

  const devTrueish = withEnv({ ALLOW_DEV_AUTH: '1' }, () => callAuth({}));
  assert.equal(devTrueish.status, 401, "only the exact value 'true' opts in");

  const strict = withEnv({ ...IN_TEST, STRICT_AUTH: 'true' }, () => callAuth({}));
  assert.equal(strict.status, 401, 'STRICT_AUTH=true forces 401 even in tests');
});

test('Dev reset: refused on anything but SQLite, and on SQLite without the flag outside tests', () => {
  withEnv({ ALLOW_DEV_RESET: 'true' }, () => {
    assert.equal(runtime.devResetAllowed('firestore'), false);
    assert.equal(runtime.devResetAllowed('postgres'), false);
    assert.equal(runtime.devResetAllowed('sqlite'), true);
  });
  withEnv(PRODUCTION, () => assert.equal(runtime.devResetAllowed('sqlite'), false));
  withEnv(IN_TEST, () => {
    assert.equal(runtime.devResetAllowed('sqlite'), true);
    assert.equal(runtime.devResetAllowed('firestore'), false, 'not even in tests');
  });
});

test('Dev reset route: 404 when the active database is Firestore (nothing is wiped)', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const realGetDialect = db.getDialect;
  t.after(() => {
    db.getDialect = realGetDialect;
    server.close();
  });
  const before = db.getOne('SELECT COUNT(*) AS c FROM users').c;
  db.getDialect = () => 'firestore';
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/dev/reset`, {
    method: 'POST',
    headers: { 'x-user-email': 'admin@myglobalhub.net' },
  });
  assert.equal(res.status, 404);
  db.getDialect = realGetDialect;
  assert.equal(db.getOne('SELECT COUNT(*) AS c FROM users').c, before);

  // /firebase/status now needs an admin login (the default test context is a PM)
  const status = await fetch(`http://127.0.0.1:${server.address().port}/api/firebase/status`);
  assert.equal(status.status, 403);
});

test('Seeder: skips every dialect but SQLite', () => {
  assert.equal(runtime.seedingAllowed('firestore'), false);
  assert.equal(runtime.seedingAllowed('postgres'), false);
  assert.equal(runtime.seedingAllowed('sqlite'), true);
  const before = db.getOne('SELECT COUNT(*) AS c FROM users').c;
  assert.equal(seedDatabaseIfEmpty({ dialect: 'firestore' }), false);
  assert.equal(seedDatabaseIfEmpty({ dialect: 'postgres' }), false);
  assert.equal(db.getOne('SELECT COUNT(*) AS c FROM users').c, before);
});

test('Seeder: never overwrites the password of an existing account', () => {
  const u = db.getOne('SELECT id, password_hash, salt FROM users WHERE LOWER(email) = ?', ['joshua@myglobalhub.net']);
  assert.ok(u, 'seeded account');
  const salt = generateSalt();
  const hash = hashPassword('Real-Pass#2026', salt);
  db.execute('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [hash, salt, u.id]);
  try {
    assert.equal(seedDatabaseIfEmpty(), true);
    const after = db.getOne('SELECT password_hash, salt FROM users WHERE id = ?', [u.id]);
    assert.equal(after.password_hash, hash);
    assert.equal(after.salt, salt);
  } finally {
    db.execute('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [u.password_hash, u.salt, u.id]);
  }
});

test('Actor: from req.user.name, else "System"; never the x-user header', () => {
  assert.equal(getUserName({ headers: { 'x-user': 'Mallory' } }), 'System');
  assert.equal(getUserName({ headers: {}, user: { name: 'Ana Real' } }), 'Ana Real');
  assert.equal(getUserName({ headers: { 'x-user': 'Mallory' }, user: { name: 'Ana Real' } }), 'Ana Real');
  assert.equal(getUserName(undefined), 'System');
});

test('Roles: a login created on the fly is always employee', () => {
  assert.equal(roleForNewLogin(), 'employee');
});

test('Payroll engine: empty payout data stays empty, full accounts are masked, never ••••0000', () => {
  const base = { id: 'X-1', name: 'Test', rate: 10, entity: 'MGH Dominicana SRL' };
  const none = payrollEngine.calculateEmployeePeriodPayroll({ ...base, acct: null, bank: null, crypto_alloc: 20 }, { regHours: 10 });
  const [bank, crypto] = none.payoutDistribution;
  assert.equal(bank.accountMasked, '');
  assert.equal(bank.target, 'Sin cuenta registrada');
  assert.equal(crypto.accountMasked, '', 'no wallet → empty, not "Wallet"');
  assert.equal(crypto.target, '', 'no asset → empty, not "USDC"');
  assert.ok(!JSON.stringify(none).includes('••••0000'));
  assert.ok(!JSON.stringify(none).includes('Primary Bank Account'));

  const full = payrollEngine.calculateEmployeePeriodPayroll({ ...base, acct: '1029384756', bank: 'Banco BHD León' }, { regHours: 10 });
  assert.equal(full.payoutDistribution[0].accountMasked, '••••4756');
  const masked = payrollEngine.calculateEmployeePeriodPayroll({ ...base, acct: '••••4756' }, { regHours: 10 });
  assert.equal(masked.payoutDistribution[0].accountMasked, '••••4756');
});

test('Pay stub: no saved run → 404, never an estimated 80h stub', () => {
  db.execute('DELETE FROM payroll_run_items WHERE run_id = ?', ['PR-PP-2025-09']);
  db.execute('DELETE FROM payroll_runs WHERE id = ?', ['PR-PP-2025-09']);
  let caught = null;
  try {
    bankingRailsService.generatePaystub({ employeeId: 'MGH-1042', periodId: 'PP-2025-09' });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'must throw');
  assert.equal(caught.status, 404);
  assert.equal(caught.message, 'No hay recibo para ese período');
});

test('Periods: periodId is required, there is no default quincena', () => {
  assert.throws(() => requirePeriodId(undefined), (e) => e.status === 400 && e.message === 'periodId requerido');
  assert.throws(() => requirePeriodId('  '), (e) => e.status === 400);
  assert.equal(requirePeriodId('PP-2026-20'), 'PP-2026-20');

  let passed = null;
  payrollController.calculateRun({ body: {}, headers: {}, socket: {}, user: { name: 'T' } }, { json: () => {} }, (err) => { passed = err; });
  assert.equal(passed && passed.status, 400);
  assert.throws(() => bankingRailsService.generateNachaFile({}), (e) => e.status === 400);
});

test('Payroll preview: no fabricated contributor — inputs are required', () => {
  const run = (body, user = { role: 'admin', name: 'T' }) => {
    const out = { status: 200, body: null };
    const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
    payrollController.previewEmployee({ body, user, headers: {}, socket: {} }, res, (err) => { out.status = err.status || 500; });
    return out;
  };
  assert.equal(run({}).status, 400, 'hours required');
  assert.equal(run({ hours: 80 }).status, 400, 'employee or rate required');
  assert.equal(run({ employeeId: 'MGH-1042', hours: 80 }, { role: 'employee', employeeId: 'MGH-1044' }).status, 403);
  const ok = run({ hours: 10, rate: 20 });
  assert.equal(ok.status, 200);
  assert.notEqual(ok.body.name, 'Preview Contributor');
});

test('Firestore adapter: a successful hydration replaces the cache (deleted docs do not come back)', () => {
  const adapter = Object.create(Object.getPrototypeOf(firestoreAdapter));
  adapter.cache = new Map([
    ['employees', new Map([['E1', { id: 'E1' }], ['E-DELETED', { id: 'E-DELETED' }]])],
    ['only_local', new Map([['L1', { id: 'L1' }]])],
  ]);
  const fresh = new Map([['employees', new Map([['E1', { id: 'E1', name: 'remote' }]])], ['users', new Map()]]);
  const journal = [
    { col: 'users', id: 'U-NEW', doc: { id: 'U-NEW' } },
    { col: 'employees', id: 'E1', doc: null },
  ];
  adapter._applyHydration(fresh, journal);
  assert.equal(adapter.cache.has('only_local'), false, 'local-only collection dropped');
  assert.equal(adapter.cache.get('employees').has('E-DELETED'), false, 'remotely deleted doc not resurrected');
  assert.equal(adapter.cache.get('employees').has('E1'), false, 'delete made during hydration replayed');
  assert.ok(adapter.cache.get('users').has('U-NEW'), 'write made during hydration replayed');
});
