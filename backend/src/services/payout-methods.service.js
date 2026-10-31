const db = require('../db');
const { logAction } = require('../controllers/audit.controller');

/*
 * Payout methods ("Datos de pago"): each employee registers one or more ways to be paid and marks one as primary.
 * Payroll pays 100% of the net to the PRIMARY VERIFIED method (payroll-engine.service).
 *
 *  - The employee registers / edits their own data → status 'pending'. HR, finance or admin verify or reject it
 *    (reason required). Nobody verifies their own method except an admin.
 *  - Editing a verified method creates a pending replacement (replaces_id); the verified one keeps being paid until
 *    the replacement is verified. Choosing a pending method as primary is remembered (wants_primary) and applied
 *    on verification. A reviewer's own registration of someone else's data is verified at once.
 *  - Details are stored in full (payment files need them); the owner and reviewers see them, PM/supervisor masked.
 */

const REVIEWER_ROLES = ['hr', 'finance', 'admin'];
const VIEW_MASKED_ROLES = ['pm', 'supervisor'];

const EVM = /^0x[0-9a-fA-F]{40}$/;
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ADDRESS_RULE = { BSC: EVM, Ethereum: EVM, Base: EVM, Polygon: EVM, Tron: TRON, Solana: SOLANA };

// Field definitions per type: [key, label, required, validate?]
const TYPES = {
  bank: {
    label: 'Banco',
    fields: [
      ['bank_name', 'Banco', true],
      ['account_type', 'Tipo de cuenta', true, (v) => ['Ahorro', 'Corriente'].includes(v) || 'debe ser Ahorro o Corriente'],
      ['account_number', 'Número de cuenta', true, (v) => /^[0-9][0-9 -]{4,24}$/.test(v) && v.replace(/\D/g, '').length >= 6 || 'debe tener solo números (mínimo 6 dígitos)'],
      ['holder', 'Titular de la cuenta', true],
      ['holder_id', 'Cédula del titular', false, (v) => /^[0-9][0-9 -]{5,20}$/.test(v) || 'debe tener solo números'],
      ['routing', 'Número de ruta ABA (solo EE. UU.)', false, (v) => /^\d{9}$/.test(v) || 'debe tener 9 dígitos'],
    ],
  },
  binance: {
    label: 'Binance',
    currencies: ['USDC', 'USDT'],
    networks: ['BSC', 'Ethereum', 'Tron', 'Solana', 'Base'],
    fields: [
      ['currency', 'Moneda', true],
      ['network', 'Red', true],
      ['address', 'Dirección de depósito', true],
    ],
  },
  coinbase: {
    label: 'Coinbase',
    currencies: ['USDC', 'BTC', 'ETH'],
    networks: ['Base', 'Ethereum', 'Polygon', 'Solana'],
    fields: [
      ['currency', 'Moneda', true],
      ['network', 'Red', true],
      ['address', 'Dirección de depósito', true],
    ],
  },
  western_union: {
    label: 'Western Union',
    fields: [
      ['full_name', 'Nombre completo (como en el documento)', true],
      ['country', 'País', true],
      ['city', 'Ciudad', true],
      ['document_type', 'Tipo de documento', true],
      ['document_number', 'Número de documento', true],
      ['phone', 'Teléfono', true],
    ],
  },
  paypal: {
    label: 'PayPal',
    fields: [['email', 'Correo de PayPal', true, (v) => EMAIL.test(v) || 'no es un correo válido']],
  },
};

const fail = (status, message) => { const err = new Error(message); err.status = status; return err; };
const newId = () => 'PM-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
const parse = (s) => { try { return JSON.parse(s || '{}') || {}; } catch (_) { return {}; } };
const empIdOf = (user) => (user && (user.employeeId || user.employee_id)) || null;
const isReviewer = (user) => Boolean(user && REVIEWER_ROLES.includes(user.role));
const isOwner = (user, empId) => Boolean(empIdOf(user) && empIdOf(user) === empId);
const actorName = (user) => (user && user.name) || 'System';

