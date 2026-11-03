const db = require('../db');
const { logAction } = require('../controllers/audit.controller');

/*
 * Bank catalog ("Bancos", #admin): the banks a person can pick for a "Banco" payout method (payout-methods.service).
 * Managed by admin / HR / finance. A bank is never deleted (methods keep pointing at its name): it is deactivated,
 * so it is no longer offered for new registrations.
 */

const MANAGER_ROLES = ['admin', 'hr', 'finance'];

// Banks and savings associations people in the Dominican Republic use most (reference data, loaded on request)
const DR_BANKS = [
  'Banco Popular Dominicano', 'Banreservas', 'Banco BHD', 'Scotiabank', 'Banco Santa Cruz', 'Banco Promerica',
  'Banesco', 'Banco Caribe', 'Banco BDI', 'Banco Vimenca', 'Banco López de Haro', 'Banco Ademi', 'Banco Lafise',
  'Asociación Popular de Ahorros y Préstamos (APAP)', 'Asociación Cibao de Ahorros y Préstamos', 'Asociación La Nacional',
  'Qik Banco Digital',
];

const fail = (status, message) => { const err = new Error(message); err.status = status; return err; };
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const key = (s) => norm(s).toLowerCase();
const out = (b) => ({ id: b.id, name: b.name, country: b.country || '', swift: b.swift || '', active: Number(b.active) !== 0, createdBy: b.created_by || null, createdAt: b.created_at || null });

function assertManager(user) {
  if (!user || !MANAGER_ROLES.includes(user.role)) throw fail(403, 'Solo un administrador, HR o finanzas pueden gestionar los bancos.');
}

const service = {
  list({ includeInactive = false } = {}) {
    return db.query('SELECT * FROM banks').map(out)
      .filter((b) => includeInactive || b.active)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  },

  /** The catalog name matching `name` (case / spacing insensitive) among ACTIVE banks, or null */
  match(name) {
    const k = key(name);
    const b = service.list().find((x) => key(x.name) === k);
    return b ? b.name : null;
  },

  /** True once the catalog has any bank, active or not (before that, payout methods accept any bank name) */
  inUse() {
    return service.list({ includeInactive: true }).length > 0;
  },

  /**
   * The bank name to store for `name`: once the catalog is in use it must be one of its ACTIVE banks (returned in the
   * catalog's spelling) unless it is `keep` (the bank already stored, kept on edit). Empty → ''. Otherwise 400.
   */
  resolve(name, keep) {
    const n = norm(name);
    if (!n || !service.inUse() || (keep && key(n) === key(keep))) return n;
    const found = service.match(n);
    if (!found) throw fail(400, `El banco "${n}" no está en la lista de bancos: pide a HR o a un administrador que lo añada.`);
    return found;
  },

  create({ name, country, swift } = {}, user) {
    assertManager(user);
    const n = norm(name);
    if (!n) throw fail(400, 'Escribe el nombre del banco.');
    const dup = service.list({ includeInactive: true }).find((b) => key(b.name) === key(n));
    if (dup) throw fail(409, dup.active ? `"${dup.name}" ya está en la lista.` : `"${dup.name}" ya existe pero está desactivado: actívalo en lugar de crearlo de nuevo.`);
    const sw = norm(swift).toUpperCase();
    if (sw && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(sw)) throw fail(400, 'El código SWIFT debe tener 8 u 11 caracteres (ej.: BPDODOSX).');
    const id = 'BNK-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();
    db.execute('INSERT INTO banks (id, name, country, swift, active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
      [id, n, norm(country) || 'República Dominicana', sw || null, user.name || 'System', now, now]);
    logAction({ actor: user.name || 'System', action: 'BANK_CREATED', entityType: 'bank', entityId: id, newValues: { name: n, country, swift: sw } });
    return out(db.getOne('SELECT * FROM banks WHERE id = ?', [id]));
  },

  update(id, { name, country, swift, active } = {}, user) {
    assertManager(user);
    const b = db.getOne('SELECT * FROM banks WHERE id = ?', [id]);
    if (!b) throw fail(404, 'No se encontró ese banco.');
    const n = name !== undefined ? norm(name) : b.name;
    if (!n) throw fail(400, 'El nombre del banco no puede quedar vacío.');
    if (key(n) !== key(b.name) && service.list({ includeInactive: true }).some((x) => x.id !== id && key(x.name) === key(n))) throw fail(409, `"${n}" ya está en la lista.`);
    const sw = swift !== undefined ? norm(swift).toUpperCase() : (b.swift || '');
    if (sw && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(sw)) throw fail(400, 'El código SWIFT debe tener 8 u 11 caracteres (ej.: BPDODOSX).');
    const act = active !== undefined ? (active ? 1 : 0) : (Number(b.active) !== 0 ? 1 : 0);
    db.execute('UPDATE banks SET name = ?, country = ?, swift = ?, active = ?, updated_at = ? WHERE id = ?',
      [n, country !== undefined ? norm(country) : b.country, sw || null, act, new Date().toISOString(), id]);
    logAction({ actor: user.name || 'System', action: 'BANK_UPDATED', entityType: 'bank', entityId: id, oldValues: { name: b.name, active: b.active }, newValues: { name: n, active: act } });
    return out(db.getOne('SELECT * FROM banks WHERE id = ?', [id]));
  },

  /** Adds the usual Dominican banks that are not in the catalog yet; returns the names added */
  addDominicanBanks(user) {
    assertManager(user);
    const have = new Set(service.list({ includeInactive: true }).map((b) => key(b.name)));
    const added = [];
    for (const name of DR_BANKS) if (!have.has(key(name))) { service.create({ name, country: 'República Dominicana' }, user); added.push(name); }
    return added;
  },
};

module.exports = service;
