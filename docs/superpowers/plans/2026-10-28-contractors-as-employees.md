# Contractors = empleados (tipo ≠ rol, sin datos inventados, una sola nómina) — Spec + Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

Fecha: 2026-10-28 · Estado: aprobado por el usuario

## Contexto y decisiones (spec)
Todos en My Global Hub son contratados; "Full-time" / "Contractor" (`employees.type`) es solo un dato de ficha.
Horas, tareas y nómina ya no distinguen el tipo (verificado: `timesheets.controller.js` y el run de nómina no miran `type`).

Problemas encontrados:
1. `syncContractorEmployees()` (`backend/src/controllers/contractors.controller.js`), que corre en cada `listContractors()`
   (dashboard bootstrap de pm/hr/admin y `GET /contractors`), llama `ensureUserForEmployee({ role: 'contractor' })` para
   todo empleado con `type` ~ contractor → **sobrescribe el rol** de cuentas existentes (pm/supervisor/hr/finance → contractor).
   `createContractor` hace lo mismo.
2. La sync y `createContractor` rellenan **datos inventados**: wallet `0x3aB858B5d06456EaFeEfa24e86895315B91a9F12` /
   `0x3aB8…9F12`, banco `Banco BHD León`, cuenta `2039485761`, teléfono `+1 809 555 0192` / `+1 555-0100`, tarifa `50`,
   ciudad `Santiago` / `Santo Domingo`, inicio `Feb 10, 2024`, mgr `Joshua Hernandez`, proyecto `MSHP — Project Planning`,
   dept `Engineering`, email inventado desde el nombre.
3. Doble flujo de pago: `#processing` ya paga a todos con hoja aprobada; Contractor Payments permitiría pagar otra vez.

Decisiones:
- **Tipo ≠ rol.** Sync y `createContractor` nunca cambian el rol de una cuenta existente. Cuenta nueva → rol `employee`.
  El admin cambia roles en "Acceso al sistema" como hoy.
- **Sin datos inventados.** Campos faltantes quedan vacíos (`''`/`null`; `rate` 0). Sin email no se crea login
  (`account.status = 'none'`) y no se inventa email.
- **Una sola nómina.** Se oculta "Contractor Payments" del menú y los botones "Payments"/"Payment History" de `#contractors`;
  `POST /contractor-payments` responde **410** `{ error: 'Los pagos van por la nómina (#processing)…' }`. Listado de pagos
  existentes (GET) se mantiene. `#contractors` sigue como ficha de cobro (método, KYC, W-8BEN).
- Script de limpieza de producción con dry-run / `--apply` + confirmación `LIMPIAR`.

Pruebas solo en SQLite local (`node --test` queda fijado a SQLite). Ejecutar archivos de prueba de uno en uno, o `npm test`.

---

### Task 1: Backend — rol intacto, sin relleno, 410 en pagos de contractor

**Files:**
- Modify: `backend/src/services/auth.service.js` (`ensureUserForEmployee`, ~línea 583)
- Modify: `backend/src/controllers/contractors.controller.js` (`syncContractorEmployees` ~68–130, `createContractor` ~165–285)
- Modify: `backend/src/routes.js` (`router.post('/contractor-payments', …)`, ~línea 439)
- Modify: `backend/test/contractors.test.js` (línea ~67 espera rol `contractor` en cuenta nueva → pasa a `employee`)
- Create: `backend/test/contractor_identity.test.js`

