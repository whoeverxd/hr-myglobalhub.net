const { validateSession } = require('../services/auth.service');
const db = require('../db');
const { devAuthAllowed } = require('../utils/runtime');

const PASSWORD_CHANGE_ALLOWED = ['/auth/me', '/auth/password', '/auth/logout'];

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (token) {
    const user = validateSession(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
    req.user = user;
    // A temporary password set by an administrator must be replaced before the account can do anything else
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.some((p) => req.originalUrl.split('?')[0].endsWith(p))) {
      return res.status(403).json({ error: 'You must replace your temporary password before continuing', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    return next();
  }

  // Development fallback (no token): ONLY in a test process or with ALLOW_DEV_AUTH=true. Secure by default --
  // in production a request without a token is always 401, and x-user-email / x-user headers are ignored.
  if (devAuthAllowed()) {
    const devUserEmail = req.headers['x-user-email'];
    const devUserName = req.headers['x-user'];

    if (devUserEmail) {
      const u = db.getOne('SELECT id, email, name, role, entity, employee_id, avatar FROM users WHERE LOWER(email) = ?', [devUserEmail.toLowerCase()]);
      if (u) {
        req.user = { id: u.id, email: u.email, name: u.name, role: u.role, entity: u.entity, employeeId: u.employee_id, avatar: u.avatar };
        return next();
      }
    }

    if (devUserName) {
      const u = db.getOne('SELECT id, email, name, role, entity, employee_id, avatar FROM users WHERE name = ?', [devUserName]);
      if (u) {
        req.user = { id: u.id, email: u.email, name: u.name, role: u.role, entity: u.entity, employeeId: u.employee_id, avatar: u.avatar };
        return next();
      }
    }

    // Default development context (Joshua Hernandez - PM)
    req.user = {
      id: 'usr-joshua',
      email: 'joshua@myglobalhub.net',
      name: 'Joshua Hernandez',
      role: 'pm',
      entity: 'MGH Dominicana SRL',
      employeeId: 'MGH-1042',
      avatar: null,
    };
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * RBAC Role Gate
 * Admin role always has wildcard access
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role === 'admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: role '${req.user.role}' is not authorized for this operation. Required: [${allowedRoles.join(', ')}]`,
    });
  };
}

module.exports = {
  authenticate,
  requireRole,
};
