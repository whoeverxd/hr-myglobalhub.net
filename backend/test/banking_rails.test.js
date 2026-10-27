const test = require('node:test');
const assert = require('node:assert/strict');
const bankingRailsService = require('../src/services/banking-rails.service');
const bankingRailsController = require('../src/controllers/banking-rails.controller');
const { getAuditLogs } = require('../src/controllers/audit.controller');

test('Banking Rails: NACHA ACH file format specification compliance', () => {
  const nacha = bankingRailsService.generateNachaFile({ periodId: 'PP-2025-08' });

  assert.ok(nacha.content);
  assert.equal(nacha.format, 'NACHA-ACH');
  assert.ok(nacha.totalEntries >= 1);
  assert.ok(nacha.recordsCount >= 10);
  assert.equal(nacha.recordsCount % 10, 0, 'NACHA file must be padded to a multiple of 10 records');

  const lines = nacha.content.split('\r\n');
  assert.equal(lines.length, nacha.recordsCount);

  // Every single record must be exactly 94 characters
  lines.forEach((line, idx) => {
    assert.equal(line.length, 94, `Record at index ${idx} must be exactly 94 characters`);
  });

  // Record 1: File Header
  assert.equal(lines[0][0], '1', 'First record must be File Header (Record 1)');
  // Record 2: Batch Header
  assert.equal(lines[1][0], '5', 'Second record must be Batch Header (Record 5)');
  assert.ok(lines[1].includes('PAYROLL'), 'Batch header must specify PAYROLL');
});

test('Banking Rails: Banco BHD León electronic dispersion file specification', () => {
  const bhd = bankingRailsService.generateBhdFile({ periodId: 'PP-2025-08', currency: 'DOP' });

  assert.ok(bhd.content);
  assert.equal(bhd.format, 'BANCO-BHD-LEON');
  assert.equal(bhd.currency, 'DOP');
  assert.ok(bhd.totalEntries >= 1);
  assert.ok(bhd.totalAmount > 0);

  const lines = bhd.content.split('\r\n');
  // First line is Header H
  assert.ok(lines[0].startsWith('H|'), 'Header record must start with H|');
  assert.ok(lines[0].includes('DISPERSION NOMINA EMPRESARIAL'));

  // Detail lines D
  const detailLines = lines.filter((l) => l.startsWith('D|'));
  assert.equal(detailLines.length, bhd.totalEntries);

  // Trailer line T
  const trailer = lines.find((l) => l.startsWith('T|'));
  assert.ok(trailer, 'File must include trailer with checksum');
});

test('Banking Rails: Base USDC crypto payout batch generation', () => {
  const usdc = bankingRailsService.generateUsdcPayoutBatch({ periodId: 'PP-2025-08' });

  assert.equal(usdc.format, 'BASE-USDC-BATCH');
  assert.equal(usdc.batchPayload.chainId, 8453, 'Chain ID must be Base Mainnet 8453');
  assert.equal(usdc.batchPayload.tokenSymbol, 'USDC');
  assert.equal(usdc.batchPayload.tokenDecimals, 6);
  assert.ok(usdc.batchPayload.transactions.length >= 1);

  const firstTx = usdc.batchPayload.transactions[0];
  assert.ok(firstTx.data.startsWith('0xa9059cbb'), 'Must encode ERC20 transfer(address,uint256) selector');
  assert.ok(firstTx.meta.recipient);
  assert.ok(firstTx.meta.amountUsdc > 0);
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
