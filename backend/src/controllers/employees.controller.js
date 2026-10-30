const db = require('../db');
const { logAction } = require('./audit.controller');
const { ensureUserForEmployee, canAssignRole } = require('../services/auth.service');
const { passwordProblem } = require('../utils/crypto');
const { todayLocal } = require('../utils/today');

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function getUserAvatarMap() {
  const map = new Map();
  try {
    const users = db.query(`SELECT employee_id, email, avatar FROM users WHERE avatar IS NOT NULL`);
    for (const u of users) {
      const av = u.avatar;
      if (!av || typeof av !== 'string') continue;
      if (av.includes('assets/avatars/') || av.includes('person-') || av.includes('carlos-mendez')) continue;
      if (av.startsWith('http') || av.startsWith('data:') || av.startsWith('/api/uploads/')) {
        if (u.employee_id) map.set(u.employee_id, av);
        if (u.email) map.set(u.email.toLowerCase(), av);
      }
    }
  } catch (_) {}
  return map;
}

function resolveCleanAvatar(e, userMap) {
  let avatar = e.avatar;
  const userAvatar = userMap ? (userMap.get(e.id) || (e.email ? userMap.get(e.email.toLowerCase()) : null)) : null;
  if (userAvatar && (userAvatar.startsWith('http') || userAvatar.startsWith('data:') || userAvatar.startsWith('/api/uploads/'))) {
    return userAvatar;
  }
  if (avatar && typeof avatar === 'string' && !avatar.includes('assets/avatars/') && !avatar.includes('person-') && !avatar.includes('carlos-mendez')) {
    if (avatar.startsWith('http') || avatar.startsWith('data:') || avatar.startsWith('/api/uploads/')) {
      return avatar;
    }
  }
  return null;
}

function listEmployees(empId = null) {
  let sql = `SELECT * FROM employees`;
  const params = [];
  if (empId) {
    sql += ` WHERE id = ?`;
    params.push(empId);
  }
  sql += ` ORDER BY id ASC`;
  const rows = db.query(sql, params);
  const userMap = getUserAvatarMap();
  return rows.map((e) => {
    let raw = {};
    try {
      if (e.raw_meta) raw = JSON.parse(e.raw_meta);
    } catch {
      /* ignore */
    }
    const avatar = resolveCleanAvatar(e, userMap);
    return {
      id: e.id,
      name: e.name,
      first: e.first_name || e.name.split(' ')[0],
      last: e.last_name || e.name.split(' ').slice(1).join(' '),
      email: e.email,
      phone: e.phone,
      nid: e.nid,
      dob: e.dob,
      entity: e.entity,
      dept: e.dept,
      role: e.role,
      mgr: e.mgr,
      type: e.type,
      start: e.start_date,
      loc: e.loc,
      freq: e.freq,
      rate: e.rate,
      cur: e.cur,
      ot: Boolean(e.ot),
      tax: e.tax,
      pmethod: e.pmethod,
      bank: e.bank,
      acct: e.acct,
      routing: e.routing,
      alloc: e.alloc,
      cryptoWallet: e.crypto_wallet,
      cryptoAsset: e.crypto_asset,
      cryptoNetwork: e.crypto_network,
      cryptoAlloc: e.crypto_alloc,
      jira: e.jira,
      project: e.project,
      avatar,
      status: e.status,
      ...raw,
    };
  });
}

function getEmployeeById(id) {
  const e = db.getOne(`SELECT * FROM employees WHERE id = ?`, [id]);
  if (!e) return null;
  let raw = {};
  try {
    if (e.raw_meta) raw = JSON.parse(e.raw_meta);
  } catch {
    /* ignore */
  }
  const userMap = getUserAvatarMap();
  const avatar = resolveCleanAvatar(e, userMap);
  return {
    ...e,
    avatar,
    ...raw,
  };
}

