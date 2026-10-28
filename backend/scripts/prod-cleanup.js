#!/usr/bin/env node
/**
 * Production data cleanup before go-live (2026-10-28). Removes seed/demo/test data and duplicate logins from
 * PRODUCTION Firestore while keeping the real staff, their real login and everything created on/after go-live.
 *
 *   node scripts/prod-cleanup.js                       → DRY RUN from backend/data/firestore_cache.json (writes nothing)
 *   node scripts/prod-cleanup.js --apply               → reads LIVE Firestore, shows the real plan, asks to type
 *                                                         LIMPIAR PRODUCCION, applies category by category
 *   --only users,sessions,…                            → restrict to some categories (names below)
 *   --confirmar                                        → also apply the items marked "confirmar" (employee
 *                                                         project / manager values); without it they are only listed
 *
 * Categories (in apply order): users, passwords, sessions, employees, contractors, payroll_runs, test_employees,
 * timesheets, pay_periods, holidays, jira_issues, activities, worklogs, audit_logs, jira_projects, review (list only,
 * never written), test_fixtures.
 *
 * Safety
 *  - Nothing is written in dry run (not even the cache file). Temporary passwords are only generated/printed in --apply.
 *  - --apply moves the local snapshot aside BEFORE the db layer loads it, so the plan is computed from live Firestore
 *    only (the adapter merges the snapshot under the live docs, which would resurrect stale records). If Firestore
 *    cannot be read the snapshot is put back and nothing is changed.
 *  - Logins / employees / contractors created on or after GO_LIVE (America/Santo_Domingo) are never touched.
 *    The last active admin is never removed or disabled.
 *  - Audit rows are exported to backend/data/audit-export-<timestamp>.json before they are deleted.
 *  - After a successful apply the local snapshot is rewritten from the cleaned live data (deleted if any write failed,
 *    so the next boot hydrates from Firestore). The pre-cleanup snapshot is kept as
 *    backend/data/firestore_cache.before-prod-cleanup-<timestamp>.json — delete it once you are satisfied.
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { verifyPassword, generateTempPassword, generateSalt, hashPassword } = require('../src/utils/crypto'); // pure, no DB
const testArtifacts = require('./cleanup-test-artifacts'); // exports fingerprints only (main runs only when executed)

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CONFIRMAR = args.includes('--confirmar');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? String(args[onlyIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : null;

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'firestore_cache.json');
const CONFIRM_TEXT = 'LIMPIAR PRODUCCION';
const ACTOR = 'prod-cleanup script';

const GO_LIVE = '2026-10-28'; // records created on/after this local date are real
const TZ = 'America/Santo_Domingo';
const ACTIVITY_CUTOFF = '2026-10-01'; // activities / operational rows dated before this are seed data

const CATEGORIES = ['users', 'passwords', 'sessions', 'employees', 'contractors', 'payroll_runs', 'test_employees',
  'timesheets', 'pay_periods', 'holidays', 'jira_issues', 'activities', 'worklogs', 'audit_logs', 'jira_projects',
  'review', 'test_fixtures'];

const REAL_STAFF = ['MGH-1001', 'MGH-1042', 'MGH-1043', 'MGH-1044', 'MGH-1045', 'MGH-1046', 'MGH-1179'];
const COMPANY_DOMAINS = ['myglobalhub.net', 'myglobalhub.com'];
const SEEDED_PASSWORDS = ['Password123!', 'AdminPassword123!'];
const REAL_ORG = 'MGH Dominicana SRL';
const FAKE_ORGS = ['MGH USA Inc.', 'MGH UK Ltd.'];

const FAKE_ACCTS = ['9876543210', '1029384756', '2039485761', '3049586712', '4059687123', '5069788234'];
const FAKE_ROUTING = ['021000021'];
const FAKE_NIDS = ['001-1829472-3'];
const FAKE_LOCS = ['Miami, FL'];
const CONFIRM_PROJECTS = ['MSHP — Project Planning', 'Global Platform'];
const CONFIRM_MGRS = ['Board of Directors'];
// Placeholder values (same rules as clear-placeholder-contractor-data.js)
const WALLETS = ['0x3aB858B5d06456EaFeEfa24e86895315B91a9F12', '0x3aB8…9F12'];
const PLACEHOLDER_ACCT = '2039485761';
const PHONES = ['+1 809 555 0192', '+1 555-0100'];
const START = 'Feb 10, 2024';
const BANK = 'Banco BHD León';

const DEMO_PEOPLE = ['Elena Rostova', 'Carlos Mendez', 'Sofia Almonte', 'David Wu', 'Roberto Gomez', 'Marcus Vance',
  'Marcus Calderon', 'Ana Gómez', 'Valeria Soto'];
const DEMO_ISSUE_ASSIGNEES = ['Elena Rostova', 'Carlos Mendez', 'Sofia Almonte', 'David Wu'];
const AUDIT_TEST_ACTORS = ['Test Runner', 'Test Auditor', 'Test HR Manager', 'Test User', 'verification_script'];
const AUDIT_TEST_ACTIONS = ['STAGING_AUDIT_VERIFY', 'FIRESTORE_VERIFY', 'FIRESTORE_VERIFY_UPDATED', 'VERIFY_FIREBASE_DIRECT_WRITE'];
const AUDIT_FAKE_ACTORS = ['Elena Rostova', 'Carlos Mendez', 'Roberto Gomez', 'Marcus Vance', 'Marcus Calderon',
  'Auditor Compliance', 'Compliance Auditor', 'Admin User', 'Ana Gómez (HR)'];
const DEMO_JIRA_KEY = /^(MSH|ATLAS|PERF)-\d+$/;

// Dominican Republic national holidays 2026 (Ley 139-97 moves some to Monday): verify against the official decree
const DR_HOLIDAYS_2026 = [
  ['2026-01-01', 'Año Nuevo'], ['2026-01-05', 'Día de Reyes (trasladado del 6)'], ['2026-01-21', 'Día de la Altagracia'],
  ['2026-01-26', 'Día de Duarte'], ['2026-02-27', 'Día de la Independencia'], ['2026-04-03', 'Viernes Santo'],
  ['2026-05-04', 'Día del Trabajo (trasladado del 1)'], ['2026-06-04', 'Corpus Christi'],
  ['2026-08-16', 'Día de la Restauración'], ['2026-09-24', 'Día de las Mercedes'],
  ['2026-11-09', 'Día de la Constitución (trasladado del 6)'], ['2026-12-25', 'Navidad'],
];

/* ------------------------------------------------------------------ helpers */

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
// created_at is either SQLite UTC "YYYY-MM-DD HH:MM:SS" or ISO; returns the local (Santo Domingo) date or null
function localDay(v) {
  if (!v) return null;
  let s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : dayFmt.format(d);
}
const createdAfterGoLive = (row) => { const d = localDay(row && row.created_at); return Boolean(d && d >= GO_LIVE); };
const ts = (v) => { if (!v) return 0; let s = String(v); if (/^\d{4}-\d{2}-\d{2} /.test(s)) s = s.replace(' ', 'T') + 'Z'; const t = Date.parse(s); return Number.isNaN(t) ? 0 : t; };
const domainOf = (email) => String(email || '').toLowerCase().split('@')[1] || '';
const localOf = (email) => String(email || '').toLowerCase().split('@')[0] || '';
const isActive = (u) => Number(u.is_active) !== 0;
const dayOf = (v) => (v ? String(v).slice(0, 10) : '');

