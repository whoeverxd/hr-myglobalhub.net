const db = require('../db');
const { logAction } = require('./audit.controller');
const { ensureUserForEmployee } = require('../services/auth.service');

function formatContractor(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    role: c.role,
    country: c.country,
    email: c.email || '',
    phone: c.phone || '',
    start: c.start_date || '',
    startDate: c.start_date || '',
    end: c.end_date || '',
    endDate: c.end_date || '',
    basis: c.basis || 'Hourly',
    rate: Number(c.rate) || 0,
    cur: c.cur || 'USD',
    method: c.method || 'Coinbase',
    wallet: c.wallet || '',
    walletFull: c.wallet_full || c.wallet || '',
    asset: c.asset || 'USDC',
    network: c.network || 'Base',
    delivery: c.delivery || 'Cash Pickup',
    receiver: c.receiver || c.name || '',
    city: c.city || '',
    bank: c.bank || '',
    acct: c.acct || '',
    payCur: c.pay_cur || 'USD',
    fx: Number(c.fx) || 1,
    wuFee: Number(c.wu_fee) || 4.99,
    st: c.status || 'Active',
    status: c.status || 'Active',
    entity: c.entity || 'MGH Dominicana SRL',
    employeeId: c.employee_id || '',
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function formatContractorPayment(p, contractorMap = {}) {
  const c = contractorMap[p.contractor_id] || null;
  return {
    id: p.id,
    cid: p.contractor_id,
    contractorId: p.contractor_id,
    period: p.period_id,
    periodId: p.period_id,
    hours: p.hours == null ? null : Number(p.hours),
    amount: Number(p.amount) || 0,
    fee: Number(p.fee) || 0,
    status: p.status || 'Calculated',
    date: p.date || '',
    cbId: p.cb_id || '',
    hash: p.hash || '',
    mtcn: p.mtcn || '',
    notes: p.notes || '',
    receipt: p.receipt || null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    c: c ? formatContractor(c) : undefined,
  };
}

function syncContractorEmployees() {
  try {
    const contractorEmployees = db.query(`SELECT * FROM employees WHERE LOWER(type) LIKE '%contractor%'`);
    for (const emp of contractorEmployees) {
      const existing = db.getOne(
        `SELECT id FROM contractors WHERE employee_id = ? OR id = ? OR LOWER(email) = ?`,
        [emp.id, 'CTR-' + emp.id.replace(/\D/g, ''), (emp.email || '').toLowerCase()]
      );
      if (!existing) {
        const ctrId = 'CTR-' + emp.id.replace(/\D/g, '');
        db.execute(
          `INSERT INTO contractors (
            id, name, role, country, email, phone, start_date, basis, rate, cur,
            method, wallet, wallet_full, asset, network, delivery, receiver, city,
            bank, acct, pay_cur, fx, wu_fee, status, entity, employee_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ctrId,
            emp.name,
            emp.role || 'Contractor',
            (emp.loc && emp.loc.includes('DR')) ? 'Dominican Republic' : (emp.loc || 'Dominican Republic'),
            emp.email,
            emp.phone || '+1 809 555 0192',
            emp.start_date || 'Feb 10, 2024',
            'Hourly',
            Number(emp.rate) || 50,
            emp.cur || 'USD',
            'Coinbase',
            emp.crypto_wallet ? (emp.crypto_wallet.slice(0, 6) + '…' + emp.crypto_wallet.slice(-4)) : '0x3aB8…9F12',
            emp.crypto_wallet || '0x3aB858B5d06456EaFeEfa24e86895315B91a9F12',
            emp.crypto_asset || 'USDC',
            emp.crypto_network || 'Base',
            'Direct Crypto',
            emp.name,
            (emp.loc && emp.loc.split(',')[0]) || 'Santiago',
            emp.bank || 'Banco BHD León',
            emp.acct || '2039485761',
            'USD',
            1.0,
            0.01,
            'Active',
            emp.entity || 'MGH Dominicana SRL',
            emp.id,
          ]
        );
      }

      // Ensure contractor has a login account in users
      if (emp.email) {
        ensureUserForEmployee({
          email: emp.email,
          name: emp.name,
          role: 'contractor',
          entity: emp.entity || 'MGH Dominicana SRL',
          employeeId: emp.id,
          // Random, not shown: these people sign in with Google or get a password from HR
          password: null,
          avatar: emp.avatar || null,
        });
      }
    }
  } catch (err) {
    console.warn('[syncContractorEmployees error]', err);
  }
}

function listContractors(filter = null) {
  syncContractorEmployees();
  let sql = `SELECT * FROM contractors`;
  const params = [];
  if (filter && (filter.id || filter.email)) {
    sql += ` WHERE (id = ? OR employee_id = ? OR LOWER(email) = ?)`;
    params.push(filter.id || '', filter.id || '', (filter.email || '').toLowerCase());
  }
  sql += ` ORDER BY id ASC`;
  const rows = db.query(sql, params);
  return rows.map(formatContractor);
}

function getContractor(id) {
  syncContractorEmployees();
  const row = db.getOne(`SELECT * FROM contractors WHERE id = ?`, [id]);
  return formatContractor(row);
}

function getNextContractorId() {
  const rows = db.query(`SELECT id FROM contractors WHERE id LIKE 'CTR-%'`);
  let maxNum = 1000;
  for (const r of rows) {
    const num = parseInt(String(r.id).replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }
  return `CTR-${maxNum + 1}`;
}

function createContractor(data, user = 'System', ip = '127.0.0.1') {
  if (!data.name || !data.name.trim() || !data.role || !data.role.trim()) {
    const err = new Error('Name and role are required for contractor');
    err.status = 400;
    throw err;
  }

  const name = data.name.trim();
  const role = data.role.trim();
  const country = data.country || 'Dominican Republic';
  const email = (data.email && data.email.trim()) || `${name.toLowerCase().replace(/\s+/g, '.')}@myglobalhub.net`;
  const phone = (data.phone && data.phone.trim()) || '+1 555-0100';
  const start = data.start || data.startDate || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const end = data.end || data.endDate || '';
  const basis = data.basis || 'Hourly';
  const rate = Number(data.rate) || 0;
  const cur = data.cur || 'USD';
  const method = data.method || 'Coinbase';
  const walletFull = data.walletFull || data.wallet || '';
  const wallet = (walletFull.length > 12 && !walletFull.includes('@'))
    ? `${walletFull.slice(0, 6)}…${walletFull.slice(-4)}`
    : walletFull;
  const asset = data.asset || 'USDC';
  const network = data.network || 'Base';
  const delivery = data.delivery || 'Cash Pickup';
  const receiver = data.receiver || name;
  const city = data.city || 'Santo Domingo';
  const bank = data.bank || '';
  const acct = data.acct || '';
  const payCur = data.payCur || (method === 'Western Union' ? 'DOP' : 'USD');
  const fx = Number(data.fx) || 1.0;
  const wuFee = Number(data.wuFee) || (method === 'Western Union' ? 4.99 : 0.01);
  const status = data.st || data.status || 'Active';
  const entity = data.entity || 'MGH Dominicana SRL';

  // 1. Link or create employee record in employees table
  let employeeId = data.employeeId || data.employee_id;
  if (!employeeId) {
    const existingEmp = db.getOne(`SELECT id FROM employees WHERE LOWER(email) = ? OR LOWER(name) = ?`, [email.toLowerCase(), name.toLowerCase()]);
    if (existingEmp) {
      employeeId = existingEmp.id;
    } else {
      const empRows = db.query(`SELECT id FROM employees WHERE id LIKE 'MGH-%'`);
      let maxEmp = 1044;
      for (const r of empRows) {
        const num = parseInt(String(r.id).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxEmp) maxEmp = num;
      }
      employeeId = `MGH-${maxEmp + 1}`;
      db.execute(
        `INSERT INTO employees (
          id, name, first_name, last_name, role, dept, type, entity, loc, mgr, project, rate, status,
          bank, acct, routing, cur, email, phone, start_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          employeeId, name, name.split(' ')[0], name.split(' ').slice(1).join(' '),
          role, 'Engineering', 'Contractor', entity, city + ', ' + country, 'Joshua Hernandez',
          'MSHP — Project Planning', rate, 'Active', bank, acct, null, cur, email, phone, start
        ]
      );
    }
  }

  const id = data.id && /^CTR-\d+$/i.test(data.id) ? data.id : `CTR-${employeeId.replace(/\D/g, '')}`;

  // 2. Ensure system login user exists for contractor with role 'contractor'
  const account = ensureUserForEmployee({
    email,
    name,
    role: 'contractor',
    entity,
    employeeId,
    password: data.password || null,
    avatar: null
  });

  // 3. Insert or replace contractor record
  db.transaction(() => {
    db.execute(
      `INSERT OR REPLACE INTO contractors (
        id, name, role, country, email, phone, start_date, end_date, basis, rate, cur,
        method, wallet, wallet_full, asset, network, delivery, receiver, city, bank, acct,
        pay_cur, fx, wu_fee, status, entity, employee_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, name, role, country, email, phone, start, end, basis, rate, cur,
        method, wallet, walletFull, asset, network, delivery, receiver, city, bank, acct,
        payCur, fx, wuFee, status, entity, employeeId
      ]
    );

    logAction({
      actor: user,
      action: 'CREATE_CONTRACTOR',
      entityType: 'contractor',
      entityId: id,
      newValues: { id, name, role, country, basis, rate, method, status, employeeId },
      ip,
    });
  });

  // A generated initial password is returned once so it can be handed to the contractor
  const created = getContractor(id);
  return account && account.initialPassword ? { ...created, initialPassword: account.initialPassword } : created;
}

function updateContractor(id, patch, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM contractors WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error(`Contractor ${id} not found`);
    err.status = 404;
    throw err;
  }

  const name = patch.name !== undefined ? patch.name.trim() : current.name;
  const role = patch.role !== undefined ? patch.role.trim() : current.role;
  const country = patch.country !== undefined ? patch.country : current.country;
  const email = patch.email !== undefined ? patch.email.trim() : current.email;
  const phone = patch.phone !== undefined ? patch.phone.trim() : current.phone;
  const start = patch.start !== undefined ? patch.start : (patch.startDate !== undefined ? patch.startDate : current.start_date);
  const end = patch.end !== undefined ? patch.end : (patch.endDate !== undefined ? patch.endDate : current.end_date);
  const basis = patch.basis !== undefined ? patch.basis : current.basis;
  const rate = patch.rate !== undefined ? Number(patch.rate) : current.rate;
  const cur = patch.cur !== undefined ? patch.cur : current.cur;
  const method = patch.method !== undefined ? patch.method : current.method;
  
  const walletFull = patch.walletFull !== undefined
    ? patch.walletFull
    : (patch.wallet !== undefined ? patch.wallet : current.wallet_full);
  const wallet = (walletFull && walletFull.length > 12 && !walletFull.includes('@'))
    ? `${walletFull.slice(0, 6)}…${walletFull.slice(-4)}`
    : walletFull;

  const asset = patch.asset !== undefined ? patch.asset : current.asset;
  const network = patch.network !== undefined ? patch.network : current.network;
  const delivery = patch.delivery !== undefined ? patch.delivery : current.delivery;
  const receiver = patch.receiver !== undefined ? patch.receiver : current.receiver;
  const city = patch.city !== undefined ? patch.city : current.city;
  const bank = patch.bank !== undefined ? patch.bank : current.bank;
  const acct = patch.acct !== undefined ? patch.acct : current.acct;
  const payCur = patch.payCur !== undefined ? patch.payCur : current.pay_cur;
  const fx = patch.fx !== undefined ? Number(patch.fx) : current.fx;
  const wuFee = patch.wuFee !== undefined ? Number(patch.wuFee) : current.wu_fee;
  const status = patch.st !== undefined ? patch.st : (patch.status !== undefined ? patch.status : current.status);
  const entity = patch.entity !== undefined ? patch.entity : current.entity;

  db.transaction(() => {
    db.execute(
      `UPDATE contractors SET
        name = ?, role = ?, country = ?, email = ?, phone = ?, start_date = ?, end_date = ?,
        basis = ?, rate = ?, cur = ?, method = ?, wallet = ?, wallet_full = ?, asset = ?,
        network = ?, delivery = ?, receiver = ?, city = ?, bank = ?, acct = ?,
        pay_cur = ?, fx = ?, wu_fee = ?, status = ?, entity = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        name, role, country, email, phone, start, end,
        basis, rate, cur, method, wallet, walletFull, asset,
        network, delivery, receiver, city, bank, acct,
        payCur, fx, wuFee, status, entity, id,
      ]
    );

    logAction({
      actor: user,
      action: 'UPDATE_CONTRACTOR',
      entityType: 'contractor',
      entityId: id,
      oldValues: current,
      newValues: { id, name, role, country, basis, rate, method, status },
      ip,
    });
  });

  return getContractor(id);
}

function deleteContractor(id, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM contractors WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error(`Contractor ${id} not found`);
    err.status = 404;
    throw err;
  }

  db.transaction(() => {
    db.execute(`DELETE FROM contractors WHERE id = ?`, [id]);
    logAction({
      actor: user,
      action: 'DELETE_CONTRACTOR',
      entityType: 'contractor',
      entityId: id,
      oldValues: current,
      ip,
    });
  });

  return { success: true, id };
}

