const db = require('../db');
const { logAction } = require('./audit.controller');
const { ensureUserForEmployee } = require('../services/auth.service');

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

function createEmployee(data, user = 'Elena Rostova', ip = '127.0.0.1') {
  if (data.email && !EMAIL_REGEX.test(data.email)) {
    const err = new Error('Invalid email');
    err.status = 400;
    throw err;
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
    entity: data.entity || 'My Global Hub Dominicana SRL',
    dept: data.dept || 'Engineering',
    role: data.title || data.role || 'Contributor',
    mgr: data.mgr || (user && user !== 'System' ? user : 'Joshua Hernandez'),
    type: data.etype || data.type || 'Full-time',
    start_date: data.start || new Date().toISOString().slice(0, 10),
    loc: data.loc || 'Punta Cana, DR',
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
    }

    try {
      ensureUserForEmployee({
        email: employeeRecord.email,
        name: employeeRecord.name,
        role: userRole,
        entity: employeeRecord.entity,
        employeeId: id,
        password: data.password || 'Password123!',
        avatar: employeeRecord.avatar,
      });
    } catch (e) {
      console.warn('[employee creation: user provisioning error]', e);
    }
  }

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

  return getEmployeeById(id);
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

  return getEmployeeById(id);
}

module.exports = {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
};