// store: Map(collection → Map(docId → doc)). rows(col) returns docs with id = Firestore doc id.
function makeAccess(store) {
  const rows = (col) => Array.from((store.get(col) || new Map()).entries()).map(([id, doc]) => ({ ...doc, id }));
  return { rows, get: (col, id) => { const m = store.get(col); const d = m && m.get(String(id)); return d ? { ...d, id: String(id) } : null; } };
}

/* -------------------------------------------------------------------- plan */

// Each category returns { deletes: [{col,id,reason,label}], updates: [{col,id,label,reason,changes:[{field,from,to}],confirm}],
// inserts: [{col,id,doc,reason,confirm}], resets: [{id,email,name}], review: [{col,id,reason}], warnings: [string] }
const empty = () => ({ deletes: [], updates: [], inserts: [], resets: [], review: [], warnings: [] });

function planUsers(A, ctx) {
  const out = empty();
  const users = A.rows('users');
  const employees = new Map(A.rows('employees').map((e) => [e.id, e]));
  // Group company-domain logins of the same person: by employee_id, or by the email local part when unlinked
  const groups = new Map();
  for (const u of users) {
    if (!COMPANY_DOMAINS.includes(domainOf(u.email))) continue; // Google / personal logins are kept
    const key = u.employee_id ? 'emp:' + u.employee_id : 'local:' + localOf(u.email);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }
  const rank = (u) => {
    const emp = u.employee_id ? employees.get(u.employee_id) : null;
    return [ts(u.last_login_at), domainOf(u.email) === 'myglobalhub.net' ? 1 : 0,
      emp && String(emp.email || '').toLowerCase() === String(u.email || '').toLowerCase() ? 1 : 0, isActive(u) ? 1 : 0, -ts(u.created_at)];
  };
  const cmp = (a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] - ra[i]; return 0; };
  const removed = new Set();
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(cmp);
    const keep = sorted[0];
    const emp = keep.employee_id ? employees.get(keep.employee_id) : null;
    if (emp && emp.email && String(emp.email).toLowerCase() !== String(keep.email).toLowerCase()) {
      out.warnings.push(`${emp.id} ${emp.name}: se conserva el login ${keep.email} pero la ficha del empleado dice ${emp.email} (revisar cual es el correo real)`);
    }
    for (const u of sorted.slice(1)) {
      if (createdAfterGoLive(u)) { out.warnings.push(`login ${u.id} (${u.email}) duplica a ${keep.id} pero fue creado el ${localDay(u.created_at)}: se conserva`); continue; }
      const why = String(u.email).toLowerCase() === String(keep.email).toLowerCase() ? 'mismo email que' : 'login extra de la misma persona que';
      out.deletes.push({ col: 'users', id: u.id, label: `${u.email} • ${u.name || ''} • ultimo acceso ${u.last_login_at || 'nunca'}`,
        reason: `${why} ${keep.id} (${keep.email}, ultimo acceso ${keep.last_login_at || 'nunca'}) — ${key.replace(/^emp:/, 'empleado ').replace(/^local:/, 'cuenta ')}` });
      removed.add(u.id);
    }
  }
  // Generic "Admin System" account (no employee behind it) → disable, unless it is the last active admin
  const activeAdminsLeft = () => users.filter((u) => u.role === 'admin' && isActive(u) && !removed.has(u.id));
  for (const u of users) {
    if (removed.has(u.id) || u.employee_id || u.role !== 'admin' || !isActive(u) || !/^admin\b/i.test(u.name || '')) continue;
    if (createdAfterGoLive(u)) continue;
    if (activeAdminsLeft().filter((x) => x.id !== u.id).length === 0) { out.warnings.push(`${u.id} (${u.email}) es el unico admin activo: NO se desactiva`); continue; }
    out.updates.push({ col: 'users', id: u.id, label: `${u.email} • ${u.name}`, reason: 'cuenta admin generica sin empleado: se desactiva (no se borra)',
      changes: [{ field: 'is_active', from: u.is_active, to: 0 }] });
    removed.add(u.id); // counts as not-active for the last-admin check
  }
  // Never remove the last active admin: put back the best-ranked admin if the plan would leave none
  if (users.some((u) => u.role === 'admin' && isActive(u)) && activeAdminsLeft().length === 0) {
    const best = users.filter((u) => u.role === 'admin' && isActive(u)).sort(cmp)[0];
    out.deletes = out.deletes.filter((d) => d.id !== best.id);
    out.updates = out.updates.filter((d) => d.id !== best.id);
    removed.delete(best.id);
    out.warnings.push(`se conserva ${best.id} (${best.email}) para no dejar el sistema sin admin activo`);
  }
  // Sessions of removed / disabled logins
  for (const s of A.rows('sessions')) if (removed.has(s.user_id)) out.deletes.push({ col: 'sessions', id: s.id, label: 'sesion de ' + s.user_id, reason: 'sesion de un login eliminado/desactivado', secret: true });
  ctx.removedUsers = removed;
  ctx.deletedUserIds = new Set(out.deletes.filter((d) => d.col === 'users').map((d) => d.id));
  return out;
}

