const db = require('../db');
const firebaseService = require('./firebase.service');
const { logAction } = require('../controllers/audit.controller');
const { verifyPassword, generateToken, generateSalt, hashPassword } = require('../utils/crypto');

function resolveEmployeeForEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  let emp = db.getOne(`SELECT * FROM employees WHERE LOWER(email) = ?`, [normalized]);
  if (!emp && normalized.includes('joshua')) {
    emp = db.getOne(`SELECT * FROM employees WHERE id = 'MGH-1042' OR LOWER(name) LIKE '%joshua%'`);
  }
  const jiraEmail = (process.env.JIRA_EMAIL || '').trim().toLowerCase();
  if (!emp && jiraEmail && normalized === jiraEmail) {
    emp = db.getOne(`SELECT * FROM employees WHERE id = 'MGH-1042' OR LOWER(name) LIKE '%joshua%'`);
  }
  return emp;
}

async function verifyFirebasePassword(email, password) {
  const apiKey =
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyAu4Uik9o0ylktWTMxdlbKUixKVHdBjKA8';
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });
    const data = await res.json();
    if (res.ok && data.idToken) {
      return data;
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function login({ email, password, ip = '127.0.0.1' }) {
  if (!email || !password) {
    const err = new Error('Email and password are required');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = db.getOne(`SELECT * FROM users WHERE LOWER(email) = ? AND is_active = 1`, [normalizedEmail]);

  let authenticated = false;
  if (user && verifyPassword(password, user.password_hash, user.salt)) {
    authenticated = true;
  }

  // Fallback to Firebase Authentication (e.g. users registered/created in Firebase Console)
  if (!authenticated) {
    const firebaseResult = await verifyFirebasePassword(normalizedEmail, password);
    if (firebaseResult) {
      authenticated = true;
      const emp = resolveEmployeeForEmail(normalizedEmail);
      const salt = generateSalt();
      const hash = hashPassword(password, salt);

      if (!user) {
        let role = 'employee';
        let entity = 'MGH Dominicana SRL';
        let employeeId = null;
        let name = normalizedEmail.split('@')[0];

        if (emp) {
          employeeId = emp.id;
          name = emp.name || name;
          entity = emp.entity || entity;
          const lowerRole = (emp.role || '').toLowerCase();
          if (lowerRole.includes('ceo') || lowerRole.includes('admin')) role = 'admin';
          else if (lowerRole.includes('lead') || lowerRole.includes('manager') || lowerRole.includes('pm')) role = 'pm';
          else if (emp.type === 'Contractor') role = 'contractor';
        } else if (normalizedEmail.includes('admin')) {
          role = 'admin';
        }

        const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        db.execute(
          `INSERT INTO users (id, email, password_hash, salt, name, role, entity, employee_id, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [userId, normalizedEmail, hash, salt, name, role, entity, employeeId]
        );
        user = db.getOne(`SELECT * FROM users WHERE id = ?`, [userId]);
      } else {
        // Sync password hash and link employee if unlinked
        const empIdUpdate = (!user.employee_id && emp) ? emp.id : user.employee_id;
        let roleUpdate = user.role;
        if ((!user.role || user.role === 'employee') && emp) {
          const lowerRole = (emp.role || '').toLowerCase();
          if (lowerRole.includes('pm') || lowerRole.includes('manager')) roleUpdate = 'pm';
          else if (lowerRole.includes('admin')) roleUpdate = 'admin';
        }
        db.execute(
          `UPDATE users SET password_hash = ?, salt = ?, employee_id = ?, role = ? WHERE id = ?`,
          [hash, salt, empIdUpdate, roleUpdate, user.id]
        );
        user = db.getOne(`SELECT * FROM users WHERE id = ?`, [user.id]);
      }
    }
  }

  if (!authenticated || !user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  // Token valid for 7 days
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.transaction(() => {
    // Record session
    db.execute(
      `INSERT INTO sessions (token, user_id, ip_address, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, user.id, ip, expiresAt]
    );

    // Update last login
    db.execute(
      `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
      [user.id]
    );

    logAction({
      actor: user.name,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      newValues: { ip, role: user.role },
      ip,
    });
  });

  return {
    token,
    user: sanitizeUser(user),
    expiresAt,
  };
}

async function loginWithGoogle({ idToken, ip = '127.0.0.1' }) {
  if (!idToken) {
    const err = new Error('Google ID token is required');
    err.status = 400;
    throw err;
  }

  const auth = firebaseService.getAuth();
  if (!auth) {
    const err = new Error('Firebase Auth is not initialized or credentials missing');
    err.status = 500;
    throw err;
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (verifyErr) {
    const err = new Error(`Invalid Google Token: ${verifyErr.message}`);
    err.status = 401;
    throw err;
  }

  const email = (decoded.email || '').trim().toLowerCase();
  if (!email) {
    const err = new Error('Google account must have an email address associated');
    err.status = 400;
    throw err;
  }

  const name = decoded.name || decoded.displayName || email.split('@')[0];
  const picture = decoded.picture || null;
  const googleUid = decoded.uid;

  let user = db.getOne(`SELECT * FROM users WHERE LOWER(email) = ?`, [email]);

  if (!user) {
    // Check if email matches a registered employee in employees table
    const emp = db.getOne(`SELECT * FROM employees WHERE LOWER(email) = ?`, [email]);

    let role = 'employee';
    let entity = 'MGH Dominicana SRL';
    let employeeId = null;

    if (emp) {
      employeeId = emp.id;
      entity = emp.entity || entity;
      const lowerRole = (emp.role || '').toLowerCase();
      if (lowerRole.includes('ceo') || lowerRole.includes('dueño') || lowerRole.includes('admin')) {
        role = 'admin';
      } else if (lowerRole.includes('lead') || lowerRole.includes('manager') || lowerRole.includes('pm')) {
        role = 'pm';
      } else if (emp.type === 'Contractor') {
        role = 'contractor';
      }
    } else {
      role = 'employee';
    }

    const salt = generateSalt();
    const hash = hashPassword(Math.random().toString(36), salt);
    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    db.execute(
      `INSERT INTO users (id, email, password_hash, salt, name, role, entity, employee_id, avatar, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, email, hash, salt, name, role, entity, employeeId, picture]
    );

    user = db.getOne(`SELECT * FROM users WHERE id = ?`, [userId]);
  } else {
    if (user.is_active === 0) {
      const err = new Error('Account has been deactivated. Please contact your administrator.');
      err.status = 403;
      throw err;
    }

    if (picture) {
      db.execute(`UPDATE users SET avatar = ? WHERE id = ?`, [picture, user.id]);
      user.avatar = picture;
      const targetEmpId = user.employee_id || (emp && emp.id);
      if (targetEmpId) {
        db.execute(`UPDATE employees SET avatar = ? WHERE id = ?`, [picture, targetEmpId]);
      }
    }
  }

  // Token valid for 7 days
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.transaction(() => {
    db.execute(
      `INSERT INTO sessions (token, user_id, ip_address, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, user.id, ip, expiresAt]
    );

    db.execute(
      `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
      [user.id]
    );

    logAction({
      actor: user.name,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      newValues: { ip, role: user.role, provider: 'google', googleUid },
      ip,
    });
  });

  return {
    token,
    user: sanitizeUser(user),
    expiresAt,
  };
}

function validateSession(token) {
  if (!token) return null;

  const session = db.getOne(
    `SELECT s.*, u.id as u_id, u.email, u.name, u.role, u.entity, u.employee_id, u.avatar, u.is_active
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now') AND u.is_active = 1`,
    [token]
  );

  if (!session) return null;

  return {
    id: session.u_id,
    email: session.email,
    name: session.name,
    role: session.role,
    entity: session.entity,
    employeeId: session.employee_id,
    avatar: session.avatar,
  };
}

function logout(token, ip = '127.0.0.1') {
  if (!token) return false;
  const session = db.getOne(`SELECT * FROM sessions WHERE token = ?`, [token]);
  if (session) {
    db.transaction(() => {
      db.execute(`DELETE FROM sessions WHERE token = ?`, [token]);
      logAction({
        actor: 'User',
        action: 'USER_LOGOUT',
        entityType: 'session',
        entityId: session.user_id,
        ip,
      });
    });
  }
  return true;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    entity: user.entity,
    employeeId: user.employee_id,
    avatar: user.avatar,
    lastLoginAt: user.last_login_at,
  };
}

function authenticateUser(email, password, ip = '127.0.0.1') {
  if (!email || !password) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.getOne(`SELECT * FROM users WHERE LOWER(email) = ? AND is_active = 1`, [normalizedEmail]);
  if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
    return null;
  }
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.transaction(() => {
    db.execute(
      `INSERT INTO sessions (token, user_id, ip_address, expires_at) VALUES (?, ?, ?, ?)`,
      [token, user.id, ip, expiresAt]
    );
    db.execute(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, [user.id]);
  });
  return { token, user: sanitizeUser(user), expiresAt };
}

function getSessionUser(token) {
  return validateSession(token);
}

function ensureUserForEmployee({ email, name, role = 'employee', entity = 'MGH Dominicana SRL', employeeId, password = 'Password123!', avatar = null }) {
  if (!email || !email.trim()) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.getOne(`SELECT * FROM users WHERE LOWER(email) = ?`, [normalizedEmail]);
  
  if (existing) {
    db.execute(
      `UPDATE users SET
         employee_id = COALESCE(?, employee_id),
         name = COALESCE(?, name),
         role = COALESCE(?, role),
         entity = COALESCE(?, entity),
         avatar = COALESCE(?, avatar),
         updated_at = datetime('now')
       WHERE id = ?`,
      [employeeId || null, name || null, role || null, entity || null, avatar || null, existing.id]
    );
    return db.getOne(`SELECT * FROM users WHERE id = ?`, [existing.id]);
  }

  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  db.execute(
    `INSERT INTO users (id, email, password_hash, salt, name, role, entity, employee_id, avatar, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, normalizedEmail, hash, salt, name, role, entity, employeeId || null, avatar || null]
  );

  return db.getOne(`SELECT * FROM users WHERE id = ?`, [id]);
}

module.exports = {
  generateSalt,
  hashPassword,
  verifyPassword,
  login,
  loginWithGoogle,
  validateSession,
  authenticateUser,
  getSessionUser,
  logout,
  sanitizeUser,
  ensureUserForEmployee,
};


