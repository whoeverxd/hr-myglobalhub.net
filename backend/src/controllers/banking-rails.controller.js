const bankingRailsService = require('../services/banking-rails.service');
const { logAction } = require('./audit.controller');
const db = require('../db');

const getClientIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
const getUserName = (req) => (req.user && req.user.name) || req.headers['x-user'] || 'Elena Rostova';

function exportNacha(req, res, next) {
  try {
    const { periodId = 'PP-2025-08', download = 'false' } = req.query;
    const result = bankingRailsService.generateNachaFile({ periodId });

    if (download === 'true') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      return res.send(result.content);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

function exportBhd(req, res, next) {
  try {
    const { periodId = 'PP-2025-08', currency = 'DOP', download = 'false' } = req.query;
    const result = bankingRailsService.generateBhdFile({ periodId, currency });

    if (download === 'true') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      return res.send(result.content);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

function exportUsdcBatch(req, res, next) {
  try {
    const { periodId = 'PP-2025-08', network = 'Base', download = 'false' } = req.query;
    const result = bankingRailsService.generateUsdcPayoutBatch({ periodId, network });

    if (download === 'true') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      return res.send(JSON.stringify(result.batchPayload, null, 2));
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

function confirmUsdcTransaction(req, res, next) {
  try {
    const { periodId, txHash, network = 'Base', totalUsdc } = req.body || {};

    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      const err = new Error('A valid transaction hash is required (0x + 64 hex characters)');
      err.status = 400;
      throw err;
    }

    const runId = `PR-${periodId}`;

    db.transaction(() => {
      // Record transaction hash in payment proofs and update run note
      db.execute(
        `INSERT OR REPLACE INTO payment_proofs (id, transfer, bank, amount, ref, date, file, type, created_when)
         VALUES (?, 'coinbase', 'Base Mainnet', ?, ?, date('now'), 'Base Scan Transaction', 'crypto', datetime('now'))`,
        [`proof-${Date.now()}`, `$${totalUsdc || '0.00'} USDC`, `tx: ${txHash}`]
      );

      logAction({
        actor: getUserName(req),
        action: 'CONFIRM_USDC_PAYOUT',
        entityType: 'payroll_run',
        entityId: runId,
        newValues: { txHash, network, periodId, totalUsdc },
        ip: getClientIp(req),
      });
    });

    res.json({
      ok: true,
      periodId,
      txHash,
      network,
      explorerUrl: `https://basescan.org/tx/${txHash}`,
      confirmedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

function getPaystub(req, res, next) {
  try {
    const { employeeId, periodId = 'PP-2025-08' } = req.params;
    const paystub = bankingRailsService.generatePaystub({ employeeId, periodId });
    res.json(paystub);
  } catch (err) {
    next(err);
  }
}

function renderPaystubHtml(req, res, next) {
  try {
    const { employeeId, periodId = 'PP-2025-08' } = req.params;
    const stub = bankingRailsService.generatePaystub({ employeeId, periodId });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante de Pago - ${stub.paystubId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 40px; margin: 0; }
    .card { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 36px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; }
    .meta { font-size: 13px; color: #64748b; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    td.amount { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .net-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
    .net-amount { font-size: 28px; font-weight: 800; color: #166534; font-variant-numeric: tabular-nums; }
    .footer { margin-top: 36px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    @media print { body { background: #fff; padding: 0; } .card { border: none; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="title">${stub.company.name}</div>
        <div class="meta">${stub.company.address}<br>RNC / Tax ID: ${stub.company.taxId}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 18px; font-weight: 700; color: #2563eb;">COMPROBANTE DE PAGO</div>
        <div class="meta">ID: <strong>${stub.paystubId}</strong><br>Período: <strong>${stub.period.id}</strong><br>Fecha Pago: <strong>${stub.period.payDate}</strong></div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="section-title">Colaborador</div>
        <table>
          <tr><td>Nombre:</td><td><strong>${stub.employee.name}</strong></td></tr>
          <tr><td>ID Empleado:</td><td>${stub.employee.id}</td></tr>
          <tr><td>Cargo / Rol:</td><td>${stub.employee.role}</td></tr>
          <tr><td>Departamento:</td><td>${stub.employee.department}</td></tr>
          <tr><td>Documento / SSN:</td><td>${stub.employee.nidMasked}</td></tr>
        </table>
      </div>
      <div>
        <div class="section-title">Parámetros del Período</div>
        <table>
          <tr><td>Horas Regulares:</td><td class="amount">${stub.hours.regular}h</td></tr>
          <tr><td>Horas Extras:</td><td class="amount">${stub.hours.overtime}h</td></tr>
          <tr><td>Tarifa Horaria:</td><td class="amount">$${stub.employee.rate.toFixed(2)}/h</td></tr>
          <tr><td>Fecha de Corte:</td><td class="amount">${stub.period.endDate}</td></tr>
        </table>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="section-title">Ingresos Brutos</div>
        <table>
          <tr><td>Salario Base Regular</td><td class="amount">$${stub.earnings.regular.toFixed(2)}</td></tr>
          <tr><td>Horas Extras (1.5x)</td><td class="amount">$${stub.earnings.overtime.toFixed(2)}</td></tr>
          <tr><td>Ajustes / Bonos</td><td class="amount">$${stub.earnings.adjustments.toFixed(2)}</td></tr>
          <tr style="font-weight: 700; color: #0f172a;"><td>Total Ingresos Brutos</td><td class="amount">$${stub.earnings.grossPay.toFixed(2)}</td></tr>
        </table>
      </div>
      <div>
        <div class="section-title">Deducciones y Retenciones</div>
        <table>
          ${stub.deductions.lines.map((l) => `<tr><td>${l.label}</td><td class="amount" style="color: #dc2626;">-$${l.amount.toFixed(2)}</td></tr>`).join('')}
          <tr style="font-weight: 700; color: #dc2626;"><td>Total Retenciones</td><td class="amount">-$${stub.deductions.total.toFixed(2)}</td></tr>
        </table>
      </div>
    </div>

    <div class="net-box">
      <div>
        <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #166534;">Sueldo Neto a Pagar</div>
        <div style="font-size: 13px; color: #15803d;">Dispersado según método de pago convenido</div>
      </div>
      <div class="net-amount">$${stub.netPay.toFixed(2)} ${stub.employee.currency}</div>
    </div>

    <div class="footer">
      Documento electrónico oficial generado por MGH Payroll System • Firma criptográfica: ${stub.fingerprint}
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportNacha,
  exportBhd,
  exportUsdcBatch,
  confirmUsdcTransaction,
  getPaystub,
  renderPaystubHtml,
};