function planPasswords(A, ctx) {
  const out = empty();
  for (const u of A.rows('users')) {
    if (ctx.deletedUserIds.has(u.id) || !u.password_hash || !u.salt) continue;
    const hit = SEEDED_PASSWORDS.find((pw) => verifyPassword(pw, u.password_hash, u.salt));
    if (!hit) continue;
    if (createdAfterGoLive(u)) { out.warnings.push(`${u.email} (${u.id}) usa una contraseña sembrada pero fue creado hoy: no se toca, cambiela a mano`); continue; }
    out.resets.push({ id: u.id, email: u.email, name: u.name, active: isActive(u) && !ctx.removedUsers.has(u.id) });
    for (const s of A.rows('sessions')) if (s.user_id === u.id) out.deletes.push({ col: 'sessions', id: s.id, label: 'sesion de ' + u.id, reason: 'sesion de una cuenta con contraseña restablecida', secret: true });
  }
  return out;
}

function planSessions(A) {
  const out = empty();
  for (const s of A.rows('sessions')) out.deletes.push({ col: 'sessions', id: s.id, label: 'sesion de ' + s.user_id, reason: 'se revocan todas las sesiones: todos inician sesion de nuevo', secret: true });
  return out;
}

function employeeFieldChanges(e) {
  const fix = [], confirm = [];
  const add = (list, field, to) => list.push({ field, from: e[field], to });
  if (FAKE_ACCTS.includes(String(e.acct || ''))) {
    add(fix, 'acct', '');
    if (e.acct === PLACEHOLDER_ACCT && e.bank === BANK) add(fix, 'bank', '');
  }
  if (FAKE_ROUTING.includes(String(e.routing || ''))) add(fix, 'routing', '');
  if (FAKE_NIDS.includes(String(e.nid || ''))) add(fix, 'nid', '');
  if (WALLETS.includes(e.crypto_wallet)) {
    add(fix, 'crypto_wallet', '');
    if (Number(e.crypto_alloc) > 0) { add(fix, 'crypto_alloc', 0); add(fix, 'alloc', 100); }
  }
  if (PHONES.includes(e.phone)) add(fix, 'phone', '');
  if (e.start_date === START) add(fix, 'start_date', '');
  if (FAKE_ORGS.includes(e.entity)) add(fix, 'entity', REAL_ORG);
  if (FAKE_LOCS.includes(e.loc)) add(fix, 'loc', '');
  if (CONFIRM_PROJECTS.includes(e.project)) add(confirm, 'project', '');
  if (CONFIRM_MGRS.includes(e.mgr)) add(confirm, 'mgr', '');
  return { fix, confirm };
}

