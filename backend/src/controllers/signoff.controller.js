const crypto = require('crypto');
const db = require('../db');
const { logAction } = require('./audit.controller');

const VALID_DEPARTMENTS = ['payroll', 'finance', 'compliance'];

function getSignoffsForPeriod(periodId) {
  const rows = db.query(
    `SELECT id, period_id, department, signed_by, signature_hash, notes, created_at
     FROM payroll_signoffs
     WHERE period_id = ?
     ORDER BY created_at ASC`,
    [periodId]
  );

  const signedDepartments = rows.map((r) => r.department);
  const pendingDepartments = VALID_DEPARTMENTS.filter((d) => !signedDepartments.includes(d));
  const isFullyApproved = pendingDepartments.length === 0;

  return {
    periodId,
    isFullyApproved,
    requiredDepartments: VALID_DEPARTMENTS,
    signedCount: rows.length,
    totalRequired: VALID_DEPARTMENTS.length,
    pendingDepartments,
    signoffs: rows.map((r) => ({
      id: r.id,
      periodId: r.period_id,
      department: r.department,
      signedBy: r.signed_by,
      signatureHash: r.signature_hash,
      notes: r.notes,
      createdAt: r.created_at,
    })),
  };
}

function recordSignoff(req, res, next) {
  try {
    const { periodId, department, notes = '' } = req.body || {};
    const signedBy = (req.user && req.user.name) || 'Authorized Officer';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!periodId) {
      return res.status(400).json({ error: 'periodId is required' });
    }
    const deptNorm = (department || '').toLowerCase().trim();
    if (!VALID_DEPARTMENTS.includes(deptNorm)) {
      return res.status(400).json({
        error: `Invalid department. Must be one of: ${VALID_DEPARTMENTS.join(', ')}`,
      });
    }

    // Generate cryptographic SHA-256 digital signature
    const timestamp = new Date().toISOString();
    const payload = `${periodId}|${deptNorm}|${signedBy}|${timestamp}|${notes}`;
    const signatureHash = crypto.createHash('sha256').update(payload).digest('hex');
    const id = `SO-${periodId}-${deptNorm.toUpperCase()}`;

    db.transaction(() => {
      // Upsert signoff
      db.execute(
        `INSERT INTO payroll_signoffs (id, period_id, department, signed_by, signature_hash, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(period_id, department) DO UPDATE SET
           signed_by = excluded.signed_by,
           signature_hash = excluded.signature_hash,
           notes = excluded.notes,
           created_at = datetime('now')`,
        [id, periodId, deptNorm, signedBy, signatureHash, notes]
      );

      logAction({
        actor: signedBy,
        action: 'PAYROLL_SIGNOFF_RECORDED',
        entityType: 'payroll_signoff',
        entityId: id,
        newValues: {
          periodId,
          department: deptNorm,
          signatureHash,
          notes,
        },
        ip: clientIp,
      });
    });

    const status = getSignoffsForPeriod(periodId);
    res.status(201).json({
      message: `Sign-off successfully recorded for ${deptNorm}`,
      signoff: {
        id,
        periodId,
        department: deptNorm,
        signedBy,
        signatureHash,
        notes,
        createdAt: timestamp,
      },
      summary: status,
    });
  } catch (err) {
    next(err);
  }
}

function getSignoffs(req, res, next) {
  try {
    const { periodId } = req.params;
    const summary = getSignoffsForPeriod(periodId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  recordSignoff,
  getSignoffs,
  getSignoffsForPeriod,
};
