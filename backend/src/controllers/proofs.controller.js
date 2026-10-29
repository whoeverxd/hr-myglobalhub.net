const db = require('../db');
const { logAction } = require('./audit.controller');
const { todayLocal } = require('../utils/today');

const TX_HASH = /^0x[a-fA-F0-9]{64}$/;

function listProofs() {
  const rows = db.query(`SELECT * FROM payment_proofs ORDER BY created_at DESC`);
  return rows.map((p) => ({
    id: p.id,
    transfer: p.transfer,
    bank: p.bank,
    amount: p.amount,
    ref: p.ref,
    date: p.date,
    file: p.file,
    thumb: p.thumb,
    type: p.type,
    when: p.created_when,
    emp: p.emp_id || null,
    period: p.period_id || null,
  }));
}

function saveProof(data, user = 'System', ip = '127.0.0.1') {
  if (!['bhd', 'chase', 'coinbase'].includes(data.transfer)) {
    const err = new Error('Unknown transfer');
    err.status = 400;
    throw err;
  }

  const empId = String(data.emp || data.empId || '').trim();
  const periodId = String(data.period || data.periodId || '').trim();
  if (!empId || !periodId) {
    const err = new Error('emp and period are required: a proof belongs to one payslip');
    err.status = 400;
    throw err;
  }

  if (data.transfer === 'coinbase' && !TX_HASH.test(String(data.ref || '').split(': ').pop())) {
    const err = new Error('Coinbase proofs need a valid transaction hash (0x + 64 hex)');
    err.status = 400;
    throw err;
  }

  if (data.thumb && data.thumb.length > 11e6) {
    const err = new Error('File too large (max 8 MB)');
    err.status = 413;
    throw err;
  }

  const proof = {
    id: String(data.id || Date.now()),
    transfer: data.transfer,
    bank: data.bank || '',
    amount: data.amount || '—',
    ref: data.ref || '',
    date: data.date || todayLocal(),
    file: data.file || 'Confirmation document',
    thumb: data.thumb || null,
    type: data.type || 'upload',
    created_when: data.when || new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    emp_id: empId,
    period_id: periodId,
  };

  db.transaction(() => {
    // One proof per payslip line (transfer + employee + period); replace it if it exists
    const existing = db.getOne(
      `SELECT id FROM payment_proofs WHERE transfer = ? AND emp_id = ? AND period_id = ?`,
      [proof.transfer, empId, periodId]
    );
    if (existing) {
      db.execute(`DELETE FROM payment_proofs WHERE id = ?`, [existing.id]);
    }

    db.execute(
      `INSERT INTO payment_proofs (id, transfer, bank, amount, ref, date, file, thumb, type, created_when, emp_id, period_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        proof.id,
        proof.transfer,
        proof.bank,
        proof.amount,
        proof.ref,
        proof.date,
        proof.file,
        proof.thumb,
        proof.type,
        proof.created_when,
        empId,
        periodId,
      ]
    );

    logAction({
      actor: user,
      action: 'SAVE_PAYMENT_PROOF',
      entityType: 'payment_proof',
      entityId: proof.id,
      newValues: { transfer: proof.transfer, bank: proof.bank, ref: proof.ref, empId, periodId },
      ip,
    });
  });

  return { ...proof, emp: empId, period: periodId };
}

function deleteProof(id, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM payment_proofs WHERE id = ?`, [String(id)]);
  if (!current) {
    const err = new Error('Proof not found');
    err.status = 404;
    throw err;
  }

  db.transaction(() => {
    db.execute(`DELETE FROM payment_proofs WHERE id = ?`, [String(id)]);
    logAction({
      actor: user,
      action: 'DELETE_PAYMENT_PROOF',
      entityType: 'payment_proof',
      entityId: String(id),
      oldValues: { transfer: current.transfer },
      ip,
    });
  });

  return true;
}

module.exports = {
  listProofs,
  saveProof,
  deleteProof,
};