function getNextEmployeeId() {
  const rows = db.query(`SELECT id FROM employees WHERE id LIKE 'MGH-%'`);
  let maxNum = 1162;
  for (const r of rows) {
    const num = parseInt(r.id.replace('MGH-', ''), 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }
  return `MGH-${maxNum + 1}`;
}

// actorRole: role of whoever creates it (null = internal/system call). It bounds the login role that can be given.
function createEmployee(data, user = 'System', ip = '127.0.0.1', actorRole = null) {
  let initialPassword = null; // returned once so HR can hand it to the employee
  // What happened to the login: created | linked | conflict | failed | none (no email) — shown to whoever created it
  let account = { status: 'none' };
  // An explicitly requested system role must be one the creator may give (a PM cannot create administrators)
  const requestedRole = data.systemRole || data.userRole || null;
  if (requestedRole && actorRole && !canAssignRole(actorRole, requestedRole)) {
    const err = new Error(`Your role cannot create accounts with the role "${requestedRole}"`);
    err.status = 403;
    throw err;
  }
  if (data.email && !EMAIL_REGEX.test(data.email)) {
    const err = new Error('Invalid email');
    err.status = 400;
    throw err;
  }
  // A password typed by the administrator must meet the same rule as a self-chosen one (checked before anything is saved)
  if (data.password) {
    const problem = passwordProblem(data.password);
    if (problem) {
      const err = new Error(problem);
      err.status = 400;
      throw err;
    }
  }

  // An email already used by another employee (their record or their login) is refused before anything is saved:
  // creating the employee anyway left a record without access, and every retry added another duplicate.
  if (data.email && data.email.trim()) {
    const email = data.email.trim().toLowerCase();
    const login = db.getOne(`SELECT employee_id FROM users WHERE LOWER(email) = ?`, [email]);
    const holderId = (login && login.employee_id) || ((db.getOne(`SELECT id FROM employees WHERE LOWER(email) = ?`, [email]) || {}).id);
    if (holderId) {
      const holder = db.getOne(`SELECT name FROM employees WHERE id = ?`, [holderId]);
      const err = new Error(`The email ${email} already belongs to employee ${holderId}${holder && holder.name ? ` (${holder.name})` : ''}. Nothing was created: use a different email or edit that employee.`);
      err.status = 409;
      throw err;
    }
  }

  const id = getNextEmployeeId();
  const pending = Array.isArray(data.pending) ? data.pending : [];
  const status = pending.length ? 'Pending Onboarding' : 'Active';

  // Never store unmasked banking or national IDs in plain text
  const maskedAcct = data.acct ? '••••' + String(data.acct).slice(-4) : null;
  const maskedNid = data.nid ? '••••' + String(data.nid).slice(String(data.nid).includes('-') ? -5 : -4) : null;

  const firstName = data.first || '';
  const lastName = data.last || '';
  const fullName = data.name || `${firstName} ${lastName}`.trim() || 'New Employee';

  const employeeRecord = {
    id,
    first_name: firstName,
    last_name: lastName,
    name: fullName,
    email: data.email || null,
    phone: data.phone || null,
    nid: maskedNid,
    dob: data.dob || null,
    // The single organization (RBAC tenant). Nothing else is invented: unknown fields stay empty.
    entity: data.entity || 'MGH Dominicana SRL',
    dept: data.dept || '',
    role: data.title || data.role || '',
    mgr: data.mgr || null,
    type: data.etype || data.type || 'Full-time',
    start_date: data.start || todayLocal(),
    loc: data.loc || null,
    freq: data.freq || 'Bi-Weekly',
    rate: Number(data.rate) || 0,
    cur: data.cur || 'USD',
    ot: data.ot === false ? 0 : 1,
    tax: data.tax || null,
    pmethod: data.pmethod || 'Bank Deposit',
    bank: data.bank || null,
    acct: maskedAcct,
    routing: data.route || data.routing || null,
    alloc: Number(data.alloc) || 100,
    crypto_wallet: data.cbWallet || null,
    crypto_asset: data.cbAsset || null,
    crypto_network: data.cbNetwork || null,
    crypto_alloc: Number(data.cbAlloc) || 0,
    jira: data.jira || null,
    project: (() => {
      if (data.projects !== undefined) {
        return Array.isArray(data.projects) ? data.projects.join(', ') : data.projects;
      }
      if (data.project !== undefined) {
        return Array.isArray(data.project) ? data.project.join(', ') : data.project;
      }
      return 'MSHP — Project Planning';
    })(),
    avatar: data.avatar || null,
    status,
    raw_meta: JSON.stringify({ pending, flow: data.flow }),
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO employees (
        id, first_name, last_name, name, email, phone, nid, dob, entity, dept, role,
        mgr, type, start_date, loc, freq, rate, cur, ot, tax, pmethod, bank, acct,
        routing, alloc, crypto_wallet, crypto_asset, crypto_network, crypto_alloc,
        jira, project, avatar, status, raw_meta
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )`,
      [
        employeeRecord.id,
        employeeRecord.first_name,
        employeeRecord.last_name,
        employeeRecord.name,
        employeeRecord.email,
        employeeRecord.phone,
        employeeRecord.nid,
        employeeRecord.dob,
        employeeRecord.entity,
        employeeRecord.dept,
        employeeRecord.role,
        employeeRecord.mgr,
        employeeRecord.type,
        employeeRecord.start_date,
        employeeRecord.loc,
        employeeRecord.freq,
        employeeRecord.rate,
        employeeRecord.cur,
        employeeRecord.ot,
        employeeRecord.tax,
        employeeRecord.pmethod,
        employeeRecord.bank,
        employeeRecord.acct,
        employeeRecord.routing,
        employeeRecord.alloc,
        employeeRecord.crypto_wallet,
        employeeRecord.crypto_asset,
        employeeRecord.crypto_network,
        employeeRecord.crypto_alloc,
        employeeRecord.jira,
        employeeRecord.project,
        employeeRecord.avatar,
        employeeRecord.status,
        employeeRecord.raw_meta,
      ]
    );

    logAction({
      actor: user,
      action: 'CREATE_EMPLOYEE',
      entityType: 'employee',
      entityId: id,
      newValues: { id, name: fullName, email: data.email, project: employeeRecord.project, status },
      ip,
    });
  });

  // Provision system login user for employee/contractor so they can log hours
  if (employeeRecord.email) {
    let userRole = data.systemRole || data.userRole || 'employee';
    const typeStr = String(employeeRecord.type || '').toLowerCase();
    const roleStr = String(employeeRecord.role || '').toLowerCase();
    if (!data.systemRole && !data.userRole) {
      if (typeStr.includes('contractor')) {
        userRole = 'contractor';
      } else if (roleStr.includes('manager') || roleStr.includes('pm') || roleStr.includes('lead')) {
        userRole = 'pm';
      } else if (roleStr.includes('admin') || roleStr.includes('ceo') || roleStr.includes('dueño')) {
        userRole = 'admin';
      } else if (roleStr.includes('hr')) {
        userRole = 'hr';
      }
      // A role guessed from the job title never exceeds what the creator may give
      if (actorRole && !canAssignRole(actorRole, userRole)) userRole = 'employee';
    }

    try {
      const user = ensureUserForEmployee({
        email: employeeRecord.email,
        name: employeeRecord.name,
        role: userRole,
        entity: employeeRecord.entity,
        employeeId: id,
        password: data.password || null,
        avatar: employeeRecord.avatar,
      });
      if (user && user.initialPassword) initialPassword = user.initialPassword;
      account = user ? { status: user.accountStatus, email: user.email, role: user.role, linkedEmployeeId: user.employee_id || null } : { status: 'none' };
    } catch (e) {
      console.warn('[employee creation: user provisioning error]', e);
      account = { status: 'failed', error: e.message };
    }
  }

  // Projects chosen at creation become memberships, so the new person sees those projects and their tasks
  syncProjectMemberships(id, employeeRecord.project, user, ip);

  // If contractor type, also sync to contractors table
  const isContractor = String(employeeRecord.type || '').toLowerCase().includes('contractor');
  if (isContractor) {
    try {
      const contractorId = 'CTR-' + id.replace(/\D/g, '');
      const existingCtr = db.getOne(`SELECT id FROM contractors WHERE employee_id = ? OR id = ?`, [id, contractorId]);
      if (!existingCtr) {
        db.execute(
          `INSERT INTO contractors (
            id, name, role, country, email, phone, start_date, basis, rate, cur,
            bank, acct, status, entity, employee_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            contractorId,
            employeeRecord.name,
            employeeRecord.role,
            employeeRecord.loc && employeeRecord.loc.includes('DR') ? 'Dominican Republic' : 'Dominican Republic',
            employeeRecord.email,
            employeeRecord.phone,
            employeeRecord.start_date,
            'Hourly',
            employeeRecord.rate,
            employeeRecord.cur,
            employeeRecord.bank,
            employeeRecord.acct,
            'Active',
            employeeRecord.entity,
            id,
          ]
        );
      }
    } catch (e) {
      console.warn('[employee creation: contractor sync error]', e);
    }
  }

  const created = getEmployeeById(id);
  return initialPassword ? { ...created, account, initialPassword } : { ...created, account };
}

