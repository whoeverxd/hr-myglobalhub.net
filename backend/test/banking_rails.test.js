const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const bankingRailsService = require('../src/services/banking-rails.service');
const bankingRailsController = require('../src/controllers/banking-rails.controller');
const { getAuditLogs } = require('../src/controllers/audit.controller');
const db = require('../src/db');
const payrollEngine = require('../src/services/payroll-engine.service');

// Payment files only come from an owner-approved run: build one from approved timesheets in its own quincena.
// Payment data is arranged explicitly on the employees of the run (and restored afterwards): the files must
// carry exactly these values and never invent a wallet, an account, an ID or a sample line.
const PERIOD = 'PP-2025-17'; // 1–15 September 2025
const NO_CRYPTO_PERIOD = 'PP-2024-23'; // 1–15 December 2024: a run where nobody is paid in USDC
const FAKE_IDS = ['0x71C836eB6F960a5D262F6C7741d7f6bEc5841094', '1234567890', '00100000000', 'Carlos Mendez', 'CARLOS MENDEZ', '0987654321', '00118945621', '131987654', '0123456789'];
const PAY_COLS = ['nid', 'acct', 'routing', 'crypto_wallet', 'crypto_alloc', 'crypto_asset', 'crypto_network', 'entity', 'loc', 'tax', 'cur'];
const COMPANY_ENV = { MGH_ACH_COMPANY_ID: '9133474018', MGH_BHD_COMPANY_ACCOUNT: '7001234567' };

const snapshot = new Map();
const savedEnv = {};
const fixture = {}; // { us, crypto, cryptoWallet, dr: [...] }