/** Normalized details for a type, or throws 400 naming the first problem */
function validate(type, input = {}) {
  const def = TYPES[type];
  if (!def) throw fail(400, `Método de pago no válido: "${type}". Usa Banco, Binance, Coinbase, Western Union o PayPal.`);
  const out = {};
  for (const [key, label, required, check] of def.fields) {
    const v = String(input[key] ?? '').trim();
    if (!v) {
      if (required) throw fail(400, `Falta "${label}".`);
      continue;
    }
    if (check) { const ok = check(v); if (ok !== true) throw fail(400, `"${label}" ${ok}.`); }
    out[key] = v;
  }
  if (def.currencies) {
    if (!def.currencies.includes(out.currency)) throw fail(400, `Moneda no admitida en ${def.label}: usa ${def.currencies.join(', ')}.`);
    if (!def.networks.includes(out.network)) throw fail(400, `Red no admitida en ${def.label}: usa ${def.networks.join(', ')}.`);
    const rule = ADDRESS_RULE[out.network];
    if (out.currency === 'BTC') { if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(out.address)) throw fail(400, 'La dirección no es una dirección de Bitcoin válida.'); }
    else if (rule && !rule.test(out.address)) throw fail(400, `La dirección no es válida para la red ${out.network}.`);
  }
  if (type === 'paypal') out.email = out.email.toLowerCase();
  return out;
}

// ---- masking for viewers who may not see full payout data ----
const last4 = (v) => { const s = String(v || ''); return s ? '••••' + s.replace(/\s/g, '').slice(-4) : ''; };
const midMask = (v) => { const s = String(v || ''); return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : last4(s); };
const maskEmail = (v) => { const [u, d] = String(v || '').split('@'); return d ? `${u.slice(0, 1)}***@${d}` : last4(v); };
function maskDetails(type, d) {
  const m = { ...d };
  if (m.account_number) m.account_number = last4(m.account_number);
  if (m.routing) m.routing = last4(m.routing);
  if (m.holder_id) m.holder_id = last4(m.holder_id);
  if (m.address) m.address = midMask(m.address);
  if (m.document_number) m.document_number = last4(m.document_number);
  if (m.phone) m.phone = last4(m.phone);
  if (m.email) m.email = maskEmail(m.email);
  return m;
}

/** One-line description of a method, e.g. "Binance • USDC (BSC) • 0x3aB8…9F12" (always masked) */
function summary(type, d) {
  const def = TYPES[type] || { label: type };
  const m = maskDetails(type, d);
  if (type === 'bank') return `${d.bank_name} • ${d.account_type || ''} ${m.account_number}`.trim();
  if (type === 'binance' || type === 'coinbase') return `${def.label} • ${d.currency} (${d.network}) • ${m.address}`;
  if (type === 'western_union') return `Western Union • ${d.full_name} • ${d.city}, ${d.country}`;
  if (type === 'paypal') return `PayPal • ${m.email}`;
  return def.label;
}

/** How payroll disburses a method: bank file, USDC batch on Base, or a manual payment */
function channelOf(type, d) {
  if (type === 'bank') return 'bank';
  if ((type === 'binance' || type === 'coinbase') && d.currency === 'USDC' && d.network === 'Base') return 'usdc';
  return 'manual';
}