function updateEmployee(id, data, { user = 'System', ip = '127.0.0.1' } = {}) {
  const current = getEmployeeById(id);
  if (!current) {
    const err = new Error(`Employee with ID ${id} not found`);
    err.status = 404;
    throw err;
  }

  const name = data.name || (data.first_name && data.last_name ? `${data.first_name} ${data.last_name}` : current.name);
  const first_name = data.first_name || (data.name ? data.name.split(' ')[0] : current.first);
  const last_name = data.last_name || (data.name ? data.name.split(' ').slice(1).join(' ') : current.last);
  const email = data.email !== undefined ? data.email : current.email;
  const phone = data.phone !== undefined ? data.phone : current.phone;
  const nid = data.nid !== undefined ? data.nid : current.nid;
  const entity = data.entity !== undefined ? data.entity : current.entity;
  const dept = data.dept !== undefined ? data.dept : current.dept;
  const role = data.role !== undefined ? data.role : current.role;
  const mgr = data.mgr !== undefined ? data.mgr : current.mgr;
  const type = data.type !== undefined ? data.type : current.type;
  const loc = data.loc !== undefined ? data.loc : current.loc;
  const rate = data.rate !== undefined ? Number(data.rate) : current.rate;
  const cur = data.cur !== undefined ? data.cur : current.cur;
  const ot = data.ot !== undefined ? (data.ot ? 1 : 0) : (current.ot ? 1 : 0);
  const tax = data.tax !== undefined ? data.tax : current.tax;
  const pmethod = data.pmethod !== undefined ? data.pmethod : current.pmethod;
  const bank = data.bank !== undefined ? data.bank : current.bank;
  const acct = data.acct !== undefined ? data.acct : current.acct;
  const routing = data.routing !== undefined ? data.routing : current.routing;
  const alloc = data.alloc !== undefined ? Number(data.alloc) : current.alloc;
  const crypto_wallet = data.cryptoWallet !== undefined ? data.cryptoWallet : (data.crypto_wallet !== undefined ? data.crypto_wallet : current.cryptoWallet);
  const crypto_asset = data.cryptoAsset !== undefined ? data.cryptoAsset : (data.crypto_asset !== undefined ? data.crypto_asset : current.cryptoAsset);
  const crypto_network = data.cryptoNetwork !== undefined ? data.cryptoNetwork : (data.crypto_network !== undefined ? data.crypto_network : current.cryptoNetwork);
  const crypto_alloc = data.cryptoAlloc !== undefined ? Number(data.cryptoAlloc) : (data.crypto_alloc !== undefined ? Number(data.crypto_alloc) : current.cryptoAlloc);
  const jira = data.jira !== undefined ? data.jira : current.jira;
  let project = current.project;
  if (data.projects !== undefined) {
    project = Array.isArray(data.projects) ? data.projects.join(', ') : data.projects;
  } else if (data.project !== undefined) {
    project = Array.isArray(data.project) ? data.project.join(', ') : data.project;
  }
  const status = data.status !== undefined ? data.status : current.status;

  db.transaction(() => {
    db.execute(
      `UPDATE employees SET
        name = ?, first_name = ?, last_name = ?, email = ?, phone = ?, nid = ?,
        entity = ?, dept = ?, role = ?, mgr = ?, type = ?, loc = ?,
        rate = ?, cur = ?, ot = ?, tax = ?, pmethod = ?, bank = ?, acct = ?,
        routing = ?, alloc = ?, crypto_wallet = ?, crypto_asset = ?, crypto_network = ?, crypto_alloc = ?,
        jira = ?, project = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?`,
      [
        name, first_name, last_name, email, phone, nid,
        entity, dept, role, mgr, type, loc,
        rate, cur, ot, tax, pmethod, bank, acct,
        routing, alloc, crypto_wallet, crypto_asset, crypto_network, crypto_alloc,
        jira, project, status, id
      ]
    );

    logAction({
      actor: user,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'employee',
      entityId: id,
      oldValues: { name: current.name, role: current.role, dept: current.dept, rate: current.rate },
      newValues: { name, role, dept, rate, entity, bank, status },
      ip,
    });
  });

  if (data.projects !== undefined || data.project !== undefined) syncProjectMemberships(id, project, user, ip);

  return getEmployeeById(id);
}