function listContractorPayments({ periodId, contractorId, status } = {}) {
  let sql = `SELECT * FROM contractor_payments WHERE 1=1`;
  const params = [];

  if (periodId) {
    sql += ` AND period_id = ?`;
    params.push(periodId);
  }
  if (contractorId) {
    sql += ` AND contractor_id = ?`;
    params.push(contractorId);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY id ASC`;

  const payments = db.query(sql, params);
  const contractors = db.query(`SELECT * FROM contractors`);
  const contractorMap = {};
  for (const c of contractors) {
    contractorMap[c.id] = c;
  }

  return payments.map(p => formatContractorPayment(p, contractorMap));
}

function getContractorPayment(id) {
  const p = db.getOne(`SELECT * FROM contractor_payments WHERE id = ?`, [id]);
  if (!p) return null;
  const c = db.getOne(`SELECT * FROM contractors WHERE id = ?`, [p.contractor_id]);
  return formatContractorPayment(p, { [p.contractor_id]: c });
}

function updateContractorPayment(id, patch, user = 'System', ip = '127.0.0.1') {
  const current = db.getOne(`SELECT * FROM contractor_payments WHERE id = ?`, [id]);
  if (!current) {
    const err = new Error(`Contractor payment ${id} not found`);
    err.status = 404;
    throw err;
  }

  const status = patch.status !== undefined ? String(patch.status) : current.status;
  const date = patch.date !== undefined ? String(patch.date) : current.date;
  const cbId = patch.cbId !== undefined ? String(patch.cbId) : (patch.cb_id !== undefined ? String(patch.cb_id) : current.cb_id);
  const hash = patch.hash !== undefined ? String(patch.hash) : current.hash;
  const mtcn = patch.mtcn !== undefined ? String(patch.mtcn) : current.mtcn;
  const notes = patch.notes !== undefined ? String(patch.notes) : current.notes;
  const receipt = patch.receipt !== undefined ? (typeof patch.receipt === 'object' ? JSON.stringify(patch.receipt) : String(patch.receipt)) : current.receipt;
  const hours = patch.hours !== undefined ? (patch.hours == null ? null : Number(patch.hours)) : current.hours;
  const amount = patch.amount !== undefined ? Number(patch.amount) : current.amount;
  const fee = patch.fee !== undefined ? Number(patch.fee) : current.fee;

  db.transaction(() => {
    db.execute(
      `UPDATE contractor_payments SET
        status = ?, date = ?, cb_id = ?, hash = ?, mtcn = ?, notes = ?, receipt = ?,
        hours = ?, amount = ?, fee = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [status, date, cbId, hash, mtcn, notes, receipt, hours, amount, fee, id]
    );

    logAction({
      actor: user,
      action: 'UPDATE_CONTRACTOR_PAYMENT',
      entityType: 'contractor_payment',
      entityId: id,
      oldValues: current,
      newValues: { id, status, date, cbId, hash, mtcn, notes },
      ip,
    });
  });

  return getContractorPayment(id);
}

