const db = require('../db');

function logAction({ actor = 'System', action, entityType, entityId, oldValues = null, newValues = null, ip = '127.0.0.1' }) {
  try {
    db.execute(
      `INSERT INTO audit_logs (actor, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actor,
        action,
        entityType,
        String(entityId),
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ip,
      ]
    );
  } catch (err) {
    console.error('[audit] Error recording audit log:', err.message);
  }
}

function getAuditLogs({ limit = 100, offset = 0, entityType = null } = {}) {
  if (entityType) {
    return db.query(
      `SELECT * FROM audit_logs WHERE entity_type = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [entityType, limit, offset]
    );
  }
  return db.query(
    `SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

module.exports = {
  logAction,
  getAuditLogs,
};