/**
 * Adds the employee as a member of each project named in `projectList` ("WOK, Arawaki", key or name,
 * case-insensitive). Unknown names are ignored. Never removes memberships (a PM does that per project).
 */
function syncProjectMemberships(employeeId, projectList, user = 'System', ip = '127.0.0.1') {
  const names = String(projectList || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!names.length) return [];
  const agileService = require('../services/agile.service'); // lazy: avoids a require cycle at load time
  const projects = db.query('SELECT id, key, name FROM jira_projects')
    .filter((p) => names.includes(String(p.key).toLowerCase()) || names.includes(String(p.name).toLowerCase()));
  const added = [];
  for (const p of projects) {
    try {
      if (!db.getOne('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [p.id, employeeId])) {
        agileService.addMember(p.id, { userId: employeeId, role: 'member' }, user, ip);
        added.push(p.key);
      }
    } catch (e) {
      console.warn('[employees] project membership skipped:', p.key, e.message);
    }
  }
  return added;
}

/* ---------- Removing an employee ----------
 * Delete = cascade over everything that is only operational data (activities, unpaid timesheets, punches, leave,
 * project memberships, login…). It is refused when the person already has payroll history (approved/paid sheets,
 * payroll run lines, approved adjustments, paid contractor payments): those records must be kept, so the employee is
 * deactivated instead (status Terminated, login disabled, sessions closed, history intact).
 * Who: a PM (team accounts: employee/contractor/supervisor) or an admin (any, except themselves and the last admin). */
const PM_REMOVABLE_ROLES = ['employee', 'contractor', 'supervisor'];
const fail = (status, message) => { const err = new Error(message); err.status = status; return err; };

function removalContext(employeeId, actor) {
  if (!actor || !['pm', 'admin'].includes(actor.role)) throw fail(403, 'Only a PM or an administrator can remove employees');
  const emp = db.getOne('SELECT * FROM employees WHERE id = ?', [employeeId]);
  if (!emp) throw fail(404, 'Employee not found');
  const byEmail = emp.email ? db.getOne('SELECT * FROM users WHERE LOWER(email) = ?', [String(emp.email).trim().toLowerCase()]) : null;
  // An account with this email that belongs to another employee is never touched
  const user = db.getOne('SELECT * FROM users WHERE employee_id = ?', [emp.id])
    || (byEmail && (!byEmail.employee_id || byEmail.employee_id === emp.id) ? byEmail : null);
  if (actor.employeeId && actor.employeeId === emp.id) throw fail(400, 'You cannot remove your own employee record');
  if (user && user.id === actor.id) throw fail(400, 'You cannot remove your own account');
  if (user && actor.role === 'pm' && !PM_REMOVABLE_ROLES.includes(user.role)) throw fail(403, 'A PM can only remove employees, contractors and supervisors');
  if (user && user.role === 'admin' && Number(user.is_active) !== 0) {
    const otherAdmins = db.query(`SELECT id FROM users WHERE role = 'admin' AND is_active = 1`).filter((a) => a.id !== user.id);
    if (!otherAdmins.length) throw fail(409, 'This is the last active administrator');
  }
  return { emp, user };
}

// An adjustment links to its employee by employee_id. Rows created before that column existed carry only the
// free-text `name`, and listAdjustments() still shows those to whoever matches that name
// (adjustments.controller.js), so a legacy row left behind by a delete turns up in the payroll view of the next
// hire called the same. The payroll engine already refuses to pay them, but an approved one is still this
// employee's payroll history and has to block the delete like any other.
// Read the link exactly as listAdjustments reads it: by id where there is one, by name only for the rows
// that never got one.
function adjustmentsFor(emp) {
  return db
    .query('SELECT * FROM payroll_adjustments')
    .filter((a) => (a.employee_id ? a.employee_id === emp.id : Boolean(emp.name) && a.name === emp.name));
}

// What a delete would remove, and what (if anything) prevents it
function employeeRemovalPreview(employeeId, actor) {
  const { emp, user } = removalContext(employeeId, actor);
  const by = (table, col = 'employee_id') => db.query(`SELECT * FROM ${table} WHERE ${col} = ?`, [emp.id]);
  const sheets = by('timesheets');
  const contractorRows = by('contractors');
  const contractorPays = contractorRows.flatMap((c) => db.query('SELECT * FROM contractor_payments WHERE contractor_id = ?', [c.id]));
  const adjustments = adjustmentsFor(emp);
  const blockers = [];
  const paidSheets = sheets.filter((t) => ['Approved', 'Paid'].includes(t.status));
  if (paidSheets.length) blockers.push(`${paidSheets.length} approved/paid timesheet(s)`);
  const runLines = by('payroll_run_items');
  if (runLines.length) blockers.push(`${runLines.length} payroll run line(s)`);
  const approvedAdj = adjustments.filter((a) => /^approved/i.test(String(a.status || '')));
  if (approvedAdj.length) blockers.push(`${approvedAdj.length} approved payroll adjustment(s)`);
  const paidCtr = contractorPays.filter((p) => /paid|sent|completed/i.test(String(p.status || '')));
  if (paidCtr.length) blockers.push(`${paidCtr.length} paid contractor payment(s)`);
  return {
    employeeId: emp.id,
    name: emp.name,
    canDelete: blockers.length === 0,
    blockers,
    willDelete: {
      timesheets: sheets.length,
      activities: by('daily_activities').length,
      punches: by('attendance_punches').length,
      exceptions: by('attendance_exceptions').length,
      leaveRequests: by('leave_requests').length,
      worklogs: by('worklogs').length,
      projectMemberships: by('project_members', 'user_id').length,
      tasksUnassigned: by('project_tasks', 'assignee_id').length,
      pendingAdjustments: adjustments.length,
      contractorRecords: contractorRows.length,
      contractorPayments: contractorPays.length,
      login: user ? user.email : null,
    },
  };
}

function deleteEmployee(employeeId, actor, ip = '127.0.0.1') {
  const preview = employeeRemovalPreview(employeeId, actor);
  if (!preview.canDelete) {
    throw fail(409, `${preview.name} has payroll history (${preview.blockers.join(', ')}). Payroll records must be kept: deactivate the employee instead.`);
  }
  const { emp, user } = removalContext(employeeId, actor);
  db.transaction(() => {
    for (const table of ['daily_activities', 'timesheets', 'attendance_punches', 'attendance_exceptions', 'leave_requests', 'worklogs']) {
      db.execute(`DELETE FROM ${table} WHERE employee_id = ?`, [emp.id]);
    }
    db.execute('DELETE FROM project_members WHERE user_id = ?', [emp.id]);
    db.execute(`UPDATE project_tasks SET assignee_id = NULL, assignee_name = NULL, assignee_avatar = NULL WHERE assignee_id = ?`, [emp.id]);
    for (const a of adjustmentsFor(emp)) db.execute('DELETE FROM payroll_adjustments WHERE id = ?', [a.id]);
    for (const c of db.query('SELECT id FROM contractors WHERE employee_id = ?', [emp.id])) {
      db.execute('DELETE FROM contractor_payments WHERE contractor_id = ?', [c.id]);
      db.execute('DELETE FROM contractors WHERE id = ?', [c.id]);
    }
    if (user) {
      db.execute('DELETE FROM sessions WHERE user_id = ?', [user.id]);
      db.execute('DELETE FROM users WHERE id = ?', [user.id]);
    }
    db.execute('DELETE FROM employees WHERE id = ?', [emp.id]);
    logAction({ actor: actor.name, action: 'DELETE_EMPLOYEE', entityType: 'employee', entityId: emp.id, oldValues: { name: emp.name, email: emp.email, role: emp.role }, newValues: { deleted: preview.willDelete }, ip });
  });
  return { ok: true, deleted: true, employeeId: emp.id, removed: preview.willDelete };
}

// Keeps every record; the person can no longer sign in and leaves the active lists
function deactivateEmployee(employeeId, actor, ip = '127.0.0.1') {
  const { emp, user } = removalContext(employeeId, actor);
  db.transaction(() => {
    db.execute(`UPDATE employees SET status = 'Terminated' WHERE id = ?`, [emp.id]);
    if (user) {
      db.execute(`UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, [user.id]);
      db.execute('DELETE FROM sessions WHERE user_id = ?', [user.id]);
    }
    db.execute('DELETE FROM project_members WHERE user_id = ?', [emp.id]);
    logAction({ actor: actor.name, action: 'DEACTIVATE_EMPLOYEE', entityType: 'employee', entityId: emp.id, oldValues: { status: emp.status }, newValues: { status: 'Terminated', loginDisabled: Boolean(user) }, ip });
  });
  return { ok: true, deactivated: true, employeeId: emp.id };
}

module.exports = {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  employeeRemovalPreview,
  deleteEmployee,
  deactivateEmployee,
};
