const crypto = require('crypto');

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'salt',
  'token',
  'jwt',
  'secret',
  'api_key',
  'apikey',
  'ssn',
  'nid',
  'acct',
]);

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      clean[k] = '••••••••';
    } else if (typeof v === 'object') {
      clean[k] = sanitize(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Capture finish event for structured metrics
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      user: req.user?.name || 'Anonymous',
      role: req.user?.role || 'Guest',
    };

    if (process.env.NODE_ENV !== 'test') {
      // In production/staging, output structured JSON for Datadog / CloudWatch / ELK
      const prefix = res.statusCode >= 400 ? '[ERROR]' : '[INFO]';
      console.log(`${prefix} ${JSON.stringify(logEntry)}`);
    }
  });

  next();
}

module.exports = {
  requestLogger,
  sanitize,
};