function createContractorPayment(data, user = 'System', ip = '127.0.0.1') {
  if (!data.contractorId && !data.cid) {
    const err = new Error('Contractor ID is required for contractor payment');
    err.status = 400;
    throw err;
  }
  const contractorId = data.contractorId || data.cid;
  const periodId = data.periodId || data.period || 'PP-2025-08';
  
  // Generate payment ID
  const rows = db.query(`SELECT id FROM contractor_payments WHERE period_id = ?`, [periodId]);
  let maxNum = 0;
  for (const r of rows) {
    const match = String(r.id).match(/-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const id = data.id || `CPAY-${periodId.replace('PP-', '')}-${String(maxNum + 1).padStart(3, '0')}`;
  const hours = data.hours == null ? null : Number(data.hours);
  const amount = Number(data.amount) || 0;
  const fee = Number(data.fee) || 0;
  const status = data.status || 'Calculated';
  const date = data.date || '';
  const cbId = data.cbId || data.cb_id || '';
  const hash = data.hash || '';
  const mtcn = data.mtcn || '';
  const notes = data.notes || '';
  const receipt = data.receipt ? (typeof data.receipt === 'object' ? JSON.stringify(data.receipt) : String(data.receipt)) : null;

  db.transaction(() => {
    db.execute(
      `INSERT INTO contractor_payments (
        id, contractor_id, period_id, hours, amount, fee, status, date, cb_id, hash, mtcn, notes, receipt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, contractorId, periodId, hours, amount, fee, status, date, cbId, hash, mtcn, notes, receipt]
    );

    logAction({
      actor: user,
      action: 'CREATE_CONTRACTOR_PAYMENT',
      entityType: 'contractor_payment',
      entityId: id,
      newValues: { id, contractorId, periodId, amount, status },
      ip,
    });
  });

  return getContractorPayment(id);
}

/* Express Handlers */
const getUserName = (req) => (req.user && req.user.name) || req.headers['x-user'] || 'System';
const getClientIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

function getContractorsList(req, res, next) {
  try {
    const isPrivileged = req.user && (req.user.role === 'admin' || req.user.role === 'pm');
    if (!isPrivileged) {
      if (req.user && req.user.role === 'contractor') {
        const list = listContractors({ id: req.user.employeeId, email: req.user.email });
        return res.json(list);
      }
      return res.json([]);
    }
    const list = listContractors();
    res.json(list);
  } catch (err) {
    next(err);
  }
}

function getContractorById(req, res, next) {
  try {
    const isPrivileged = req.user && (req.user.role === 'admin' || req.user.role === 'pm');
    if (!isPrivileged) {
      if (req.user && req.user.role === 'contractor') {
        const myCtrs = listContractors({ id: req.user.employeeId, email: req.user.email });
        const matches = myCtrs.some((c) => c.id === req.params.id || c.employeeId === req.params.id);
        if (!matches) {
          return res.status(403).json({ error: 'Forbidden: you can only view your own contractor profile' });
        }
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const item = getContractor(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Contractor not found' });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
}

function createContractorHandler(req, res, next) {
  try {
    const created = createContractor(req.body || {}, getUserName(req), getClientIp(req));
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

function updateContractorHandler(req, res, next) {
  try {
    const updated = updateContractor(req.params.id, req.body || {}, getUserName(req), getClientIp(req));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function deleteContractorHandler(req, res, next) {
  try {
    const result = deleteContractor(req.params.id, getUserName(req), getClientIp(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function getContractorPaymentsList(req, res, next) {
  try {
    const isPrivileged = req.user && (req.user.role === 'admin' || req.user.role === 'pm');
    let { periodId, contractorId, status } = req.query;
    if (!isPrivileged) {
      if (req.user && req.user.role === 'contractor') {
        const myCtrs = listContractors({ id: req.user.employeeId, email: req.user.email });
        if (!myCtrs.length) return res.json([]);
        contractorId = myCtrs[0].id;
      } else {
        return res.json([]);
      }
    }
    const list = listContractorPayments({ periodId, contractorId, status });
    res.json(list);
  } catch (err) {
    next(err);
  }
}

function createContractorPaymentHandler(req, res, next) {
  try {
    const created = createContractorPayment(req.body || {}, getUserName(req), getClientIp(req));
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

function updateContractorPaymentHandler(req, res, next) {
  try {
    const updated = updateContractorPayment(req.params.id, req.body || {}, getUserName(req), getClientIp(req));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listContractors,
  getContractor,
  createContractor,
  updateContractor,
  deleteContractor,
  listContractorPayments,
  getContractorPayment,
  createContractorPayment,
  updateContractorPayment,
  getContractorsList,
  getContractorById,
  createContractorHandler,
  updateContractorHandler,
  deleteContractorHandler,
  getContractorPaymentsList,
  createContractorPaymentHandler,
  updateContractorPaymentHandler,
};