- [ ] **Step 1: Prueba que falla** — `backend/test/contractor_identity.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');
const contractorsController = require('../src/controllers/contractors.controller');

const PLACEHOLDERS = ['0x3aB858B5d06456EaFeEfa24e86895315B91a9F12', '0x3aB8…9F12', 'Banco BHD León', '2039485761', '+1 809 555 0192', '+1 555-0100', 'Feb 10, 2024'];

test('Contractor type never changes an existing login role', () => {
  // Joshua (MGH-1042) is pm; mark him as Contractor and run the sync (what every dashboard load does)
  const before = db.getOne(`SELECT type FROM employees WHERE id = 'MGH-1042'`);
  db.execute(`UPDATE employees SET type = 'Contractor' WHERE id = 'MGH-1042'`);
  try {
    contractorsController.listContractors();
    const roles = db.query(`SELECT role FROM users WHERE employee_id = 'MGH-1042'`).map((u) => u.role);
    assert.ok(roles.length > 0);
    assert.ok(roles.every((r) => r === 'pm'), 'pm stays pm: ' + roles.join(','));
  } finally {
    db.execute(`UPDATE employees SET type = ? WHERE id = 'MGH-1042'`, [before.type]);
    db.execute(`DELETE FROM contractors WHERE employee_id = 'MGH-1042'`);
  }
});

test('Synced contractor rows carry no invented payment or contact data', () => {
  const id = 'MGH-7701';
  db.execute(`DELETE FROM contractors WHERE employee_id = ?`, [id]);
  db.execute(`DELETE FROM users WHERE employee_id = ?`, [id]);
  db.execute(`DELETE FROM employees WHERE id = ?`, [id]);
  db.execute(
    `INSERT INTO employees (id, name, role, type, entity, status, email) VALUES (?, 'Prueba Sync', 'Dev', 'Contractor', 'MGH Dominicana SRL', 'Active', 'prueba.sync@myglobalhub.net')`,
    [id]
  );
  try {
    contractorsController.listContractors();
    const c = db.getOne(`SELECT * FROM contractors WHERE employee_id = ?`, [id]);
    assert.ok(c, 'contractor row created');
    for (const v of Object.values(c)) assert.ok(!PLACEHOLDERS.includes(v), 'placeholder value found: ' + v);
    assert.equal(Number(c.rate), 0);
    const u = db.getOne(`SELECT role FROM users WHERE employee_id = ?`, [id]);
    assert.equal(u.role, 'employee', 'new login defaults to employee');
  } finally {
    db.execute(`DELETE FROM contractors WHERE employee_id = ?`, [id]);
    db.execute(`DELETE FROM users WHERE employee_id = ?`, [id]);
    db.execute(`DELETE FROM employees WHERE id = ?`, [id]);
  }
});

test('createContractor: no invented email/data; existing role kept', () => {
  const noEmail = contractorsController.createContractor({ name: 'Sin Correo Prueba', role: 'Designer' });
  try {
    assert.equal(noEmail.account.status, 'none');
    const emp = db.getOne(`SELECT * FROM employees WHERE id = ?`, [noEmail.employeeId]);
    assert.ok(!emp.email, 'no invented email');
    assert.ok(!emp.mgr && !emp.project, 'no invented manager/project');
    const row = db.getOne(`SELECT * FROM contractors WHERE id = ?`, [noEmail.id]);
    for (const v of Object.values(row)) assert.ok(!PLACEHOLDERS.includes(v), 'placeholder value found: ' + v);
  } finally {
    db.execute(`DELETE FROM contractors WHERE id = ?`, [noEmail.id]);
    db.execute(`DELETE FROM employees WHERE id = ?`, [noEmail.employeeId]);
  }
  // Linking an existing pm login keeps pm
  const linked = contractorsController.createContractor({ name: 'Joshua Hernandez', role: 'PM', email: 'joshua@myglobalhub.net', employeeId: 'MGH-1042' });
  try {
    assert.equal(db.getOne(`SELECT role FROM users WHERE LOWER(email) = 'joshua@myglobalhub.net'`).role, 'pm');
  } finally {
    db.execute(`DELETE FROM contractors WHERE id = ?`, [linked.id]);
  }
});

test('POST /contractor-payments is gone: payments go through payroll', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'edwin@myglobalhub.net', password: 'Password123!' }) });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${(await login.json()).token}` };
  const r = await fetch(`${base}/contractor-payments`, { method: 'POST', headers: h, body: JSON.stringify({ contractorId: 'CTR-1043', amount: 100 }) });
  assert.equal(r.status, 410);
  assert.match((await r.json()).error, /nómina/);
  assert.equal((await fetch(`${base}/contractor-payments`, { headers: h })).status, 200, 'history still readable');
});
```

Nota: si `formatContractor` no expone `employeeId`/`account` como se usa arriba, revisar `createContractor`'s return (`{ ...getContractor(id), account }`, `formatContractor` mapea `employeeId: c.employee_id`). Ajustar solo la prueba si un nombre difiere.

- [ ] **Step 2:** `cd backend && node --test test/contractor_identity.test.js` → FAIL (rol cambia a contractor / placeholders / 201 en vez de 410).

- [ ] **Step 3: `ensureUserForEmployee` con `keepExistingRole`** — en `backend/src/services/auth.service.js` cambiar la firma y la rama `existing`:

```js
function ensureUserForEmployee({ email, name, role = 'employee', entity = 'MGH Dominicana SRL', employeeId, password = null, avatar = null, keepExistingRole = false }) {
```

```js
  if (existing) {
    // Linking an administrator's account never changes its role; nor does linking when the caller asks to keep it
    if (existing.role === 'admin' || keepExistingRole) role = null;
```

(Sustituye la línea `if (existing.role === 'admin') role = null; // …`.)

- [ ] **Step 4: `syncContractorEmployees` sin relleno y sin tocar roles** — reemplazar el array de valores del `INSERT` por:

```js
          [
            ctrId,
            emp.name,
            emp.role || 'Contractor',
            emp.loc || '',
            emp.email || '',
            emp.phone || '',
            emp.start_date || '',
            'Hourly',
            Number(emp.rate) || 0,
            emp.cur || 'USD',
            emp.crypto_wallet ? 'Coinbase' : (emp.bank ? 'Bank' : ''),
            emp.crypto_wallet ? (emp.crypto_wallet.slice(0, 6) + '…' + emp.crypto_wallet.slice(-4)) : '',
            emp.crypto_wallet || '',
            emp.crypto_asset || 'USDC',
            emp.crypto_network || 'Base',
            '',
            emp.name,
            (emp.loc && emp.loc.split(',')[0]) || '',
            emp.bank || '',
            emp.acct || '',
            'USD',
            1.0,
            0,
            'Active',
            emp.entity || 'MGH Dominicana SRL',
            emp.id,
          ]
```

Si `country`/`method` tienen `NOT NULL` en el esquema, `''` es válido (no es NULL).

Y en la llamada `ensureUserForEmployee` de la sync: `role: 'employee', keepExistingRole: true,` (en vez de `role: 'contractor'`).

- [ ] **Step 5: `createContractor` sin relleno y sin tocar roles:**
  - `const email = (data.email && data.email.trim()) || '';` (sin email inventado)
  - `const phone = (data.phone && data.phone.trim()) || '';`
  - `const start = data.start || data.startDate || '';`
  - `const method = data.method || '';`
  - `const delivery = data.delivery || '';`
  - `const city = data.city || '';`
  - `const country = data.country || '';`
  - `const wuFee = Number(data.wuFee) || (method === 'Western Union' ? 4.99 : 0);`
  - Búsqueda de empleado existente: si no hay email, buscar solo por nombre:
    `db.getOne(email ? 'SELECT id FROM employees WHERE LOWER(email) = ? OR LOWER(name) = ?' : 'SELECT id FROM employees WHERE LOWER(name) = ?', email ? [email.toLowerCase(), name.toLowerCase()] : [name.toLowerCase()])`
  - En el `INSERT INTO employees`: `dept` → `''`, `loc` → `[city, country].filter(Boolean).join(', ')`, `mgr` → `null`,
    `project` → `null`, `email` → `email || null`.
  - Cuenta: solo si hay email — `account = email ? ensureUserForEmployee({ email, name, role: 'employee', keepExistingRole: true, entity, employeeId, password: data.password || null, avatar: null }) : null;`
  - El `INSERT OR REPLACE INTO contractors` usa `email || null`.
  Revisar si las columnas de `contractors`/`employees` afectadas son `NOT NULL` en `backend/src/db/schema.js`; si lo son, usar `''` en vez de `null`.

- [ ] **Step 6: 410 en `POST /contractor-payments`** — en `backend/src/routes.js` reemplazar ese `router.post(...)` por:

```js
// One payroll for everyone: contractors are paid from their approved timesheets in #processing, never twice
router.post('/contractor-payments', authenticate, (req, res) => {
  res.status(410).json({ error: 'Los pagos van por la nómina (#processing): los contratistas cobran desde sus hojas aprobadas.' });
});
```

- [ ] **Step 7: Ajustar `backend/test/contractors.test.js`** — la aserción `assert.equal(userRow.role, 'contractor', 'User role must be contractor');` pasa a `assert.equal(userRow.role, 'employee', 'New login defaults to employee: the contractor type is not a role');`. Si otra prueba de ese archivo (o de `employee_removal`, `access_cleanup`, `e2e_full_lifecycle`) crea pagos de contractor vía `POST /contractor-payments` HTTP o depende de los valores de relleno, ajustarla al nuevo contrato y reportarlo. Las llamadas directas a `createContractorPayment` del controlador pueden quedarse.

- [ ] **Step 8:** `node --test test/contractor_identity.test.js` → PASS; luego `npm test` → todas PASS.

- [ ] **Step 9: Commit**
```bash
git add backend/src/services/auth.service.js backend/src/controllers/contractors.controller.js backend/src/routes.js backend/test/contractors.test.js backend/test/contractor_identity.test.js
git commit -m "fix(contractors): el tipo no cambia el rol, sin datos inventados, pagos solo por nomina"
```

---

### Task 2: Frontend — ocultar Contractor Payments

**Files:** `frontend/src/lib/payroll.js` (línea ~32, grupo `Contractors` de `NAV`), `frontend/src/kit/kit.jsx` (~4674 y ~4709)

- [ ] **Step 1:** En `NAV` (`payroll.js`), el grupo queda: `{label:'Contractors',items:[{key:'contractors',label:'Contractors',icon:'handshake'}]},`
- [ ] **Step 2:** En `kit.jsx`, quitar `<Button variant="secondary" icon="payments" onClick={() => go('contractorPayments')}>Payments</Button>` (cabecera de `Contractors`) y el botón `Payment History` del panel de detalle, dejando `Edit` solo (`<div style={{ display: 'flex', gap: 8 }}><Button variant="secondary" icon="edit" style={{ flex: 1 }} onClick={handleOpenEdit}>Edit</Button></div>`). No borrar el componente `ContractorPayments` (la ruta `#contractorPayments` puede quedar accesible por URL para ver historial).
- [ ] **Step 3:** `cd frontend && npx vite build` → OK.
- [ ] **Step 4:** Commit `feat(contractors): una sola nomina, sin menu de Contractor Payments`.

---

### Task 3: Script de limpieza en producción

**Files:** Create `backend/scripts/clear-placeholder-contractor-data.js`

Mismo patrón que `backend/scripts/set-user-role.js` (leerlo primero):
- Sin `--apply`: lee `data/firestore_cache.json` (`contractors`, y `employees`), lista por contractor/empleado los campos con valores de la lista `PLACEHOLDERS` de la spec (wallet/wallet_full, bank, acct, phone, start_date `Feb 10, 2024`, rate 50 **solo** si además tiene otro placeholder, city `Santiago`).
- Con `--apply`: carga datos vivos (`initDatabase`, exige `adapter.hydratedFromRemote`, si no → sale sin cambios), muestra el plan real, pide escribir `LIMPIAR`, pone esos campos en `''` (rate → 0, method → '' si la wallet era placeholder), `logAction({ actor: 'clear-placeholder-contractor-data script', action: 'CONTRACTOR_PLACEHOLDERS_CLEARED', … })`, `flushPendingWrites()`.
- Sin pruebas automáticas contra Firestore. Verificar solo el dry-run: `node scripts/clear-placeholder-contractor-data.js` → debe listar `CTR-1043` con wallet/bank/acct/phone.
- Commit `chore(scripts): limpiar datos de ejemplo de contractors en produccion`.

---

### Task 4: CLAUDE.md

Añadir en "Data conventions" tras "Payouts:":
```markdown
- Contractors are employees: `employees.type` (Full-time / Contractor) is only a profile field — hours, tasks and payroll
  ignore it, and it never sets the login role (`ensureUserForEmployee({ keepExistingRole: true })`; new logins = employee).
  `#contractors` is the payout profile of Contractor-type employees; one payroll for everyone (#processing):
  `POST /contractor-payments` answers 410. Never fill missing payout/contact data with sample values
  (`scripts/clear-placeholder-contractor-data.js` cleans old ones).
```
Commit `docs: contractors son empleados`.