// Projects an employee belongs to only through the profile "project" text (agile.service isMember token rule)
function projectsFromProfile(value, projects) {
  const tokens = String(value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return projects.filter((p) => {
    const names = [String(p.key || p.id).toLowerCase(), String(p.name || '').toLowerCase()].filter(Boolean);
    return tokens.some((t) => names.some((n) => t === n || (t.startsWith(n) && /^[\s—–\-:(]/.test(t.slice(n.length)))));
  });
}

function planEmployees(A, ctx) {
  const out = empty();
  const projects = A.rows('jira_projects');
  const members = A.rows('project_members');
  for (const e of A.rows('employees')) {
    if (ctx.testEmployeeIds.has(e.id)) continue;
    if (createdAfterGoLive(e)) continue;
    const { fix, confirm } = employeeFieldChanges(e);
    if (fix.length) out.updates.push({ col: 'employees', id: e.id, label: e.name, reason: 'datos de pago/identidad/entidad de muestra', changes: fix });
    if (confirm.length) {
      out.updates.push({ col: 'employees', id: e.id, label: e.name, reason: 'valor generico de proyecto/supervisor (confirmar)', changes: confirm, confirm: true });
      const proj = confirm.find((c) => c.field === 'project');
      if (proj) {
        // Keep the project access the profile text was granting: add an explicit membership first
        for (const p of projectsFromProfile(proj.from, projects)) {
          if (members.some((m) => m.project_id === p.id && m.user_id === e.id)) continue;
          out.inserts.push({ col: 'project_members', id: null, confirm: true,
            reason: `conserva el acceso a ${p.key || p.id} "${p.name}" que daba el texto "${proj.from}" del perfil`,
            label: `${e.id} ${e.name} → ${p.key || p.id}`,
            doc: { project_id: p.id, user_id: e.id, user_name: e.name, user_email: e.email || null, role: 'member' } });
        }
      }
    }
    if (Number(e.rate) > 0) out.review.push({ col: 'employees', id: e.id, reason: `REVISAR MANUALMENTE tarifa ${e.rate} ${e.cur || ''}/h (${e.name}, valor sembrado: no se cambia)` });
    if (e.bank && !e.acct) out.review.push({ col: 'employees', id: e.id, reason: `banco "${e.bank}" sin cuenta (revisar)` });
  }
  return out;
}

function contractorFieldChanges(c) {
  const ch = [];
  const add = (field, to) => ch.push({ field, from: c[field], to });
  const walletHit = WALLETS.includes(c.wallet) || WALLETS.includes(c.wallet_full);
  if (WALLETS.includes(c.wallet)) add('wallet', '');
  if (WALLETS.includes(c.wallet_full)) add('wallet_full', '');
  if (walletHit && c.method) add('method', '');
  if (FAKE_ACCTS.includes(String(c.acct || ''))) add('acct', '');
  if (PHONES.includes(c.phone)) add('phone', '');
  if (c.start_date === START) add('start_date', '');
  if (FAKE_ORGS.includes(c.entity)) add('entity', REAL_ORG);
  if (ch.length) {
    // Weak values: only together with a strong placeholder on the same row
    if (c.bank === BANK) add('bank', '');
    if (c.city === 'Santiago') add('city', '');
    if (Number(c.rate) === 50) add('rate', 0);
  }
  return ch;
}

function planContractors(A, ctx) {
  const out = empty();
  for (const c of A.rows('contractors')) {
    if (ctx.testEmployeeIds.has(c.employee_id) || createdAfterGoLive(c)) continue;
    const changes = contractorFieldChanges(c);
    if (changes.length) out.updates.push({ col: 'contractors', id: c.id, label: c.name, reason: 'valores de muestra (billetera, cuenta, telefono, fecha…)', changes });
  }
  return out;
}

function planPayrollRuns(A) {
  const out = empty();
  const runs = A.rows('payroll_runs');
  const doomed = new Set();
  for (const r of runs) {
    const period = String(r.period_id || r.period || '');
    if (/^PR-PP-2025-/.test(r.id) || /^PP-2025-/.test(period) || Number(r.year) === 2025) {
      doomed.add(r.id);
      out.deletes.push({ col: 'payroll_runs', id: r.id, label: `${r.status || ''} • ${r.total_employees || '?'} empleados • bruto ${r.total_gross || '?'}`, reason: 'corrida de nomina de 2025 (sembrada, sin historia real antes del lanzamiento)' });
    }
  }
  const kept = new Set(runs.map((r) => r.id).filter((id) => !doomed.has(id)));
  for (const i of A.rows('payroll_run_items')) {
    if (kept.has(i.run_id)) continue;
    out.deletes.push({ col: 'payroll_run_items', id: i.id, label: `${i.employee_id || ''} ${i.employee_name || i.name || ''}`.trim(),
      reason: doomed.has(i.run_id) ? `linea de ${i.run_id}` : `linea huerfana (corrida ${i.run_id || '?'} no existe)` });
  }
  return out;
}

function testEmployeeIds(A) {
  return new Set(A.rows('employees').filter((e) => {
    const m = /^MGH-(\d+)$/.exec(e.id);
    return m && Number(m[1]) >= 1163 && Number(m[1]) <= 1178 && /^valeria soto$/i.test(String(e.name || '').trim()) && !REAL_STAFF.includes(e.id) && !createdAfterGoLive(e);
  }).map((e) => e.id));
}

function planTestEmployees(A, ctx) {
  const out = empty();
  const ids = ctx.testEmployeeIds;
  if (!ids.size) return out;
  const r = 'empleado de prueba "Valeria Soto" (fixture de tests)';
  for (const e of A.rows('employees')) if (ids.has(e.id)) out.deletes.push({ col: 'employees', id: e.id, label: `${e.name} • ${e.email || ''}`, reason: r });
  const testUsers = new Set();
  for (const u of A.rows('users')) if (ids.has(u.employee_id) && !createdAfterGoLive(u)) { testUsers.add(u.id); out.deletes.push({ col: 'users', id: u.id, label: u.email, reason: 'login de ' + r }); }
  for (const s of A.rows('sessions')) if (testUsers.has(s.user_id)) out.deletes.push({ col: 'sessions', id: s.id, label: 'sesion de ' + s.user_id, reason: 'sesion de ' + r, secret: true });
  const byEmp = [['timesheets', 'employee_id'], ['daily_activities', 'employee_id'], ['contractors', 'employee_id'], ['leave_requests', 'employee_id'],
    ['attendance_punches', 'employee_id'], ['attendance_exceptions', 'employee_id'], ['project_members', 'user_id'], ['worklogs', 'employee_id'],
    ['payroll_run_items', 'employee_id'], ['payroll_adjustments', 'employee_id'], ['contractor_payments', 'employee_id']];
  for (const [col, field] of byEmp) for (const x of A.rows(col)) if (ids.has(x[field])) out.deletes.push({ col, id: x.id, label: x[field], reason: 'dato de ' + r });
  return out;
}

function planTimesheets(A, ctx) {
  const out = empty();
  for (const t of A.rows('timesheets')) {
    if (/^TS-PP-2025-/.test(t.id) || /^PP-2025-/.test(String(t.period_id || '')) || /^TS-2025-/.test(t.id)) {
      out.deletes.push({ col: 'timesheets', id: t.id, label: `${t.employee_name || t.employee_id || ''} • ${t.status || ''}`, reason: 'hoja de tiempo sembrada de 2025' });
    }
  }
  return out;
}

function planPayPeriods(A) {
  const out = empty();
  for (const p of A.rows('pay_periods')) if (/^PP-2025-/.test(p.id)) out.deletes.push({ col: 'pay_periods', id: p.id, label: p.status || '', reason: 'periodo de 2025: no hay historia real antes del lanzamiento' });
  return out;
}

function planHolidays(A) {
  const out = empty();
  const all = A.rows('holidays');
  for (const h of all) {
    if (/innovation day/i.test(String(h.description || h.name || ''))) out.deletes.push({ col: 'holidays', id: h.id, label: `${h.date} ${h.description || h.name}`, reason: 'feriado de prueba "Company Innovation Day" (fixture de tests)' });
  }
  const real = all.filter((h) => !/innovation day/i.test(String(h.description || h.name || '')));
  const near = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) <= 3 * 86400000;
  const missing = DR_HOLIDAYS_2026.filter(([d]) => !real.some((h) => h.date && near(String(h.date).slice(0, 10), d)));
  if (missing.length) out.warnings.push('faltan feriados 2026 (NO se crean; cargarlos en Configuracion y verificar el decreto oficial): ' + missing.map(([d, n]) => `${d} ${n}`).join('; '));
  return out;
}

function planJiraIssues(A) {
  const out = empty();
  for (const i of A.rows('jira_issues_cache')) {
    const who = DEMO_ISSUE_ASSIGNEES.find((n) => String(i.assignee_name || '').trim().toLowerCase() === n.toLowerCase()
      || String(i.assignee_email || '').toLowerCase().startsWith(n.toLowerCase().replace(' ', '.') + '@'));
    if (who) out.deletes.push({ col: 'jira_issues_cache', id: i.id, label: `${i.key || ''} ${String(i.summary || '').slice(0, 60)}`, reason: `ticket demo asignado a "${who}" (persona inexistente)` });
  }
  return out;
}

function planActivities(A) {
  const out = empty();
  for (const a of A.rows('daily_activities')) {
    const d = dayOf(a.date);
    if (d && d < ACTIVITY_CUTOFF) out.deletes.push({ col: 'daily_activities', id: a.id, label: `${a.employee_id} • ${d} • ${a.jira_key || ''}`, reason: `actividad fechada ${d} (antes de ${ACTIVITY_CUTOFF})` });
    else if (DEMO_JIRA_KEY.test(String(a.jira_key || ''))) out.review.push({ col: 'daily_activities', id: a.id, reason: `revisar: ligada a la clave demo ${a.jira_key} (${a.employee_id} ${d} "${String(a.description || '').slice(0, 50)}") — no se borra` });
  }
  return out;
}

function planWorklogs(A) {
  const out = empty();
  for (const w of A.rows('worklogs')) if (['wl-1', 'wl-2', 'wl-3'].includes(w.id)) out.deletes.push({ col: 'worklogs', id: w.id, label: `${w.employee_id} • ${w.issue_key} • ${w.hrs}h`, reason: 'registro de trabajo sembrado' });
  return out;
}

function auditReason(r) {
  const actor = String(r.actor || '');
  const action = String(r.action || '');
  if (/^audit_test_/.test(r.id)) return 'fila de test (audit_test_*)';
  if (AUDIT_TEST_ACTORS.includes(actor)) return `actor de test "${actor}"`;
  if (AUDIT_TEST_ACTIONS.includes(action) || /^TEST_/.test(action)) return `accion de test ${action.replace(/_\d{6,}$/, '_*')}`;
  if (AUDIT_FAKE_ACTORS.includes(actor)) return `actor inventado "${actor}"`;
  return null;
}

function planAuditLogs(A, ctx) {
  const out = empty();
  const known = new Set([...A.rows('employees').map((e) => e.name), ...A.rows('users').map((u) => u.name), ACTOR].map((n) => String(n || '').toLowerCase()));
  const otherActors = {};
  for (const r of A.rows('audit_logs')) {
    const why = auditReason(r);
    if (why) out.deletes.push({ col: 'audit_logs', id: r.id, label: `${r.actor} • ${r.action}`, reason: why, compact: true });
    else if (!known.has(String(r.actor || '').toLowerCase())) otherActors[r.actor] = (otherActors[r.actor] || 0) + 1;
  }
  const list = Object.entries(otherActors).sort((a, b) => b[1] - a[1]);
  if (list.length) out.review.push({ col: 'audit_logs', id: '-', reason: 'revisar (se conservan): actores que no son un empleado/login actual: ' + list.map(([a, n]) => `"${a}" ×${n}`).join(', ') });
  return out;
}

function planJiraProjects(A) {
  const out = empty();
  for (const p of A.rows('jira_projects')) {
    if (createdAfterGoLive(p)) continue;
    const ch = [];
    if (Number(p.budget) === 50000) ch.push({ field: 'budget', from: p.budget, to: null });
    if (Number(p.bill) === 100) ch.push({ field: 'bill', from: p.bill, to: null });
    if (ch.length) out.updates.push({ col: 'jira_projects', id: p.id, label: p.name, reason: 'presupuesto/tarifa por defecto del seeder', changes: ch });
  }
  return out;
}

function planTestFixtures(A) {
  const out = empty();
  const all = (c) => A.rows(c);
  const add = (sel, why) => { for (const [col, ids] of Object.entries(sel)) for (const id of ids) out.deletes.push({ col, id, label: '', reason: why }); };
  add(testArtifacts.selectors(all), 'fixture de tests (huellas de cleanup-test-artifacts.js)');
  add(testArtifacts.demoSelectors(all), 'registro demo del seeder antiguo (cleanup-test-artifacts.js --include-demo)');
  for (const d of out.deletes) {
    const r = A.get(d.col, d.id);
    if (r) d.label = [r.name || r.employee_name || r.email || r.original_name || r.description || r.key || '', r.date || r.from_date || ''].filter(Boolean).join(' • ').slice(0, 80);
    if (d.col === 'sessions') d.secret = true;
  }
  return out;
}

function planReview(A) {
  const out = empty();
  const cols = ['payroll_adjustments', 'contractor_payments', 'leave_requests', 'attendance_punches', 'attendance_exceptions'];
  const demo = DEMO_PEOPLE.map((n) => n.toLowerCase());
  for (const col of cols) {
    for (const r of A.rows(col)) {
      const dates = ['date', 'from_date', 'to_date', 'period_start', 'pay_date', 'paid_at', 'created_at'].map((f) => dayOf(r[f])).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      const old = dates.find((d) => d < ACTIVITY_CUTOFF);
      const text = Object.values(r).filter((v) => typeof v === 'string').join(' ').toLowerCase();
      const name = demo.find((n) => text.includes(n));
      if (old || name) out.review.push({ col, id: r.id, reason: `revisar: ${old ? 'fechado ' + old : ''}${old && name ? ', ' : ''}${name ? 'nombre demo "' + name + '"' : ''} (no se borra)` });
    }
  }
  return out;
}

function buildPlan(A) {
  const ctx = { testEmployeeIds: testEmployeeIds(A) };
  const builders = {
    users: planUsers, passwords: planPasswords, sessions: planSessions, employees: planEmployees, contractors: planContractors,
    payroll_runs: planPayrollRuns, test_employees: planTestEmployees, timesheets: planTimesheets, pay_periods: planPayPeriods,
    holidays: planHolidays, jira_issues: planJiraIssues, activities: planActivities, worklogs: planWorklogs,
    audit_logs: planAuditLogs, jira_projects: planJiraProjects, test_fixtures: planTestFixtures, review: planReview,
  };
  // users is always computed (passwords depends on it); only selected categories are shown/applied
  const plan = {};
  for (const cat of CATEGORIES) {
    const p = builders[cat](A, ctx);
    if (!ONLY || ONLY.includes(cat)) plan[cat] = p;
    // Logins kept because "users" is not selected still get their seeded password replaced
    if (cat === 'users' && ONLY && !ONLY.includes('users')) { ctx.deletedUserIds = new Set(); ctx.removedUsers = new Set(); }
  }
  // A record belongs to the first category that claims it
  const seen = new Set();
  for (const p of Object.values(plan)) {
    p.deletes = p.deletes.filter((d) => { const k = d.col + '/' + d.id; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  const deleted = seen;
  for (const p of Object.values(plan)) p.updates = p.updates.filter((u) => !deleted.has(u.col + '/' + u.id));
  return plan;
}

/* -------------------------------------------------------------------- show */

const CAT_TITLES = {
  users: '1. users — logins duplicados / extra', passwords: '2. contraseñas sembradas (Password123! / AdminPassword123!)',
  sessions: '3. sessions — revocar todas', employees: '4. employees — datos de muestra', contractors: '5. contractors — valores de muestra',
  payroll_runs: '6a. payroll_runs / payroll_run_items de 2025', test_employees: '6b. empleados de prueba "Valeria Soto" MGH-1163…1178',
  timesheets: '7. timesheets sembradas TS-PP-2025-*', pay_periods: '8. pay_periods PP-2025-*', holidays: '9. holidays de prueba',
  jira_issues: '10. jira_issues_cache demo', activities: '11. daily_activities', worklogs: '12. worklogs sembrados',
  audit_logs: '13. audit_logs de test / actores inventados', jira_projects: '14. jira_projects — valores por defecto',
  test_fixtures: '16. otros fixtures de test y registros demo (cleanup-test-artifacts.js)',
  review: '15. payroll_adjustments / contractor_payments / leave_requests / attendance_* (solo revisar)',
};

function wrapIds(ids, indent) {
  const lines = []; let cur = '';
  for (const id of ids) { if (cur && (cur.length + id.length + 2) > 110) { lines.push(cur); cur = ''; } cur += (cur ? ', ' : '') + id; }
  if (cur) lines.push(cur);
  return lines.map((l) => indent + l).join('\n');
}

function show(plan) {
  let nDel = 0, nUpd = 0, nIns = 0, nReset = 0, nRev = 0;
  for (const [cat, p] of Object.entries(plan)) {
    const count = p.deletes.length + p.updates.length + p.inserts.length + p.resets.length;
    const perCol = {};
    for (const d of p.deletes) perCol[d.col] = (perCol[d.col] || 0) + 1;
    const delTxt = Object.keys(perCol).length ? Object.entries(perCol).map(([c, n]) => `${n} ${c}`).join(' + ') : '0';
    console.log(`\n=== ${CAT_TITLES[cat]}  [${cat}]  → borrar ${delTxt} |${p.updates.length} actualizar, ${p.inserts.length} crear, ${p.resets.length} restablecer${p.review.length ? ', ' + p.review.length + ' revisar' : ''}`);
    if (!count && !p.review.length && !p.warnings.length) console.log('   (nada)');
    // deletes: secret (session tokens) and compact (audit rows) are grouped by reason; the rest one per line
    const groups = new Map();
    for (const d of p.deletes) {
      if (d.secret || d.compact) { const k = d.col + '|' + d.reason; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
      else console.log(`   BORRAR     ${d.col}/${d.id}${d.label ? '  (' + d.label + ')' : ''}\n              motivo: ${d.reason}`);
    }
    for (const [k, list] of groups) {
      const [col, reason] = k.split('|');
      if (list[0].secret) console.log(`   BORRAR     ${col}: ${list.length} documentos — ${reason} (ids = tokens, no se muestran)`);
      else { console.log(`   BORRAR     ${col}: ${list.length} — motivo: ${reason}`); console.log(wrapIds(list.map((d) => String(d.id)), '              ')); }
    }
    for (const u of p.updates) {
      const tag = u.confirm ? (CONFIRMAR ? '  [confirmar: se aplica con --confirmar]' : '  [confirmar: NO se aplica sin --confirmar]') : '';
      console.log(`   ACTUALIZAR ${u.col}/${u.id}  (${u.label || ''})${tag}\n              motivo: ${u.reason}`);
      for (const c of u.changes) console.log('              ' + c.field.padEnd(14) + JSON.stringify(c.from) + ' → ' + JSON.stringify(c.to));
    }
    for (const i of p.inserts) {
      const tag = i.confirm ? (CONFIRMAR ? '  [confirmar]' : '  [confirmar: NO se aplica sin --confirmar]') : '';
      console.log(`   CREAR      ${i.col}  (${i.label})${tag}\n              motivo: ${i.reason}`);
    }
    for (const r of p.resets) console.log(`   RESTABLECER users/${r.id}  ${r.email}  → contraseña temporal nueva + must_change_password=1${r.active ? '' : ' (cuenta desactivada)'}`);
    for (const r of p.review) console.log(`   REVISAR    ${r.col}/${r.id}  ${r.reason}`);
    for (const w of p.warnings) console.log(`   AVISO      ${w}`);
    const applicable = (x) => !x.confirm || CONFIRMAR;
    nDel += p.deletes.length; nUpd += p.updates.filter(applicable).length; nIns += p.inserts.filter(applicable).length; nReset += p.resets.length; nRev += p.review.length;
  }
  console.log(`\nTOTAL: ${nDel} borrados, ${nUpd} actualizaciones, ${nIns} altas, ${nReset} contraseñas restablecidas` +
    `${CONFIRMAR ? '' : ' (sin los items "confirmar")'}; ${nRev} items para revisar a mano (no se tocan).`);
  return nDel + nUpd + nIns + nReset;
}

/* ------------------------------------------------------------------- apply */

function applyPlan(plan, adapter, logAction) {
  const crypto = require('crypto');
  const passwords = [];
  const now = new Date().toISOString();
  for (const [cat, p] of Object.entries(plan)) {
    if (cat === 'review') continue;
    let updated = 0, deleted = 0, created = 0;
    const touched = [];
    for (const u of p.updates) {
      if (u.confirm && !CONFIRMAR) continue;
      const patch = Object.fromEntries(u.changes.map((c) => [c.field, c.to]));
      adapter.setDocSync(u.col, u.id, { ...patch, updated_at: now }, { merge: true });
      updated++; touched.push(u.col + '/' + u.id);
    }
    for (const i of p.inserts) {
      if (i.confirm && !CONFIRMAR) continue;
      const id = `pm_${crypto.randomUUID().slice(0, 8)}`;
      adapter.setDocSync(i.col, id, { ...i.doc, id, created_at: now }, { merge: false });
      created++; touched.push(i.col + '/' + id);
    }
    for (const r of p.resets) {
      const temp = generateTempPassword();
      const salt = generateSalt();
      adapter.setDocSync('users', r.id, { password_hash: hashPassword(temp, salt), salt, must_change_password: 1, updated_at: now }, { merge: true });
      passwords.push({ email: r.email, temp, active: r.active });
      updated++; touched.push('users/' + r.id);
    }
    if (cat === 'audit_logs' && p.deletes.length) {
      const rows = p.deletes.map((d) => adapter._getCollectionMap(d.col).get(String(d.id))).filter(Boolean);
      const file = path.join(DATA_DIR, `audit-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
      console.log(`   audit_logs: ${rows.length} filas exportadas a ${file}`);
    }
    for (const d of p.deletes) {
      adapter.deleteDocSync(d.col, d.id);
      deleted++;
      if (!d.secret) touched.push(d.col + '/' + d.id);
    }
    if (!updated && !deleted && !created) continue;
    logAction({ actor: ACTOR, action: 'PROD_CLEANUP_' + cat.toUpperCase(), entityType: 'system', entityId: cat,
      newValues: { deleted, updated, created, sessionsRevoked: p.deletes.filter((d) => d.secret).length, records: touched }, ip: 'cli' });
    console.log(`   ${cat}: ${deleted} borrados, ${updated} actualizados, ${created} creados`);
  }
  return passwords;
}

/* -------------------------------------------------------------------- main */

async function main() {
  if (ONLY) {
    const bad = ONLY.filter((c) => !CATEGORIES.includes(c));
    if (bad.length || !ONLY.length) { console.error('Categorias desconocidas: ' + bad.join(', ') + '\nValidas: ' + CATEGORIES.join(', ')); process.exit(1); }
  }
  if (!APPLY) {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const store = new Map();
    for (const [col, docs] of Object.entries(raw)) {
      const m = new Map();
      if (Array.isArray(docs)) docs.forEach((d) => d && d.id != null && m.set(String(d.id), d));
      else for (const [id, d] of Object.entries(docs || {})) m.set(String(id), d);
      store.set(col, m);
    }
    console.log(`DRY RUN — copia local ${path.relative(process.cwd(), CACHE_FILE)} (lo creado desde la ultima sincronizacion no aparece). No se escribe nada.`);
    console.log(`Se conservan: empleados ${REAL_STAFF.join(', ')}, su login real, y todo login/empleado creado desde ${GO_LIVE} (${TZ}).`);
    show(buildPlan(makeAccess(store)));
    console.log('\nEjecute con --apply: lee los datos EN VIVO, recalcula y muestra el plan real y pide confirmacion antes de escribir.');
    return;
  }

  // Move the stale snapshot aside BEFORE the db layer loads it (the adapter reads it at require time and merges it
  // under the live documents), so the plan is computed from live Firestore only.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(DATA_DIR, `firestore_cache.before-prod-cleanup-${stamp}.json`);
  if (fs.existsSync(CACHE_FILE)) fs.renameSync(CACHE_FILE, backup);
  const restore = (adapter) => {
    if (adapter && adapter._saveTimeout) { clearTimeout(adapter._saveTimeout); adapter._saveTimeout = null; }
    if (fs.existsSync(backup)) { if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE); fs.renameSync(backup, CACHE_FILE); }
  };

  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  process.env.DATABASE_CLIENT = 'firestore';
  process.env.SKIP_SEED = 'true';
  if (!process.env.FIRESTORE_HYDRATION_TIMEOUT_MS) process.env.FIRESTORE_HYDRATION_TIMEOUT_MS = '60000';
  let adapter = null;
  let applying = false;
  try {
    const db = require('../src/db/connection');
    adapter = db.getAdapter();
    if (adapter.dialect !== 'firestore') throw new Error('el adaptador activo es ' + adapter.dialect + ' (¿NODE_ENV=test?), no Firestore');
    await db.initDatabase();
    if (!adapter.hydratedFromRemote) throw new Error('no se pudieron leer los datos en vivo de Firestore' + (adapter.hydrationError ? ' (' + adapter.hydrationError + ')' : ''));

    const { logAction } = require('../src/controllers/audit.controller');
    const plan = buildPlan(makeAccess(adapter.cache));
    console.log('DATOS EN VIVO de Firestore. Plan:');
    const total = show(plan);
    if (!total) { restore(adapter); console.log('\nNada que cambiar.'); return; }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((r) => rl.question(`\nAplicar estos cambios a Firestore de PRODUCCION? Escriba ${CONFIRM_TEXT} para continuar: `, r));
    rl.close();
    if (answer.trim() !== CONFIRM_TEXT) { restore(adapter); console.log('Cancelado. No se cambio nada.'); return; }

    console.log('\nAplicando…');
    applying = true;
    const passwords = applyPlan(plan, adapter, logAction);
    const results = await Promise.allSettled(Array.from(adapter.activeWrites));
    await db.flushPendingWrites();
    const failed = results.filter((r) => r.status === 'rejected').length;

    // Never let the old snapshot resurrect deleted records on the next boot
    if (adapter._saveTimeout) { clearTimeout(adapter._saveTimeout); adapter._saveTimeout = null; }
    if (failed) {
      if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
      console.error(`\n${failed} escrituras fallaron (ver errores arriba). Se borro la copia local para que el proximo arranque lea Firestore. Vuelva a ejecutar el script para completar.`);
    } else {
      const out = {};
      for (const [col, m] of adapter.cache.entries()) out[col] = Object.fromEntries(m.entries());
      fs.writeFileSync(CACHE_FILE, JSON.stringify(out, null, 2), 'utf8');
      console.log(`\nCopia local reescrita desde los datos limpios: ${CACHE_FILE}`);
    }
    console.log(`Copia previa a la limpieza (contiene los datos borrados): ${backup} — borrela cuando ya no la necesite.`);

    if (passwords.length) {
      console.log('\nCONTRASEÑAS TEMPORALES (se muestran solo esta vez; entreguelas por un canal seguro, se piden cambiar al entrar):');
      for (const p of passwords) console.log(`   ${p.email}  →  ${p.temp}${p.active ? '' : '   (cuenta desactivada)'}`);
    }
    console.log('\nListo. Todas las sesiones revocadas: cada usuario debe iniciar sesion de nuevo.');
  } catch (err) {
    if (!applying) {
      restore(adapter);
      console.error('Error: ' + err.message + '. No se cambio nada.');
    } else {
      // Some writes may already be in Firestore: drop the local copy so the next boot reads live data
      if (adapter && adapter._saveTimeout) { clearTimeout(adapter._saveTimeout); adapter._saveTimeout = null; }
      if (adapter && adapter.activeWrites) await Promise.allSettled(Array.from(adapter.activeWrites));
      if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
      console.error('Error durante la aplicacion: ' + err.message + '. Parte de los cambios pudo quedar escrita; se borro la copia local. ' +
        'Vuelva a ejecutar el script (recalcula el plan desde los datos en vivo). Copia previa: ' + backup);
    }
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
