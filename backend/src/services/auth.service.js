const db = require('../db');
const firebaseService = require('./firebase.service');
const { logAction } = require('../controllers/audit.controller');
const { verifyPassword, generateToken, generateSalt, hashPassword, generateTempPassword, passwordProblem } = require('../utils/crypto');

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

// Self-registered employees/contractors (Google or Firebase sign-up) need an employee record so they can
// open and edit their own profile. Links an existing record by email, otherwise creates a minimal one.
const SELF_ROLES = ['employee', 'contractor'];
function ensureEmployeeForUser(user) {
  if (!user || user.employee_id || !SELF_ROLES.includes(String(user.role || '').toLowerCase())) return user;
  let emp = resolveEmployeeForEmail(user.email);
  if (!emp) {
    // Lazy require: employees.controller depends on this module (ensureUserForEmployee)
    const { createEmployee } = require('../controllers/employees.controller');
    emp = createEmployee({
      name: user.name,
      email: user.email,
      entity: user.entity || 'MGH Dominicana SRL',
      type: user.role === 'contractor' ? 'Contractor' : 'Full-time',
      role: '',
      mgr: null,
      project: '',
      avatar: user.avatar || null,
      systemRole: user.role,
    }, user.name || 'Self-registration');
  }
  db.execute(`UPDATE users SET employee_id = ? WHERE id = ?`, [emp.id, user.id]);
  return db.getOne(`SELECT * FROM users WHERE id = ?`, [user.id]);
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

// A login created on the fly (Firebase password / Google sign-in) is always a plain employee. Neither the
// e-mail address nor a job title ("CEO", "Lead", "Manager"...) grants a role; an admin assigns it on the
// profile card. Existing accounts keep the role they have.
function roleForNewLogin() {
  return 'employee';
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
        const role = roleForNewLogin();
        let entity = 'MGH Dominicana SRL';
        let employeeId = null;
        let name = normalizedEmail.split('@')[0];

        if (emp) {
          employeeId = emp.id;
          name = emp.name || name;
          entity = emp.entity || entity;
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
        // An existing account keeps its role: a job title never changes it
        const roleUpdate = user.role || roleForNewLogin();
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
  user = ensureEmployeeForUser(user);

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

    const role = roleForNewLogin();
    let entity = 'MGH Dominicana SRL';
    let employeeId = null;

    if (emp) {
      employeeId = emp.id;
      entity = emp.entity || entity;
    }

    // Google-only account: no local password until the user sets one (POST /auth/password)
    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    db.execute(
      `INSERT INTO users (id, email, password_hash, salt, name, role, entity, employee_id, avatar, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, email, '', '', name, role, entity, employeeId, picture]
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
    }
  }
  user = ensureEmployeeForUser(user);
  if (picture && user.employee_id) {
    db.execute(`UPDATE employees SET avatar = ? WHERE id = ?`, [picture, user.employee_id]);
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
    `SELECT s.*, u.id as u_id, u.email, u.name, u.role, u.entity, u.employee_id, u.avatar, u.is_active, u.must_change_password
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now') AND u.is_active = 1`,
    [token]
  );

  if (!session) return null;
  if (!session.employee_id && SELF_ROLES.includes(String(session.role || '').toLowerCase())) {
    // Sessions opened before the employee record existed get linked on their next request
    const linked = ensureEmployeeForUser({ id: session.u_id, email: session.email, name: session.name, role: session.role, entity: session.entity, avatar: session.avatar });
    if (linked) session.employee_id = linked.employee_id;
  }

  let avatar = session.avatar;
  if (avatar && (avatar.includes('assets/avatars/person-') || avatar.includes('carlos-mendez'))) {
    avatar = null;
  }

  return {
    id: session.u_id,
    email: session.email,
    name: session.name,
    role: session.role,
    entity: session.entity,
    employeeId: session.employee_id,
    avatar: avatar || null,
    mustChangePassword: Boolean(Number(session.must_change_password)),
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
  let avatar = user.avatar;
  if (avatar && (avatar.includes('assets/avatars/person-') || avatar.includes('carlos-mendez'))) {
    avatar = null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    entity: user.entity,
    employeeId: user.employee_id,
    avatar: avatar || null,
    lastLoginAt: user.last_login_at,
    hasPassword: Boolean(user.password_hash),
    mustChangePassword: Boolean(Number(user.must_change_password)),
  };
}

function hasLocalPassword(userId) {
  const row = db.getOne(`SELECT password_hash FROM users WHERE id = ?`, [userId]);
  return Boolean(row && row.password_hash);
}

function mustChangePassword(userId) {
  const row = db.getOne(`SELECT must_change_password FROM users WHERE id = ?`, [userId]);
  return Boolean(row && Number(row.must_change_password));
}

/**
 * Change (or first-time set) the signed-in user's password.
 * Authorized by ONE of: the current password; a fresh Google ID token for the same email (covers Google accounts
 * whose local password was never known); or the account having no local password yet.
 */
async function changePassword({ userId, currentPassword, newPassword, googleIdToken, ip = '127.0.0.1' }) {
  const user = db.getOne(`SELECT * FROM users WHERE id = ? AND is_active = 1`, [userId]);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const problem = passwordProblem(newPassword);
  if (problem) {
    const err = new Error(problem);
    err.status = 400;
    throw err;
  }

  let authorizedBy = null;
  if (!user.password_hash) authorizedBy = 'no-password';
  else if (currentPassword && verifyPassword(currentPassword, user.password_hash, user.salt)) authorizedBy = 'current-password';
  else if (googleIdToken) {
    const auth = firebaseService.getAuth();
    if (!auth) {
      const err = new Error('Google verification is not available on this server');
      err.status = 500;
      throw err;
    }
    let decoded;
    try {
      decoded = await auth.verifyIdToken(googleIdToken);
    } catch (e) {
      const err = new Error('Google verification failed: ' + e.message);
      err.status = 401;
      throw err;
    }
    if ((decoded.email || '').trim().toLowerCase() !== String(user.email).toLowerCase()) {
      const err = new Error('The Google account does not match this user');
      err.status = 403;
      throw err;
    }
    authorizedBy = 'google';
  }
  if (!authorizedBy) {
    const err = new Error(currentPassword ? 'Current password is incorrect' : 'Current password is required');
    err.status = 401;
    throw err;
  }

  const salt = generateSalt();
  db.transaction(() => {
    db.execute(`UPDATE users SET password_hash = ?, salt = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?`, [hashPassword(newPassword, salt), salt, user.id]);
    logAction({
      actor: user.name,
      action: user.password_hash ? 'PASSWORD_CHANGED' : 'PASSWORD_SET',
      entityType: 'user',
      entityId: user.id,
      newValues: { authorizedBy },
      ip,
    });
  });
  return { ok: true, hasPassword: true, mustChangePassword: false };
}

/**
 * Administrator reset for a user who forgot their password: a random one-time password is generated and returned
 * ONCE as `temporaryPassword`, every open session of that user is signed out, and the user must replace it at the
 * next sign-in (must_change_password). Only HR/admin may reset; only an admin may reset an admin; nobody resets
 * their own (that goes through changePassword).
 */
const PM_RESETTABLE_ROLES = ['employee', 'contractor', 'supervisor'];

// System roles, lowest to highest. 'admin' is the top level (shown as Platform Admin): it passes every role check.
const SYSTEM_ROLES = ['employee', 'contractor', 'supervisor', 'pm', 'hr', 'finance', 'admin'];
// Which roles each actor may give to someone else (creating an account or changing its role)
const ASSIGNABLE_ROLES = {
  admin: SYSTEM_ROLES,
  hr: ['employee', 'contractor', 'supervisor', 'pm'],
  pm: ['employee', 'contractor', 'supervisor'],
};
function canAssignRole(actorRole, role) {
  return (ASSIGNABLE_ROLES[actorRole] || []).includes(role);
}

// The login of an employee: linked by employee_id, else an unlinked account with the employee's email
function findUserForEmployee(emp) {
  let user = db.getOne(`SELECT * FROM users WHERE employee_id = ?`, [emp.id]);
  if (!user && emp.email) {
    const byEmail = db.getOne(`SELECT * FROM users WHERE LOWER(email) = ?`, [String(emp.email).trim().toLowerCase()]);
    if (byEmail && (!byEmail.employee_id || byEmail.employee_id === emp.id)) user = byEmail;
  }
  return user || null;
}

function accountForEmployee(employeeId) {
  const emp = db.getOne(`SELECT id, email, name FROM employees WHERE id = ?`, [employeeId]);
  if (!emp) { const err = new Error('Employee not found'); err.status = 404; throw err; }
  const user = findUserForEmployee(emp);
  if (!user) return { hasAccount: false };
  return {
    hasAccount: true,
    userId: user.id,
    email: user.email,
    role: user.role,
    isActive: Boolean(Number(user.is_active)),
    lastLoginAt: user.last_login_at || null,
    hasPassword: Boolean(user.password_hash),
    mustChangePassword: Boolean(Number(user.must_change_password)),
  };
}

/**
 * Change the system role of a login. Admin only. Never your own role (no self-lockout) and never the last active admin.
 * Takes effect on the user's next request (sessions read the role from users on every request).
 */
function setUserRole({ userId, role, actor, ip = '127.0.0.1' }) {
  const fail = (status, message) => { const err = new Error(message); err.status = status; return err; };
  if (!actor || actor.role !== 'admin') throw fail(403, 'Only an administrator can change system roles');
  if (!SYSTEM_ROLES.includes(role)) throw fail(400, 'Unknown role: ' + role + ' (valid: ' + SYSTEM_ROLES.join(', ') + ')');
  const user = db.getOne(`SELECT * FROM users WHERE id = ?`, [userId]);
  if (!user) throw fail(404, 'User not found');
  if (user.id === actor.id) throw fail(400, 'You cannot change your own role');
  if (user.role === role) return { ok: true, userId: user.id, email: user.email, role, changed: false };
  if (user.role === 'admin') {
    const admins = db.query(`SELECT id FROM users WHERE role = 'admin' AND is_active = 1`);
    if (admins.filter((a) => a.id !== user.id).length === 0) throw fail(409, 'This is the last active administrator');
  }
  db.transaction(() => {
    db.execute(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`, [role, user.id]);
    logAction({ actor: actor.name, action: 'ROLE_CHANGED', entityType: 'user', entityId: user.id, oldValues: { role: user.role }, newValues: { role, email: user.email }, ip });
  });
  return { ok: true, userId: user.id, email: user.email, role, previousRole: user.role, changed: true };
}

function setRoleForEmployee({ employeeId, role, actor, ip }) {
  const emp = db.getOne(`SELECT id, email, name FROM employees WHERE id = ?`, [employeeId]);
  if (!emp) { const err = new Error('Employee not found'); err.status = 404; throw err; }
  const user = findUserForEmployee(emp);
  if (!user) { const err = new Error('This employee has no login account'); err.status = 404; throw err; }
  return setUserRole({ userId: user.id, role, actor, ip });
}

function resetPasswordForEmployee({ employeeId, actor, ip = '127.0.0.1' }) {
  const fail = (status, message) => { const err = new Error(message); err.status = status; return err; };
  if (!actor || !['admin', 'hr', 'pm'].includes(actor.role)) throw fail(403, 'Only HR, a PM or an administrator can reset passwords');
  const emp = db.getOne(`SELECT id, email, name FROM employees WHERE id = ?`, [employeeId]);
  if (!emp) throw fail(404, 'Employee not found');

  const user = findUserForEmployee(emp); // never one that belongs to another employee
  if (!user) throw fail(404, 'This employee has no login account');
  if (!Number(user.is_active)) throw fail(409, 'This login account is disabled');
  if (user.id === actor.id) throw fail(400, 'Use Change Password to update your own password');
  if (user.role === 'admin' && actor.role !== 'admin') throw fail(403, 'Only an administrator can reset an administrator password');
  // A PM manages the team, not other managers or HR/finance accounts
  if (actor.role === 'pm' && !PM_RESETTABLE_ROLES.includes(user.role)) throw fail(403, 'A PM can only reset passwords of employees, contractors and supervisors');

  const temporaryPassword = generateTempPassword();
  const salt = generateSalt();
  db.transaction(() => {
    db.execute(`UPDATE users SET password_hash = ?, salt = ?, must_change_password = 1, updated_at = datetime('now') WHERE id = ?`, [hashPassword(temporaryPassword, salt), salt, user.id]);
    db.execute(`DELETE FROM sessions WHERE user_id = ?`, [user.id]);
    logAction({
      actor: actor.name,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: user.id,
      newValues: { employeeId: emp.id, resetBy: actor.id },
      ip,
    });
  });
  return { ok: true, email: user.email, temporaryPassword };
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

// Creates the login account for a new employee/contractor. Without an explicit password a random one-time password
// is generated and returned ONCE as `initialPassword` (never a shared default). Either way the password was chosen by
// an administrator, so the user must replace it at first sign-in (must_change_password).
// `accountStatus`: 'created' | 'linked' (the email already had an account, e.g. from Google sign-in, now linked to
// this employee) | 'conflict' (the email's account belongs to another employee: left untouched).
function ensureUserForEmployee({ email, name, role = 'employee', entity = 'MGH Dominicana SRL', employeeId, password = null, avatar = null, keepExistingRole = false }) {
  if (!email || !email.trim()) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.getOne(`SELECT * FROM users WHERE LOWER(email) = ?`, [normalizedEmail]);

  if (existing && existing.employee_id && employeeId && existing.employee_id !== employeeId) {
    return { ...existing, accountStatus: 'conflict' };
  }
  if (existing) {
    // Linking an administrator's account never changes its role; nor does linking when the caller asks to keep it
    if (existing.role === 'admin' || keepExistingRole) role = null;
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
    return { ...db.getOne(`SELECT * FROM users WHERE id = ?`, [existing.id]), accountStatus: 'linked' };
  }

  if (password) {
    const problem = passwordProblem(password);
    if (problem) {
      const err = new Error(problem);
      err.status = 400;
      throw err;
    }
  }
  const generated = !password;
  const plain = password || generateTempPassword();
  const salt = generateSalt();
  const hash = hashPassword(plain, salt);
  const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  db.execute(
    `INSERT INTO users (id, email, password_hash, salt, name, role, entity, employee_id, avatar, is_active, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
    [id, normalizedEmail, hash, salt, name, role, entity, employeeId || null, avatar || null]
  );

  const created = { ...db.getOne(`SELECT * FROM users WHERE id = ?`, [id]), accountStatus: 'created' };
  return generated ? { ...created, initialPassword: plain } : created;
}

module.exports = {
  generateSalt,
  hashPassword,
  verifyPassword,
  login,
  loginWithGoogle,
  changePassword,
  resetPasswordForEmployee,
  SYSTEM_ROLES,
  canAssignRole,
  accountForEmployee,
  setUserRole,
  setRoleForEmployee,
  hasLocalPassword,
  validateSession,
  authenticateUser,
  getSessionUser,
  logout,
  sanitizeUser,
  ensureUserForEmployee,
  mustChangePassword,
  roleForNewLogin,
};