function rowOut(r, { full }) {
  const details = parse(r.details_json);
  return {
    id: r.id,
    employeeId: r.employee_id,
    type: r.type,
    typeLabel: (TYPES[r.type] || {}).label || r.type,
    details: full ? details : maskDetails(r.type, details),
    summary: summary(r.type, details),
    channel: channelOf(r.type, details),
    isPrimary: Number(r.is_primary) === 1,
    wantsPrimary: Number(r.wants_primary) === 1,
    status: r.status,
    replacesId: r.replaces_id || null,
    reviewNote: r.review_note || '',
    reviewedBy: r.reviewed_by || null,
    reviewedAt: r.reviewed_at || null,
    createdBy: r.created_by || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowsOf(empId) {
  return db.query(`SELECT * FROM payout_methods WHERE employee_id = ?`, [empId])
    .sort((a, b) => (Number(b.is_primary) - Number(a.is_primary)) || String(a.created_at).localeCompare(String(b.created_at)));
}

function getRow(id) {
  const r = db.getOne(`SELECT * FROM payout_methods WHERE id = ?`, [id]);
  if (!r) throw fail(404, 'No se encontró ese método de pago.');
  return r;
}

function assertCanEdit(user, empId) {
  if (!isOwner(user, empId) && !isReviewer(user)) throw fail(403, 'Solo la persona o HR, finanzas o un administrador pueden cambiar estos datos de pago.');
}

// A reviewer's registration of SOMEONE ELSE's data is verified at once; your own always waits (admin excepted)
const verifiesOnSave = (user, empId) => isReviewer(user) && (!isOwner(user, empId) || user.role === 'admin');

function setPrimaryInternal(empId, id) {
  for (const r of rowsOf(empId)) {
    const want = r.id === id ? 1 : 0;
    if (Number(r.is_primary) !== want) db.execute(`UPDATE payout_methods SET is_primary = ? WHERE id = ?`, [want, r.id]);
  }
}

function audit(user, action, row, extra = {}) {
  logAction({ actor: actorName(user), action, entityType: 'payout_method', entityId: row.id, newValues: { employeeId: row.employee_id, type: row.type, ...extra } });
}

const service = {
  TYPES,
  channelOf,
  summary,
  maskDetails,

  /** The method payroll pays to (verified + primary), with full details, or null */
  primaryFor(empId) {
    const r = db.query(`SELECT * FROM payout_methods WHERE employee_id = ? AND is_primary = 1`, [empId]).find((x) => x.status === 'verified');
    return r ? rowOut(r, { full: true }) : null;
  },

  byId(id) {
    const r = db.getOne(`SELECT * FROM payout_methods WHERE id = ?`, [id]);
    return r ? rowOut(r, { full: true }) : null;
  },

  list(empId, user) {
    const full = isOwner(user, empId) || isReviewer(user);
    if (!full && !(user && VIEW_MASKED_ROLES.includes(user.role))) throw fail(403, 'No tienes permiso para ver los datos de pago de esta persona.');
    return rowsOf(empId).map((r) => rowOut(r, { full }));
  },

  /** Pending registrations for the reviewers' queue */
  pending(user) {
    if (!isReviewer(user)) throw fail(403, 'Solo HR, finanzas o un administrador verifican datos de pago.');
    const names = new Map(db.query(`SELECT id, name FROM employees`).map((e) => [e.id, e.name]));
    return db.query(`SELECT * FROM payout_methods WHERE status = 'pending'`)
      .map((r) => ({ ...rowOut(r, { full: true }), employeeName: names.get(r.employee_id) || r.employee_id }))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  },

  // atHire: the person creating the employee (PM included) registers the data typed in Add Employee
  create(empId, { type, details, primary } = {}, user, { atHire = false } = {}) {
    if (!db.getOne(`SELECT id FROM employees WHERE id = ?`, [empId])) throw fail(404, 'No se encontró el empleado.');
    if (!atHire) assertCanEdit(user, empId);
    const clean = validate(type, details);
    const verified = verifiesOnSave(user, empId);
    const hasPrimary = rowsOf(empId).some((r) => Number(r.is_primary) === 1);
    const id = newId();
    const now = new Date().toISOString();
    db.transaction(() => {
      db.execute(
        `INSERT INTO payout_methods (id, employee_id, type, details_json, is_primary, wants_primary, status, replaces_id, created_by, created_at, updated_at, reviewed_by, reviewed_at, review_note)
         VALUES (?, ?, ?, ?, 0, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
        [id, empId, type, JSON.stringify(clean), primary || !hasPrimary ? 1 : 0, verified ? 'verified' : 'pending', actorName(user), now, now, verified ? actorName(user) : null, verified ? now : null]
      );
      if (verified && (primary || !hasPrimary)) setPrimaryInternal(empId, id);
      audit(user, 'PAYOUT_METHOD_CREATED', { id, employee_id: empId, type }, { status: verified ? 'verified' : 'pending', primary: Boolean(primary) });
    });
    return rowOut(getRow(id), { full: true });
  },

  update(id, { details } = {}, user) {
    const row = getRow(id);
    assertCanEdit(user, row.employee_id);
    const clean = validate(row.type, details);
    const now = new Date().toISOString();
    const verified = verifiesOnSave(user, row.employee_id);
    if (row.status === 'verified' && !verified) {
      // Keep paying the verified data until the change is checked: the edit becomes a pending replacement
      const old = rowsOf(row.employee_id).find((r) => r.replaces_id === row.id && r.status === 'pending');
      if (old) db.execute(`DELETE FROM payout_methods WHERE id = ?`, [old.id]);
      const nid = newId();
      db.transaction(() => {
        db.execute(
          `INSERT INTO payout_methods (id, employee_id, type, details_json, is_primary, wants_primary, status, replaces_id, created_by, created_at, updated_at, reviewed_by, reviewed_at, review_note)
           VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?, ?, NULL, NULL, NULL)`,
          [nid, row.employee_id, row.type, JSON.stringify(clean), Number(row.is_primary) === 1 ? 1 : Number(row.wants_primary) || 0, row.id, actorName(user), now, now]
        );
        audit(user, 'PAYOUT_METHOD_CHANGE_REQUESTED', { id: nid, employee_id: row.employee_id, type: row.type }, { replaces: row.id });
      });
      return rowOut(getRow(nid), { full: true });
    }
    db.transaction(() => {
      db.execute(
        `UPDATE payout_methods SET details_json = ?, status = ?, updated_at = ?, reviewed_by = ?, reviewed_at = ?, review_note = NULL WHERE id = ?`,
        [JSON.stringify(clean), verified ? 'verified' : 'pending', now, verified ? actorName(user) : null, verified ? now : null, id]
      );
      if (verified && Number(row.wants_primary) === 1) setPrimaryInternal(row.employee_id, id);
      audit(user, 'PAYOUT_METHOD_UPDATED', row, { status: verified ? 'verified' : 'pending' });
    });
    return rowOut(getRow(id), { full: true });
  },

  verify(id, user) {
    const row = getRow(id);
    if (!isReviewer(user)) throw fail(403, 'Solo HR, finanzas o un administrador verifican datos de pago.');
    if (isOwner(user, row.employee_id) && user.role !== 'admin') throw fail(403, 'No puedes verificar tus propios datos de pago: debe hacerlo otra persona de HR, finanzas o un administrador.');
    if (row.status !== 'pending') throw fail(409, 'Este método no está pendiente de verificación.');
    const now = new Date().toISOString();
    db.transaction(() => {
      let makePrimary = Number(row.wants_primary) === 1;
      if (row.replaces_id) {
        const old = db.getOne(`SELECT * FROM payout_methods WHERE id = ?`, [row.replaces_id]);
        if (old) {
          makePrimary = makePrimary || Number(old.is_primary) === 1;
          db.execute(`DELETE FROM payout_methods WHERE id = ?`, [old.id]);
        }
      }
      db.execute(`UPDATE payout_methods SET status = 'verified', replaces_id = NULL, reviewed_by = ?, reviewed_at = ?, review_note = NULL, updated_at = ? WHERE id = ?`, [actorName(user), now, now, id]);
      const hasPrimary = rowsOf(row.employee_id).some((r) => r.id !== id && Number(r.is_primary) === 1 && r.status === 'verified');
      if (makePrimary || !hasPrimary) setPrimaryInternal(row.employee_id, id);
      audit(user, 'PAYOUT_METHOD_VERIFIED', row, { primary: makePrimary || !hasPrimary });
    });
    return rowOut(getRow(id), { full: true });
  },

  reject(id, note, user) {
    const row = getRow(id);
    if (!isReviewer(user)) throw fail(403, 'Solo HR, finanzas o un administrador verifican datos de pago.');
    if (row.status !== 'pending') throw fail(409, 'Este método no está pendiente de verificación.');
    if (!String(note || '').trim()) throw fail(400, 'Indica el motivo del rechazo: la persona lo verá para corregir sus datos.');
    const now = new Date().toISOString();
    db.transaction(() => {
      db.execute(`UPDATE payout_methods SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ?, updated_at = ? WHERE id = ?`, [actorName(user), now, String(note).trim(), now, id]);
      audit(user, 'PAYOUT_METHOD_REJECTED', row, { note: String(note).trim() });
    });
    return rowOut(getRow(id), { full: true });
  },

  setPrimary(id, user) {
    const row = getRow(id);
    assertCanEdit(user, row.employee_id);
    if (row.status === 'rejected') throw fail(409, 'Un método rechazado no puede ser el principal: corrígelo primero.');
    db.transaction(() => {
      if (row.status === 'verified') {
        setPrimaryInternal(row.employee_id, id);
        for (const r of rowsOf(row.employee_id)) if (Number(r.wants_primary) === 1 && r.id !== id) db.execute(`UPDATE payout_methods SET wants_primary = 0 WHERE id = ?`, [r.id]);
      } else {
        for (const r of rowsOf(row.employee_id)) db.execute(`UPDATE payout_methods SET wants_primary = ? WHERE id = ?`, [r.id === id ? 1 : 0, r.id]);
      }
      audit(user, 'PAYOUT_METHOD_PRIMARY', row, { applied: row.status === 'verified' });
    });
    return service.list(row.employee_id, user);
  },

  remove(id, user) {
    const row = getRow(id);
    assertCanEdit(user, row.employee_id);
    if (Number(row.is_primary) === 1 && row.status === 'verified') {
      throw fail(409, 'Es tu método principal: elige otro como principal antes de eliminarlo.');
    }
    db.transaction(() => {
      // A pending replacement of this method goes with it
      for (const r of rowsOf(row.employee_id)) if (r.replaces_id === id) db.execute(`DELETE FROM payout_methods WHERE id = ?`, [r.id]);
      db.execute(`DELETE FROM payout_methods WHERE id = ?`, [id]);
      audit(user, 'PAYOUT_METHOD_DELETED', row);
    });
    return { ok: true };
  },
};

module.exports = service;