function setEmp(id, fields) {
  const cols = Object.keys(fields);
  db.execute(`UPDATE employees SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => fields[c]), id]);
}

function resetPeriod(periodId) {
  db.execute('DELETE FROM payroll_run_items WHERE run_id = ?', [`PR-${periodId}`]);
  db.execute('DELETE FROM payroll_runs WHERE id = ?', [`PR-${periodId}`]);
  db.execute('DELETE FROM timesheets WHERE period_id = ?', [periodId]);
}

function approveAllTimesheets(periodId) {
  for (const e of db.query(`SELECT id, name FROM employees WHERE status != 'Terminated'`)) {
    db.execute(
      `INSERT INTO timesheets (id, employee_id, employee_name, period_id, status, step_index, regular_hours, overtime_hours, pto_hours, holiday_hours, total_hours, history_json)
       VALUES (?, ?, ?, ?, 'Approved', 2, 80, 0, 0, 0, 80, '[]')`,
      [`TS-${periodId}-${e.id}`, e.id, e.name, periodId]
    );
  }
}

function assertNoFakeData(text, fakes = FAKE_IDS) {
  for (const fake of fakes) assert.ok(!text.includes(fake), `payment file must not contain invented value ${fake}`);
  assert.ok(!/0x71c8/i.test(text), 'payment file must not contain the old demo wallet');
}

function conflictOf(fn) {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
}

function assertConflictNaming(fn, emp, label) {
  const err = conflictOf(fn);
  assert.ok(err, `${label}: must throw instead of generating a file`);
  assert.equal(err.status, 409, `${label}: status 409 (${err.message})`);
  assert.ok(err.message.includes(emp.name), `${label}: message names ${emp.name}: ${err.message}`);
  assert.ok(err.message.includes(emp.id), `${label}: message names ${emp.id}: ${err.message}`);
  return err;
}

after(() => {
  for (const [id, row] of snapshot) setEmp(id, row);
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetPeriod(PERIOD);
  resetPeriod(NO_CRYPTO_PERIOD);
  if (fixture.createdNoCryptoPeriod) db.execute('DELETE FROM pay_periods WHERE id = ?', [NO_CRYPTO_PERIOD]);
});

test('Banking Rails: Paystub generation and verifiable fingerprint', () => {
  // Test contractor exempt employee
  const contractorStub = bankingRailsService.generatePaystub({
    employeeId: 'MGH-1043',
    periodId: 'PP-2025-08',
  });

  assert.ok(contractorStub.paystubId.startsWith('PS-PP-2025-08-MGH-1043'));
  assert.ok(contractorStub.fingerprint);
  assert.equal(contractorStub.employee.id, 'MGH-1043');
  assert.ok(contractorStub.earnings.grossPay > 0);
  assert.equal(contractorStub.netPay, contractorStub.earnings.grossPay); // Contractor has 0 statutory deductions

  // Test full-time employee with statutory tax/social security deductions
  const fulltimeStub = bankingRailsService.generatePaystub({
    employeeId: 'MGH-1042',
    periodId: 'PP-2025-08',
  });

  assert.ok(fulltimeStub.paystubId.startsWith('PS-PP-2025-08-MGH-1042'));
  assert.ok(fulltimeStub.earnings.grossPay > 0);
  assert.ok(fulltimeStub.deductions.lines.length >= 1, 'Full-time employee must have statutory deduction lines');
  assert.ok(fulltimeStub.deductions.total > 0);
  assert.ok(fulltimeStub.netPay < fulltimeStub.earnings.grossPay);
});

test('Banking Rails: setup — real payment data → approved timesheets → calculated → approved run; no files before approval', () => {
  for (const [k, v] of Object.entries(COMPANY_ENV)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
  resetPeriod(PERIOD);
  assert.throws(() => bankingRailsService.generateNachaFile({ periodId: PERIOD }), /No approved payroll run/);

  const emps = db.query(`SELECT * FROM employees WHERE status != 'Terminated' ORDER BY id`);
  assert.ok(emps.length >= 3, 'needs at least three active employees');
  emps.forEach((e, i) => {
    snapshot.set(e.id, Object.fromEntries(PAY_COLS.map((c) => [c, e[c] ?? null])));
    // Everyone is a Dominican bank payee with a full cédula and account, no crypto split
    setEmp(e.id, {
      nid: `402${String(1000000 + i).padStart(8, '0')}`,
      acct: `80${String(10000000 + i).padStart(8, '0')}`,
      routing: '021000021',
      crypto_wallet: null,
      crypto_alloc: 0,
      crypto_asset: null,
      crypto_network: null,
      entity: 'MGH Dominicana SRL',
      loc: 'Punta Cana, DR',
    });
  });
  // One US direct-deposit payee (NACHA) and one Dominican payee with 20% in USDC
  fixture.us = emps[0];
  setEmp(fixture.us.id, { entity: '', loc: 'Miami, FL', tax: null, cur: 'USD', routing: '026009593', acct: '55500011122' });
  fixture.crypto = emps[1];
  fixture.cryptoWallet = '0x1111222233334444555566667777888899990000';
  setEmp(fixture.crypto.id, { crypto_alloc: 20, crypto_asset: 'USDC', crypto_network: 'Base', crypto_wallet: fixture.cryptoWallet });
  fixture.dr = emps.slice(1).map((e) => db.getOne('SELECT * FROM employees WHERE id = ?', [e.id]));

  approveAllTimesheets(PERIOD);
  const run = payrollEngine.calculatePeriodPayroll({ periodId: PERIOD, saveAsRun: true });
  assert.ok(run.items.length >= 3);
  assert.throws(() => bankingRailsService.generateNachaFile({ periodId: PERIOD }), /No approved payroll run/, 'calculated is not enough');
  payrollEngine.approvePayrollRun(`PR-${PERIOD}`, 'Owner');
});

test('Banking Rails: NACHA ACH file format specification compliance with the real account', () => {
  const nacha = bankingRailsService.generateNachaFile({ periodId: PERIOD });

  assert.ok(nacha.content);
  assert.equal(nacha.format, 'NACHA-ACH');
  assert.equal(nacha.totalEntries, 1, 'only the US payee');
  assert.ok(nacha.recordsCount >= 10);
  assert.equal(nacha.recordsCount % 10, 0, 'NACHA file must be padded to a multiple of 10 records');

  const lines = nacha.content.split('\r\n');
  assert.equal(lines.length, nacha.recordsCount);
  lines.forEach((line, idx) => {
    assert.equal(line.length, 94, `Record at index ${idx} must be exactly 94 characters`);
  });
  assert.equal(lines[0][0], '1', 'First record must be File Header (Record 1)');
  assert.equal(lines[1][0], '5', 'Second record must be Batch Header (Record 5)');
  assert.ok(lines[1].includes('PAYROLL'), 'Batch header must specify PAYROLL');

  const entry = lines.find((l) => l[0] === '6');
  assert.ok(entry.includes('026009593'), 'entry carries the employee routing number');
  assert.ok(entry.includes('55500011122'), 'entry carries the employee account');
  assert.ok(entry.includes(fixture.us.id));
  assert.ok(lines[0].includes(COMPANY_ENV.MGH_ACH_COMPANY_ID), 'header carries the configured company id');
  assertNoFakeData(nacha.content);
});

test('Banking Rails: Banco BHD León dispersion carries the real cédula and account of each payee', () => {
  const bhd = bankingRailsService.generateBhdFile({ periodId: PERIOD, currency: 'DOP' });

  assert.ok(bhd.content);
  assert.equal(bhd.format, 'BANCO-BHD-LEON');
  assert.equal(bhd.currency, 'DOP');
  assert.equal(bhd.totalEntries, fixture.dr.length);
  assert.ok(bhd.totalAmount > 0);

  const lines = bhd.content.split('\r\n');
  assert.ok(lines[0].startsWith('H|133474018|'), 'Header carries the company RNC');
  assert.ok(lines[0].includes(COMPANY_ENV.MGH_BHD_COMPANY_ACCOUNT), 'Header carries the configured company account');
  assert.ok(lines[0].includes('DISPERSION NOMINA EMPRESARIAL'));

  const detailLines = lines.filter((l) => l.startsWith('D|'));
  assert.equal(detailLines.length, bhd.totalEntries);
  for (const e of fixture.dr) {
    const line = detailLines.find((l) => l.includes(`|${e.id}|`));
    assert.ok(line, `detail line for ${e.id}`);
    assert.ok(line.includes(`|${e.nid}|`), `${e.id} cédula`);
    assert.ok(line.includes(`|${e.acct}|`), `${e.id} account`);
  }
  // The USDC share of the split employee is not paid again by bank
  const cryptoItem = payrollEngine.getPayrollRunDetails(`PR-${PERIOD}`).items.find((i) => (i.employee_id || i.employeeId) === fixture.crypto.id);
  const bankShare = cryptoItem.payoutDistribution[0].amount;
  const cryptoLine = detailLines.find((l) => l.includes(`|${fixture.crypto.id}|`));
  assert.ok(cryptoLine.includes(`|${(Math.round(bankShare * 60.5 * 100) / 100).toFixed(2)}|`), 'only the bank share is dispersed by bank');
  assert.ok(lines.find((l) => l.startsWith('T|')), 'File must include trailer with checksum');
  assertNoFakeData(bhd.content);
});

test('Banking Rails: Base USDC batch pays the real wallet of the employee with a USDC split', () => {
  const usdc = bankingRailsService.generateUsdcPayoutBatch({ periodId: PERIOD });

  assert.equal(usdc.format, 'BASE-USDC-BATCH');
  assert.equal(usdc.batchPayload.chainId, 8453, 'Chain ID must be Base Mainnet 8453');
  assert.equal(usdc.batchPayload.tokenSymbol, 'USDC');
  assert.equal(usdc.batchPayload.tokenDecimals, 6);
  assert.equal(usdc.batchPayload.transactions.length, 1);
  assert.equal(usdc.totalEntries, 1);

  const tx = usdc.batchPayload.transactions[0];
  assert.ok(tx.data.startsWith('0xa9059cbb'), 'Must encode ERC20 transfer(address,uint256) selector');
  assert.ok(tx.data.includes(fixture.cryptoWallet.slice(2).toLowerCase()), 'transfer goes to the employee wallet');
  assert.equal(tx.meta.wallet, fixture.cryptoWallet);
  assert.equal(tx.meta.employeeId, fixture.crypto.id);
  assert.ok(tx.meta.amountUsdc > 0);
  assert.equal(usdc.totalUsdc, tx.meta.amountUsdc);
  assertNoFakeData(JSON.stringify(usdc));
});

test('Banking Rails: USDC amount without a valid wallet → 409 naming the employee, no file', () => {
  try {
    for (const bad of [null, '', '0x123', 'not-a-wallet', '0x71C836eB6F960a5D262F6C7741d7f6bEc584109Z']) {
      setEmp(fixture.crypto.id, { crypto_wallet: bad });
      const err = assertConflictNaming(() => bankingRailsService.generateUsdcPayoutBatch({ periodId: PERIOD }), fixture.crypto, `wallet ${bad}`);
      assert.match(err.message, /^No se puede generar el archivo USDC: falta billetera válida para .+\. Configure el método de pago o cambie el reparto a banco\.$/);
    }
  } finally {
    setEmp(fixture.crypto.id, { crypto_wallet: fixture.cryptoWallet });
  }
});

test('Banking Rails: bank line without account (or with only a masked one) → 409 naming every affected employee', () => {
  const [a, b] = fixture.dr;
  try {
    setEmp(a.id, { acct: null });
    setEmp(b.id, { acct: '••••1234' });
    const err = assertConflictNaming(() => bankingRailsService.generateBhdFile({ periodId: PERIOD }), a, 'BHD missing acct');
    assert.ok(err.message.includes(b.name) && err.message.includes(b.id), 'a masked account is not usable either and every employee is listed');
    assert.match(err.message, /^No se puede generar el archivo/);
    setEmp(a.id, { acct: a.acct });
    setEmp(b.id, { acct: b.acct });

    setEmp(a.id, { nid: null });
    assertConflictNaming(() => bankingRailsService.generateBhdFile({ periodId: PERIOD }), a, 'BHD missing cédula');
    setEmp(a.id, { nid: a.nid });

    setEmp(fixture.us.id, { acct: null });
    assertConflictNaming(() => bankingRailsService.generateNachaFile({ periodId: PERIOD }), fixture.us, 'NACHA missing acct');
    setEmp(fixture.us.id, { acct: '55500011122', routing: null });
    assertConflictNaming(() => bankingRailsService.generateNachaFile({ periodId: PERIOD }), fixture.us, 'NACHA missing routing');
  } finally {
    setEmp(a.id, { acct: a.acct, nid: a.nid });
    setEmp(b.id, { acct: b.acct });
    setEmp(fixture.us.id, { acct: '55500011122', routing: '026009593' });
  }

  // Back to complete data: files generate again
  assert.equal(bankingRailsService.generateBhdFile({ periodId: PERIOD }).totalEntries, fixture.dr.length);
  assert.equal(bankingRailsService.generateNachaFile({ periodId: PERIOD }).totalEntries, 1);
});

test('Banking Rails: company bank identifiers are never invented', () => {
  try {
    delete process.env.MGH_ACH_COMPANY_ID;
    delete process.env.MGH_BHD_COMPANY_ACCOUNT;
    assert.throws(() => bankingRailsService.generateNachaFile({ periodId: PERIOD }), (e) => e.status === 409 && /MGH_ACH_COMPANY_ID/.test(e.message));
    assert.throws(() => bankingRailsService.generateBhdFile({ periodId: PERIOD }), (e) => e.status === 409 && /MGH_BHD_COMPANY_ACCOUNT/.test(e.message));
  } finally {
    Object.assign(process.env, COMPANY_ENV);
  }
});

test('Banking Rails: a run with no USDC payouts → empty batch, no sample line', () => {
  if (!db.getOne('SELECT id FROM pay_periods WHERE id = ?', [NO_CRYPTO_PERIOD])) {
    db.execute(
      `INSERT INTO pay_periods (id, year, period_number, start_date, end_date, pay_date, cutoff, status, is_locked)
       VALUES (?, 2024, 23, '2024-12-01', '2024-12-15', '2024-12-20', '2024-12-15', 'Open', 0)`,
      [NO_CRYPTO_PERIOD]
    );
    fixture.createdNoCryptoPeriod = true;
  }
  setEmp(fixture.crypto.id, { crypto_alloc: 0 });
  try {
    resetPeriod(NO_CRYPTO_PERIOD);
    approveAllTimesheets(NO_CRYPTO_PERIOD);
    payrollEngine.calculatePeriodPayroll({ periodId: NO_CRYPTO_PERIOD, saveAsRun: true });
    payrollEngine.approvePayrollRun(`PR-${NO_CRYPTO_PERIOD}`, 'Owner');
  } finally {
    setEmp(fixture.crypto.id, { crypto_alloc: 20 });
  }
  const usdc = bankingRailsService.generateUsdcPayoutBatch({ periodId: NO_CRYPTO_PERIOD });
  assert.equal(usdc.totalEntries, 0);
  assert.equal(usdc.totalUsdc, 0);
  assert.equal(usdc.batchPayload.count, 0);
  assert.equal(usdc.batchPayload.totalAmountUsdc, 0);
  assert.deepEqual(usdc.batchPayload.transactions, []);
  assert.deepEqual(usdc.batchPayload.recipients, []);
  assertNoFakeData(JSON.stringify(usdc));
});

test('Banking Rails: nobody on a bank rail → empty bank file, no sample line', () => {
  // Nobody is in the US: NACHA has 0 entries and 0 total
  setEmp(fixture.us.id, { entity: 'MGH Dominicana SRL', loc: 'Punta Cana, DR' });
  try {
    const nacha = bankingRailsService.generateNachaFile({ periodId: PERIOD });
    assert.equal(nacha.totalEntries, 0);
    assert.equal(nacha.totalCreditUSD, 0);
    assert.ok(!nacha.content.split('\r\n').some((l) => l[0] === '6'), 'no entry records');
    // Zero-padded NACHA totals legitimately contain runs of zeros: check the non-numeric sample values only
    assertNoFakeData(nacha.content, ['CARLOS MENDEZ', 'MGH-1042 ']);
  } finally {
    setEmp(fixture.us.id, { entity: '', loc: 'Miami, FL' });
  }
});

test('Banking Rails: export route hands the 409 + Spanish message to the error handler', () => {
  setEmp(fixture.crypto.id, { crypto_wallet: null });
  let passed = null;
  try {
    bankingRailsController.exportUsdcBatch(
      { query: { periodId: PERIOD } },
      { json: () => assert.fail('must not answer a file'), send: () => assert.fail('must not send a file'), setHeader() {} },
      (err) => { passed = err; }
    );
  } finally {
    setEmp(fixture.crypto.id, { crypto_wallet: fixture.cryptoWallet });
  }
  assert.ok(passed, 'error goes to the error handler');
  assert.equal(passed.status, 409);
  assert.match(passed.message, /No se puede generar el archivo USDC/);
});

test('Banking Rails: Confirm USDC transaction hash validation and audit logging', () => {
  const dummyTx = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  let jsonRes = null;

  const mockReq = {
    body: {
      periodId: 'PP-2025-08',
      txHash: dummyTx,
      network: 'Base',
      totalUsdc: '850.00',
    },
    user: { name: 'Elena Rostova' },
    headers: {},
    socket: {},
  };

  const mockRes = {
    json: (data) => {
      jsonRes = data;
    },
  };

  bankingRailsController.confirmUsdcTransaction(mockReq, mockRes, (err) => {
    throw err;
  });

  assert.ok(jsonRes);
  assert.equal(jsonRes.ok, true);
  assert.equal(jsonRes.txHash, dummyTx);
  assert.equal(jsonRes.network, 'Base');

  // Verify audit log
  const audits = getAuditLogs({ entityType: 'payroll_run' });
  const audit = audits.find((a) => a.action === 'CONFIRM_USDC_PAYOUT');
  assert.ok(audit, 'Audit log must record CONFIRM_USDC_PAYOUT');
});
