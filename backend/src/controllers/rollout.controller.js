const db = require('../db');
const { logAction } = require('./audit.controller');

function getRolloutStatus(req, res, next) {
  try {
    const stages = db.query(`SELECT * FROM rollout_stages ORDER BY phase ASC`);
    const currentLive = stages.find((s) => s.status === 'LIVE_ACTIVE') || stages[0];

    res.json({
      activeHQ: currentLive ? currentLive.short_name : 'Dominicana',
      totalPhases: stages.length,
      stages: stages.map((s) => ({
        id: s.id,
        phase: s.phase,
        orgId: s.org_id,
        short: s.short_name,
        country: s.country,
        status: s.status,
        effectiveDate: s.effective_date,
        description: s.description,
        updatedAt: s.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

function updateRolloutStage(req, res, next) {
  try {
    const { orgId } = req.params;
    const { status, description } = req.body || {};
    const user = (req.user && req.user.name) || 'System';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    const stage = db.getOne(`SELECT * FROM rollout_stages WHERE org_id = ? OR id = ?`, [orgId, orgId]);
    if (!stage) {
      return res.status(404).json({ error: `Rollout stage for organization '${orgId}' not found` });
    }

    const nextStatus = status || stage.status;
    const nextDesc = description || stage.description;

    db.transaction(() => {
      db.execute(
        `UPDATE rollout_stages
         SET status = ?, description = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [nextStatus, nextDesc, stage.id]
      );

      logAction({
        actor: user,
        action: 'HQ_ROLLOUT_STAGE_UPDATED',
        entityType: 'rollout_stage',
        entityId: stage.id,
        newValues: { orgId: stage.org_id, status: nextStatus, description: nextDesc },
        ip: clientIp,
      });
    });

    const updated = db.getOne(`SELECT * FROM rollout_stages WHERE id = ?`, [stage.id]);
    res.json({
      message: `Rollout stage updated for ${stage.short_name}`,
      stage: {
        id: updated.id,
        phase: updated.phase,
        orgId: updated.org_id,
        short: updated.short_name,
        country: updated.country,
        status: updated.status,
        effectiveDate: updated.effective_date,
        description: updated.description,
        updatedAt: updated.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRolloutStatus,
  updateRolloutStage,
};
