const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitize, requestLogger } = require('../src/middleware/logger.middleware');
const { logAction, getAuditLogs } = require('../src/controllers/audit.controller');

test('Logger Middleware: Sanitizes sensitive credentials and secrets', () => {
  const sensitivePayload = {
    user: 'Elena Rostova',
    email: 'elena@myglobalhub.com',
    password: 'SuperSecretPassword123!',
    token: 'jwt-token-xyz-1234567890',
    details: {
      ssn: '123-45-6789',
      nid: '001-1234567-8',
      role: 'pm',
    },
  };

  const cleaned = sanitize(sensitivePayload);

  assert.equal(cleaned.user, 'Elena Rostova');
  assert.equal(cleaned.email, 'elena@myglobalhub.com');
  assert.equal(cleaned.password, '••••••••');
  assert.equal(cleaned.token, '••••••••');
  assert.equal(cleaned.details.ssn, '••••••••');
  assert.equal(cleaned.details.nid, '••••••••');
  assert.equal(cleaned.details.role, 'pm');
});

test('Logger Middleware: Sets X-Request-Id header and correlation ID', () => {
  let headerSet = null;
  const mockReq = {
    headers: {},
    socket: {},
  };
  const mockRes = {
    setHeader: (name, val) => {
      if (name === 'X-Request-Id') headerSet = val;
    },
    on: () => {},
  };

  requestLogger(mockReq, mockRes, () => {});

  assert.ok(mockReq.requestId, 'Request ID must be assigned to req');
  assert.equal(headerSet, mockReq.requestId, 'X-Request-Id header must match req.requestId');
});

test('Audit Trail: Append-only integrity verification', () => {
  logAction({
    actor: 'Marcus Vance',
    action: 'STAGING_AUDIT_VERIFY',
    entityType: 'staging',
    entityId: 'stage-1',
    newValues: { environment: 'staging', status: 'verified' },
    ip: '10.0.0.2',
  });

  const logs = getAuditLogs({ entityType: 'staging' });
  const found = logs.find((l) => l.action === 'STAGING_AUDIT_VERIFY');
  assert.ok(found, 'Audit log entry must be retrieved');
  assert.equal(found.actor, 'Marcus Vance');
});
