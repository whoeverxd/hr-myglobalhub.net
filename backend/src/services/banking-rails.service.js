const crypto = require('crypto');
const db = require('../db');
const { round2 } = require('../utils/money');
const payrollEngine = require('./payroll-engine.service');
const { requirePeriodId } = require('../utils/period');
const { todayLocal } = require('../utils/today');
const payoutMethods = require('./payout-methods.service');

// Payment files are only produced from the payroll run the owner approved (never computed on the fly)
function approvedRunOrThrow(periodId) {
  requirePeriodId(periodId);
  const run = payrollEngine.getPayrollRunDetails(`PR-${periodId}`);
  if (!run || !Array.isArray(run.items) || !run.items.length || !['Approved', 'Paid'].includes(run.status)) {
    const err = new Error(`No approved payroll run for ${periodId}: calculate and approve it before generating payment files`);
    err.status = 409;
    throw err;
  }
  return run;
}

// Utility pad functions
const padRight = (str, len, char = ' ') => String(str || '').slice(0, len).padEnd(len, char);
const padLeft = (str, len, char = '0') => String(str || '').slice(0, len).padStart(len, char);

// ---- Payment data guards: a payment file carries real data or is not generated (never a placeholder) ----
const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

function conflict(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

// Employees of the run (terminated ones included: the approved run, not the current status, decides who is paid)
function employeeMap() {
  return new Map(db.query('SELECT * FROM employees').map((e) => [e.id, e]));
}

// Lines paid through a registered method carry their channel (bank | usdc | manual); legacy lines are classified
// as before (Coinbase / USDC = crypto, anything else = bank)
const channelOfLine = (p) => p.channel || (p.target === 'USDC' || String(p.rail || '').includes('Coinbase') ? 'usdc' : 'bank');

// Amount of an item on each rail; a share is only ever paid through one of them
function railAmounts(item) {
  const dist = Array.isArray(item.payoutDistribution) ? item.payoutDistribution : [];
  if (!dist.length) return { bank: round2(Number(item.net_pay ?? item.netPay) || 0), crypto: 0, manual: 0 };
  const out = { bank: 0, usdc: 0, manual: 0 };
  for (const p of dist) out[channelOfLine(p)] = (out[channelOfLine(p)] || 0) + (Number(p.amount) || 0);
  return { bank: round2(out.bank), crypto: round2(out.usdc), manual: round2(out.manual) };
}

// The registered method a line was paid to (full details), when the run was calculated with one
function methodOf(item, channel) {
  const dist = Array.isArray(item.payoutDistribution) ? item.payoutDistribution : [];
  const line = dist.find((p) => p.methodId && channelOfLine(p) === channel);
  return line ? payoutMethods.byId(line.methodId) : null;
}

// Full number only: masked ("••••1234"), empty or non-numeric values are not usable for a payment
function fullDigits(value, { min, max }) {
  const s = String(value ?? '').trim();
  if (!s || !/^[0-9][0-9 -]*$/.test(s)) return '';
  const digits = s.replace(/\D/g, '');
  return digits.length >= min && digits.length <= max ? digits : '';
}

function validAbaRouting(value) {
  const r = fullDigits(value, { min: 9, max: 9 });
  if (!r) return '';
  const d = r.split('').map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0 ? r : '';
}

const who = (m) => `${m.name || 'Empleado sin nombre'} (${m.id})`;

function throwIfMissingBankData(fileLabel, missing) {
  if (!missing.length) return;
  const list = missing.map((m) => `${who(m)}: ${m.fields.join(', ')}`).join('; ');
  throw conflict(
    `No se puede generar el archivo ${fileLabel}: faltan datos bancarios completos para ${list}. ` +
    'Registre los datos completos (no enmascarados) en el método de pago del empleado o cambie el reparto.'
  );
}

function requiredSetting(value, envName, fileLabel, label) {
  const v = String(value ?? '').trim();
  if (!v) {
    throw conflict(`No se puede generar el archivo ${fileLabel}: falta configurar ${label} de la empresa (${envName}).`);
  }
  return v;
}

/**
 * Banking Rails & Payment Settlement Service
 */
const bankingRailsService = {
  /**
   * Generates a fully compliant 94-character NACHA ACH file for US payroll distribution
   */
  generateNachaFile({
    periodId,
    companyName = 'MY GLOBAL HUB',
    companyId = process.env.MGH_ACH_COMPANY_ID,
    originDfi = '02100002',
    destDfi = '02100002',
    effectiveDate = null,
  } = {}) {
    // 1. Only the owner-approved run
    const run = approvedRunOrThrow(periodId);
    companyId = requiredSetting(companyId, 'MGH_ACH_COMPANY_ID', 'NACHA', 'el identificador ACH');

    const payDate = run.payDate || todayLocal();
    const effDateFormatted = (effectiveDate || payDate).replace(/-/g, '').slice(2); // YYMMDD
    const todayFormatted = todayLocal().slice(2).replace(/-/g, ''); // YYMMDD
    const nowTimeFormatted = new Date().toTimeString().slice(0, 5).replace(/:/g, ''); // HHMM

    // US direct-deposit payees of the run (bank share only; the crypto share goes in the USDC batch)
    const empMap = employeeMap();

    const entries = [];
    const missing = [];
    let totalCreditCents = 0;
    let entryHashSum = 0;

    run.items.forEach((item, index) => {
      const empId = item.employee_id || item.employeeId;
      const emp = empMap.get(empId) || {};
      const empName = item.employee_name || item.name || emp.name;
      const isUS = (emp.entity && emp.entity.includes('US')) ||
                   (emp.loc && (emp.loc.includes('US') || emp.loc.includes('NY') || emp.loc.includes('Miami'))) ||
                   (emp.cur === 'USD' && !emp.entity?.includes('Dominicana') && !emp.entity?.includes('UK'));

      if (!isUS) return;

      const payoutAmount = railAmounts(item).bank;
      if (!(payoutAmount > 0)) return;

      const m = methodOf(item, 'bank');
      const routing = validAbaRouting(m ? m.details.routing : emp.routing);
      const accountNumber = fullDigits(m ? m.details.account_number : emp.acct, { min: 4, max: 17 });
      const fields = [];
      if (!routing) fields.push('número de ruta ABA');
      if (!accountNumber) fields.push('cuenta');
      if (fields.length) {
        missing.push({ id: empId, name: empName, fields });
        return;
      }

      const cents = Math.round(payoutAmount * 100);
      totalCreditCents += cents;

      const routing8 = routing.slice(0, 8);
      const checkDigit = routing.slice(8, 9);
      entryHashSum += Number(routing8);

      entries.push({
        seq: index + 1,
        routing8,
        checkDigit,
        accountNumber,
        cents,
        employeeId: empId,
        name: String(empName || '').toUpperCase(),
      });
    });

    throwIfMissingBankData('NACHA', missing);

    const records = [];

    // File Header (Record 1) - 94 chars
    records.push(
      '1' +
      '01' +
      padLeft(destDfi, 10, ' ') +
      padLeft(companyId, 10, ' ') +
      padRight(todayFormatted, 6) +
      padRight(nowTimeFormatted, 4) +
      'A' +
      '094' +
      '10' +
      '1' +
      padRight('CHASE NA NEW YORK', 23) +
      padRight(companyName, 23) +
      padRight('MGH0001', 8)
    );

    // Company/Batch Header (Record 5) - 94 chars
    records.push(
      '5' +
      '220' +
      padRight(companyName, 16) +
      padRight('', 20) +
      padLeft(companyId, 10, '0') +
      'PPD' +
      padRight('PAYROLL', 10) +
      padRight(todayFormatted, 6) +
      padRight(effDateFormatted, 6) +
      '   ' +
      '1' +
      padLeft(originDfi.slice(0, 8), 8, '0') +
      '0000001'
    );

    // Entry Details (Record 6) - 94 chars each
    entries.forEach((entry, idx) => {
      const traceNum = padLeft(originDfi.slice(0, 8), 8, '0') + padLeft(idx + 1, 7, '0');
      records.push(
        '6' +
        '22' + // Checking Credit
        padRight(entry.routing8, 8) +
        entry.checkDigit +
        padRight(entry.accountNumber, 17) +
        padLeft(entry.cents, 10, '0') +
        padRight(entry.employeeId, 15) +
        padRight(entry.name, 22) +
        '  ' +
        '0' +
        padRight(traceNum, 15)
      );
    });

    // Hash mod 10^10
    const entryHashFormatted = padLeft(String(entryHashSum).slice(-10), 10, '0');

    // Batch Control (Record 8) - 94 chars
    records.push(
      '8' +
      '220' +
      padLeft(entries.length, 6, '0') +
      entryHashFormatted +
      padLeft('0', 12, '0') + // Total Debit
      padLeft(totalCreditCents, 12, '0') + // Total Credit
      padLeft(companyId, 10, '0') +
      padRight('', 19) +
      padRight('', 6) +
      padLeft(originDfi.slice(0, 8), 8, '0') +
      '0000001'
    );

    // File Control (Record 9) - 94 chars
    const totalLinesBeforeBlock = records.length + 1; // +1 for record 9
    const blockCount = Math.ceil(totalLinesBeforeBlock / 10);

    records.push(
      '9' +
      '000001' + // Batch count
      padLeft(blockCount, 6, '0') +
      padLeft(entries.length, 8, '0') +
      entryHashFormatted +
      padLeft('0', 12, '0') +
      padLeft(totalCreditCents, 12, '0') +
      padRight('', 39)
    );

    // Pad block with 9999999... up to a multiple of 10 records
    while (records.length % 10 !== 0) {
      records.push('9'.repeat(94));
    }

    const nachaContent = records.join('\r\n');

    return {
      format: 'NACHA-ACH',
      fileName: `NACHA_PAYROLL_${periodId}_${todayFormatted}.ach`,
      totalEntries: entries.length,
      totalCreditUSD: round2(totalCreditCents / 100),
      recordsCount: records.length,
      content: nachaContent,
    };
  },

  /**
   * Generates Banco BHD León Electronic Payroll Dispersion format (Dominican Republic)
   */
  generateBhdFile({
    periodId,
    companyRnc = process.env.MGH_BHD_COMPANY_RNC || '133474018', // My Global Hub Dominicana SRL
    companyAccount = process.env.MGH_BHD_COMPANY_ACCOUNT,
    currency = 'DOP',
  } = {}) {
    const run = approvedRunOrThrow(periodId);
    companyAccount = requiredSetting(companyAccount, 'MGH_BHD_COMPANY_ACCOUNT', 'BHD', 'la cuenta de débito');

    const payDate = run.payDate || todayLocal();
    const dateFormatted = payDate.replace(/-/g, '');

    const empMap = employeeMap();

    const entries = [];
    const missing = [];
    let totalAmount = 0;

    run.items.forEach((item) => {
      const empId = item.employee_id || item.employeeId;
      const emp = empMap.get(empId) || {};
      const empName = item.employee_name || item.name || emp.name;
      const isDR = (emp.entity && emp.entity.includes('Dominicana')) ||
                   (emp.loc && emp.loc.includes('DR')) ||
                   (emp.tax && emp.tax.includes('DGII'));

      if (!isDR) return;

      // Bank share only: the crypto share of a split goes in the USDC batch
      const payoutAmount = railAmounts(item).bank;
      if (!(payoutAmount > 0)) return;

      // The file declares the document as Cédula (11 digits) and needs the full account number
      const m = methodOf(item, 'bank');
      const nidClean = fullDigits((m && m.details.holder_id) || emp.nid, { min: 11, max: 11 });
      const acctClean = fullDigits(m ? m.details.account_number : emp.acct, { min: 6, max: 20 });
      const fields = [];
      if (!acctClean) fields.push('cuenta');
      if (!nidClean) fields.push('cédula');
      if (fields.length) {
        missing.push({ id: empId, name: empName, fields });
        return;
      }

      // In Dominican Republic contracts, convert USD rate to DOP at official rate (e.g. 60.50) if currency is DOP
      const fxRate = currency === 'DOP' ? 60.50 : 1.0;
      const amountLocal = round2(payoutAmount * fxRate);
      totalAmount = round2(totalAmount + amountLocal);

      entries.push({
        empId,
        name: empName,
        docType: 'C', // C = Cedula
        docNumber: nidClean,
        accountType: m && m.details.account_type === 'Corriente' ? 'CTE' : 'AHO', // Ahorro / Corriente
        accountNumber: acctClean,
        amount: amountLocal,
        concept: `NOMINA MGH ${periodId}`,
      });
    });

    throwIfMissingBankData('BHD', missing);

    const lines = [];

    // Header record
    lines.push(`H|${companyRnc}|${companyAccount}|${dateFormatted}|${currency}|${entries.length}|${totalAmount.toFixed(2)}|DISPERSION NOMINA EMPRESARIAL`);

    // Detail records
    entries.forEach((e) => {
      lines.push(
        `D|${e.docType}|${e.docNumber}|${String(e.name || '').toUpperCase()}|${e.accountType}|${e.accountNumber}|${e.amount.toFixed(2)}|${e.empId}|${e.concept}`
      );
    });

    // Trailer / Checksum
    const checksum = crypto.createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16);
    lines.push(`T|${entries.length}|${totalAmount.toFixed(2)}|${checksum}`);

    const fileContent = lines.join('\r\n');

    return {
      format: 'BANCO-BHD-LEON',
      fileName: `BHD_DISPERSION_${periodId}_${dateFormatted}.txt`,
      totalEntries: entries.length,
      currency,
      totalAmount,
      content: fileContent,
    };
  },

  /**
   * Generates Base USDC Crypto Payout Batch (Coinbase / Web3 multisig standard)
   */
  generateUsdcPayoutBatch({
    periodId,
    network = 'Base',
    tokenAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Official Base USDC contract
  } = {}) {
    const run = approvedRunOrThrow(periodId);

    const empMap = employeeMap();

    const batchPayouts = [];
    const missing = [];
    let totalUsdc = 0;

    run.items.forEach((item) => {
      const empId = item.employee_id || item.employeeId;
      const emp = empMap.get(empId) || {};
      const empName = item.employee_name || item.name || emp.name;

      const usdcAmt = railAmounts(item).crypto;
      if (!(usdcAmt > 0)) return;

      // Never substitute an address: a transfer to an unknown wallet is lost for good
      const m = methodOf(item, 'usdc');
      const wallet = String((m ? m.details.address : emp.crypto_wallet) ?? '').trim();
      if (!WALLET_RE.test(wallet)) {
        missing.push({ id: empId, name: empName });
        return;
      }
      totalUsdc = round2(totalUsdc + usdcAmt);
      const usdcUnits = Math.round(usdcAmt * 1e6); // USDC has 6 decimals

      batchPayouts.push({
        employeeId: empId,
        name: empName,
        wallet,
        amountUsdc: usdcAmt,
        units: usdcUnits.toString(),
        token: 'USDC',
        network,
      });
    });

    if (missing.length) {
      throw conflict(
        `No se puede generar el archivo USDC: falta billetera válida para ${missing.map(who).join(', ')}. ` +
        'Configure el método de pago o cambie el reparto a banco.'
      );
    }

    const batchPayload = {
      version: '1.0',
      chainId: 8453, // Base Mainnet
      network,
      tokenContract: tokenAddress,
      tokenSymbol: 'USDC',
      tokenDecimals: 6,
      periodId,
      totalAmountUsdc: totalUsdc,
      count: batchPayouts.length,
      createdAt: new Date().toISOString(),
      transactions: batchPayouts.map((p) => ({
        to: tokenAddress,
        value: '0',
        data: `0xa9059cbb000000000000000000000000${p.wallet.replace('0x', '').toLowerCase().padStart(64, '0')}${BigInt(p.units).toString(16).padStart(64, '0')}`,
        meta: {
          recipient: p.name,
          employeeId: p.employeeId,
          wallet: p.wallet,
          amountUsdc: p.amountUsdc,
        },
      })),
      recipients: batchPayouts,
    };

    return {
      format: 'BASE-USDC-BATCH',
      fileName: `BASE_USDC_PAYOUT_${periodId}.json`,
      totalEntries: batchPayouts.length,
      totalUsdc,
      batchPayload,
    };
  },

  /**
   * Payments that no file covers (Western Union, PayPal, crypto other than USDC on Base): a CSV with the full
   * destination of each one, to be paid by hand. Same rule as the files: only the approved run, never a guess.
   */
  generateManualPayouts({ periodId }) {
    const run = approvedRunOrThrow(periodId);
    const empMap = employeeMap();
    const rows = [];
    const missing = [];
    run.items.forEach((item) => {
      const amount = railAmounts(item).manual;
      if (!(amount > 0)) return;
      const empId = item.employee_id || item.employeeId;
      const empName = item.employee_name || item.name || (empMap.get(empId) || {}).name;
      const m = methodOf(item, 'manual');
      if (!m) { missing.push({ id: empId, name: empName }); return; }
      const fields = Object.entries(m.details).map(([k, v]) => `${k}=${v}`).join('; ');
      rows.push([empId, empName, m.typeLabel, m.details.currency ? `${m.details.currency} (${m.details.network})` : '', m.details.address || m.details.email || m.details.document_number || '', fields, amount.toFixed(2)]);
    });
    if (missing.length) {
      throw conflict(`No se puede generar la lista de pagos manuales: el método de pago de ${missing.map(who).join(', ')} ya no existe. Vuelve a calcular la nómina.`);
    }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['ID', 'Empleado', 'Método', 'Moneda (red)', 'Destino', 'Datos completos', 'Monto USD'];
    const total = round2(rows.reduce((t, r) => t + Number(r[6]), 0));
    return {
      format: 'MANUAL-PAYOUTS-CSV',
      fileName: `PAGOS_MANUALES_${periodId}.csv`,
      totalEntries: rows.length,
      totalUsd: total,
      content: [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n'),
    };
  },

  /**
   * Generates a formal, printable and verifiable paystub (Comprobante de Pago)
   */
  generatePaystub({ employeeId, periodId }) {
    requirePeriodId(periodId);
    const employee = db.getOne(`SELECT * FROM employees WHERE id = ?`, [employeeId]);
    if (!employee) {
      const err = new Error(`Employee ${employeeId} not found`);
      err.status = 404;
      throw err;
    }

    // A pay stub only exists for a real period with a stub saved by an actual payroll run. Hours, amounts and
    // dates are never estimated or borrowed from another period.
    const period = db.getOne(`SELECT * FROM pay_periods WHERE id = ?`, [periodId]);
    const saved = period
      ? payrollEngine.listEmployeePaystubs(employee.id, { issuedOnly: false }).find((s) => s.periodId === period.id)
      : null;
    if (!saved) {
      const err = new Error('No hay recibo para ese período');
      err.status = 404;
      throw err;
    }
    const calc = {
      hours: { regular: saved.regHours, overtime: saved.otHours, pto: saved.ptoHours, total: saved.regHours + saved.otHours + saved.ptoHours },
      earnings: {
        regular: +(saved.regHours * saved.rate).toFixed(2),
        overtime: +(saved.otHours * saved.rate * 1.5).toFixed(2),
        pto: +(saved.ptoHours * saved.rate).toFixed(2),
        adjustments: +saved.adjustments.reduce((sum, a) => sum + (a.amount > 0 ? a.amount : 0), 0).toFixed(2),
        grossPay: saved.grossPay,
      },
      deductions: { lines: saved.deductions, total: saved.totalDeductions },
      netPay: saved.netPay,
      payoutDistribution: saved.payoutDistribution,
    };
    const entity = (saved && saved.entity) || employee.entity || 'My Global Hub';
    const isDR = /dominicana/i.test(entity);

    const stubFingerprint = crypto
      .createHash('sha256')
      .update(`${employee.id}-${period.id}-${calc.netPay}`)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();

    const paystubData = {
      paystubId: `PS-${period.id}-${employee.id}`,
      fingerprint: stubFingerprint,
      issuedAt: new Date().toISOString(),
      issued: Boolean(saved),
      company: {
        name: entity,
        taxId: isDR ? '133-474018' : '—',
        address: isDR ? 'Punta Cana, República Dominicana' : '',
      },
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        department: employee.dept,
        entity: employee.entity,
        nidMasked: employee.nid ? `***-****${employee.nid.slice(-3)}` : 'N/A',
        rate: employee.rate,
        currency: employee.cur || 'USD',
      },
      period: {
        id: period.id,
        startDate: period.start_date,
        endDate: period.end_date,
        payDate: period.pay_date,
      },
      hours: calc.hours,
      earnings: calc.earnings,
      deductions: calc.deductions,
      netPay: calc.netPay,
      payoutDistribution: calc.payoutDistribution,
    };

    return paystubData;
  },
};

module.exports = bankingRailsService;
