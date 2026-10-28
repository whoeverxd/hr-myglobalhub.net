# Asistentes en reuniones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un PM/supervisor/admin que registra una actividad de tipo Reunión puede marcar asistentes; la reunión se crea también en la hoja de cada asistente (mismas horas), omitiendo a quien tenga la hoja de esa quincena bloqueada.

**Architecture:** `POST /activities` acepta `attendees: [empId]`. La ruta valida rol y tipo; un nuevo `createMeeting` en `activities.controller.js` valida asistentes, separa los que tienen hoja no editable (`skipped`) y crea todas las actividades en una transacción con el mismo `meeting_id` y `logged_by` = registrador. El formulario de `MyTimeView.jsx` añade un selector de asistentes visible solo con tipo Reunión y rol pm/supervisor/admin, y la lista muestra "Registrada por …".

**Tech Stack:** Express 5 + capa SQL propia (`src/db`, SQLite en tests / Firestore en producción), `node:test`; React 19 + Vite.

Spec: `docs/superpowers/specs/2026-10-28-meeting-attendees-design.md`

**Reglas de este repo:** todas las pruebas corren contra SQLite local (`node --test` queda fijado a SQLite por `src/db/connection.js`). Nunca contra Firebase. Usuarios de prueba sembrados (contraseña `Password123!`): `joshua@myglobalhub.net` (pm, MGH-1042), `luis@myglobalhub.net` (employee, MGH-1044), `zain@myglobalhub.net` (contractor, MGH-1043), `lissandra@myglobalhub.net` (employee, MGH-1045), `edwin@myglobalhub.net` (admin, MGH-1001).

---

### Task 0: Rama de trabajo

- [ ] **Step 1:** Desde la raíz del repo:

```bash
git checkout -b feat/meeting-attendees
git add docs/superpowers/specs/2026-10-28-meeting-attendees-design.md docs/superpowers/plans/2026-10-28-meeting-attendees.md
git commit -m "docs: spec y plan de asistentes en reuniones"
```

No incluir `backend/data/firestore_cache.json` (cambio local ajeno).

---

### Task 1: Backend — columnas, `createMeeting`, ruta y listado

**Files:**
- Modify: `backend/src/db/schema.js` (bloque de `ALTER TABLE daily_activities`, ~línea 594)
- Modify: `backend/src/controllers/activities.controller.js`
- Modify: `backend/src/routes.js` (`router.post('/activities', …)`, ~línea 993)
- Test: `backend/test/meeting_attendees.test.js` (nuevo)

- [ ] **Step 1: Escribir la prueba que falla** — `backend/test/meeting_attendees.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const db = require('../src/db');
const routes = require('../src/routes');

function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return http.createServer(app);
}

test('Meeting attendees: a PM logs one meeting and it lands on every attendee sheet', async (t) => {
  const server = setupTestServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());
  const login = async (email) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.equal(r.status, 200, 'login ' + email);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${(await r.json()).token}` };
  };
  const call = async (h, method, path, body) => {
    const r = await fetch(`${base}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, data };
  };

  const date = '2025-11-04';
  const periodId = 'PP-2025-21'; // 1–15 Nov 2025
  const ids = ['MGH-1042', 'MGH-1043', 'MGH-1044', 'MGH-1045'];
  for (const id of ids) {
    db.execute('DELETE FROM timesheets WHERE employee_id = ? AND period_id = ?', [id, periodId]);
    db.execute('DELETE FROM daily_activities WHERE employee_id = ? AND date >= ? AND date <= ?', [id, '2025-11-01', '2025-11-15']);
  }
  // Zain (contractor) already submitted this quincena (status = first review step) → must be skipped, not touched
  db.execute(
    `INSERT INTO timesheets (id, employee_id, employee_name, period_id, status) VALUES (?, ?, ?, ?, 'Supervisión PM')`,
    [`TS-${periodId}-MGH-1043`, 'MGH-1043', 'Zain', periodId]
  );
  t.after(() => db.execute('DELETE FROM timesheets WHERE id = ?', [`TS-${periodId}-MGH-1043`]));

  const pm = await login('joshua@myglobalhub.net');
  const luis = await login('luis@myglobalhub.net');
  const meeting = { date, hours: 1.5, jiraKey: 'GENERAL', jiraSummary: 'Reunion de avances', workType: 'Reunión', description: 'Seguimiento semanal' };

  // Guards
  assert.equal((await call(luis, 'POST', '/activities', { ...meeting, attendees: ['MGH-1045'] })).status, 403, 'employees cannot add attendees');
  assert.equal((await call(pm, 'POST', '/activities', { ...meeting, workType: 'Desarrollo', attendees: ['MGH-1044'] })).status, 400, 'only meetings take attendees');
  const unknown = await call(pm, 'POST', '/activities', { ...meeting, attendees: ['MGH-9999'] });
  assert.equal(unknown.status, 400, 'unknown attendee');
  assert.match(unknown.data.error, /MGH-9999/);
  assert.equal(db.query('SELECT id FROM daily_activities WHERE date = ?', [date]).length, 0, 'rejected calls create nothing');

  // Happy path: organizer + Luis + Lissandra created, Zain skipped; self and duplicates ignored
  const r = await call(pm, 'POST', '/activities', { ...meeting, attendees: ['MGH-1044', 'MGH-1045', 'MGH-1043', 'MGH-1044', 'MGH-1042'] });
  assert.equal(r.status, 201);
  assert.equal(r.data.empId, 'MGH-1042');
  assert.ok(r.data.meeting && /^MTG-/.test(r.data.meeting.id));
  assert.deepEqual([...r.data.meeting.created].sort(), ['MGH-1044', 'MGH-1045']);
  assert.equal(r.data.meeting.skipped.length, 1);
  assert.equal(r.data.meeting.skipped[0].employeeId, 'MGH-1043');
  assert.equal(r.data.meeting.skipped[0].status, 'Supervisión PM');
  assert.equal(r.data.meeting.skipped[0].periodId, periodId);

  const rows = db.query('SELECT employee_id, hours, meeting_id, logged_by FROM daily_activities WHERE date = ? ORDER BY employee_id', [date]);
  assert.deepEqual(rows.map((x) => x.employee_id), ['MGH-1042', 'MGH-1044', 'MGH-1045']);
  assert.ok(rows.every((x) => x.meeting_id === r.data.meeting.id && Number(x.hours) === 1.5));
  assert.equal(rows.find((x) => x.employee_id === 'MGH-1042').logged_by, null, "organizer's own row is not 'logged by' anyone else");
  assert.equal(rows.find((x) => x.employee_id === 'MGH-1044').logged_by, 'MGH-1042');

  // The attendee sees it as their own activity, labelled with who logged it, and can delete it while Draft
  const mine = (await call(luis, 'GET', `/activities?dateFrom=2025-11-01&dateTo=2025-11-15`)).data;
  const copy = mine.find((a) => a.date === date);
  assert.ok(copy, 'attendee sees the meeting');
  assert.equal(copy.loggedBy, 'MGH-1042');
  assert.ok(copy.loggedByName, 'organizer name resolved');
  assert.equal(copy.meetingId, r.data.meeting.id);

  // It counts toward the attendee's sheet like any other activity
  await call(luis, 'POST', '/timesheets/ensure', { periodId });
  const sheet = (await call(luis, 'GET', `/timesheets?empId=MGH-1044&periodId=${periodId}&live=1`)).data[0];
  assert.equal(Number(sheet.reg) + Number(sheet.ot || 0), 1.5);

  assert.equal((await call(luis, 'DELETE', `/activities/${copy.id}`)).status, 200);
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run (desde `backend/`): `node --test test/meeting_attendees.test.js`
Expected: FAIL — la primera aserción de guardas (403) falla porque hoy el endpoint ignora `attendees` y responde 201.


- [ ] **Step 3: Columnas nuevas** — en `backend/src/db/schema.js`, justo después de la línea `ALTER TABLE daily_activities ADD COLUMN reviewed_at TEXT;`:

```js
  // Meeting logged by a PM/supervisor for several attendees: shared id + who logged it (null = the owner)
  try { exec(`ALTER TABLE daily_activities ADD COLUMN meeting_id TEXT;`); } catch (_) {}
  try { exec(`ALTER TABLE daily_activities ADD COLUMN logged_by TEXT;`); } catch (_) {}
```

- [ ] **Step 4: Controlador** — en `backend/src/controllers/activities.controller.js`:

4a. Arriba, junto a los otros `require`:

```js
const { periodIdForDate, EDITABLE } = require('./timesheets.controller');
```

4b. En `listActivities`, antes del `return db.query(...)`, resolver nombres de quien registró:

```js
  const nameCache = new Map();
  const nameOf = (empId) => {
    if (!empId) return null;
    if (!nameCache.has(empId)) {
      const e = db.getOne('SELECT name FROM employees WHERE id = ?', [empId]);
      nameCache.set(empId, e ? e.name : empId);
    }
    return nameCache.get(empId);
  };
```

y en el objeto devuelto, después de `reviewedAt`:

```js
      meetingId: a.meeting_id || null,
      loggedBy: a.logged_by || null,
      loggedByName: nameOf(a.logged_by),
```

4c. Partir `createActivity` en validación/inserción reutilizable. Reemplazar el cuerpo de `createActivity` (desde `const empId = …` hasta su `return { … }`) por:

```js
function buildActivity(data) {
  const empId = data.employeeId || data.empId;
  const date = data.date;
  const hours = parseFloat(data.hours);

  if (!empId || !date) {
    const err = new Error('employeeId and date are required');
    err.status = 400;
    throw err;
  }

  if (isNaN(hours) || hours <= 0) {
    const err = new Error('hours must be a positive number');
    err.status = 400;
    throw err;
  }

  return {
    id: data.id || `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    empId,
    date,
    jiraKey: data.jiraKey || data.jira_key || 'GENERAL',
    jiraSummary: data.jiraSummary || data.jira_summary || data.description?.slice(0, 50) || 'General work',
    hours,
    workType: data.workType || data.work_type || 'Desarrollo',
    description: data.description || '',
    files: data.files || data.evidences || [],
    links: data.links || [],
    meetingId: data.meetingId || null,
    loggedBy: data.loggedBy || null,
  };
}

// Inserts one activity; callers wrap it in db.transaction
function insertActivity(a, user, ip) {
  db.execute(
    `INSERT INTO daily_activities (id, employee_id, date, jira_key, jira_summary, hours, work_type, description, evidences_json, links_json, meeting_id, logged_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, a.empId, a.date, a.jiraKey, a.jiraSummary, a.hours, a.workType, a.description, JSON.stringify(a.files), JSON.stringify(a.links), a.meetingId, a.loggedBy]
  );

  // Auto-acumular horas trabajadas en la tarea ágil nativa si coincide la clave
  try {
    db.execute(
      `UPDATE project_tasks
       SET logged_hours = COALESCE(logged_hours, 0) + ?,
           updated_at = (datetime('now'))
       WHERE UPPER(task_key) = ?`,
      [a.hours, a.jiraKey.toUpperCase()]
    );
  } catch (_) {}

  logAction({
    actor: user,
    action: 'CREATE_ACTIVITY',
    entityType: 'activity',
    entityId: a.id,
    newValues: { empId: a.empId, date: a.date, jiraKey: a.jiraKey, hours: a.hours, workType: a.workType, meetingId: a.meetingId, loggedBy: a.loggedBy },
    ip,
  });
}

function toResponse(a) {
  const { files, links, ...rest } = a;
  return { ...rest, files, links, createdAt: new Date().toISOString() };
}

function createActivity(data, user = 'System', ip = '127.0.0.1') {
  const a = buildActivity(data);
  db.transaction(() => insertActivity(a, user, ip));
  return toResponse(a);
}
```

Nota: en una reunión el `UPDATE project_tasks` suma las horas una vez por asistente — es correcto, son horas-persona registradas sobre esa tarea.

4d. Añadir `createMeeting` debajo de `createActivity`:

```js
/**
 * A meeting logged by a PM/supervisor/admin for several attendees: the organizer's activity plus one copy per
 * attendee, all sharing meeting_id. Attendees whose quincena sheet is no longer editable are skipped (never touched).
 * Role and work-type checks happen in the route; the organizer's own sheet check too.
 */
function createMeeting(data, attendeeIds, user = 'System', ip = '127.0.0.1') {
  const organizer = buildActivity(data);
  const ids = [...new Set((attendeeIds || []).map(String))].filter((id) => id && id !== organizer.empId);

  const attendees = ids.map((id) => ({ id, emp: db.getOne('SELECT id, name, status FROM employees WHERE id = ?', [id]) }));
  const invalid = attendees.filter((x) => !x.emp || x.emp.status === 'Terminated').map((x) => x.id);
  if (invalid.length) {
    const err = new Error(`Unknown or inactive attendees: ${invalid.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const meetingId = `MTG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  organizer.meetingId = meetingId;
  const periodId = periodIdForDate(organizer.date);
  const created = [];
  const skipped = [];
  const copies = [];
  for (const { id, emp } of attendees) {
    const ts = db.getOne('SELECT status FROM timesheets WHERE employee_id = ? AND period_id = ?', [id, periodId]);
    if (ts && !EDITABLE.includes(ts.status)) {
      skipped.push({ employeeId: id, name: emp.name, periodId, status: ts.status });
      continue;
    }
    copies.push(buildActivity({ ...data, id: undefined, employeeId: id, empId: id, meetingId, loggedBy: organizer.empId }));
    created.push(id);
  }

  db.transaction(() => {
    insertActivity(organizer, user, ip);
    for (const c of copies) insertActivity(c, user, ip);
  });

  return { ...toResponse(organizer), meeting: { id: meetingId, created, skipped } };
}
```

`buildActivity` genera un id nuevo por copia porque se pasa `id: undefined`. Si dos copias se crean en el mismo milisegundo el sufijo aleatorio las distingue.

4e. Exportar: añadir `createMeeting,` en `module.exports`.

- [ ] **Step 5: Ruta** — en `backend/src/routes.js`, dentro de `router.post('/activities', …)`, reemplazar el bloque desde `const activity = activitiesController.createActivity(` hasta `res.status(201).json(activity);` por:

```js
    const attendees = Array.isArray(body.attendees) ? body.attendees.filter(Boolean) : [];
    if (attendees.length) {
      // Only PM / supervisor / admin log a meeting for other people, and only meetings
      if (!req.user || !MEETING_ORGANIZER_ROLES.includes(req.user.role)) {
        return res.status(403).json({ error: 'Only a PM, supervisor or admin can add meeting attendees' });
      }
      if ((body.workType || body.work_type) !== 'Reunión') {
        return res.status(400).json({ error: 'Attendees can only be added to a meeting (workType Reunión)' });
      }
      return res.status(201).json(activitiesController.createMeeting(body, attendees, getUserName(req), getClientIp(req)));
    }
    const activity = activitiesController.createActivity(
      body,
      getUserName(req),
      getClientIp(req)
    );
    res.status(201).json(activity);
```

y justo encima de `function activityWriteError(`:

```js
const MEETING_ORGANIZER_ROLES = ['pm', 'supervisor', 'admin'];
```

El `activityWriteError` existente ya corre antes sobre la actividad del registrador (su propia hoja bloqueada → 409, no se crea nada).

- [ ] **Step 6: Ejecutar la prueba**

Run (desde `backend/`): `node --test test/meeting_attendees.test.js`
Expected: PASS.

- [ ] **Step 7: Suites relacionadas**

Run (desde `backend/`): `node --test test/activities.test.js test/review_flow.test.js test/timesheet_rules.test.js test/employee_removal.test.js`
Expected: PASS (sin `attendees` el comportamiento no cambió).

- [ ] **Step 8: Commit**

```bash
git add backend/src/db/schema.js backend/src/controllers/activities.controller.js backend/src/routes.js backend/test/meeting_attendees.test.js
git commit -m "feat(activities): un PM puede registrar una reunion para varios asistentes"
```

---

### Task 2: Frontend — selector de asistentes en "Registrar Tarea de Jornada"

**Files:**
- Modify: `frontend/src/kit/MyTimeView.jsx`

- [ ] **Step 1: Estado y lista de empleados** — tras `const [savingTask, setSavingTask] = useState(false);` añadir:

```jsx
  // Meeting attendees (PM / supervisor / admin logging a meeting for the people who attended)
  const canAddAttendees = ['PM', 'SUPERVISOR', 'ADMIN'].includes(employeeRole);
  const [attendees, setAttendees] = useState([]);
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [staff, setStaff] = useState([]);
  useEffect(() => {
    if (!canAddAttendees || !modalOpen || staff.length || !window.api || !window.api.employees) return;
    window.api.employees()
      .then(list => setStaff((Array.isArray(list) ? list : []).filter(e => e.status !== 'Terminated')))
      .catch(() => {});
  }, [canAddAttendees, modalOpen, staff.length]);
  const showAttendees = canAddAttendees && workType === 'Reunión' && !viewingOther;
```

Esta línea debe ir DESPUÉS de la declaración de `viewingOther` (~línea 110). Si `savingTask` está antes, colocar todo el bloque inmediatamente después de `const viewingOther = …`.

- [ ] **Step 2: Reiniciar al abrir el modal** — en `openNewTaskModal`, junto a `setLinkUrl('');`:

```jsx
    setAttendees([]);
    setAttendeeQuery('');
```

- [ ] **Step 3: Enviar y avisar** — en `handleSaveTask`, añadir al `payload` después de `links: …,`:

```jsx
        ...(showAttendees && attendees.length ? { attendees: attendees.map(a => a.id) } : {}),
```

y reemplazar:

```jsx
        await window.api.createActivity(payload);
        if (notify) notify(`Tarea guardada en base de datos para el ${taskDate}`);
```

por:

```jsx
        const saved = await window.api.createActivity(payload);
        if (notify) {
          const m = saved && saved.meeting;
          if (m) {
            const skippedText = m.skipped.length
              ? ` No se agregó a ${m.skipped.map(s => `${s.name} (hoja ${s.periodId} ${statusLabel(s.status)})`).join(', ')}.`
              : '';
            notify(`Reunión registrada para ti y ${m.created.length} asistente${m.created.length === 1 ? '' : 's'}.${skippedText}`);
          } else {
            notify(`Tarea guardada en base de datos para el ${taskDate}`);
          }
        }
```

`statusLabel(status)` ya está importado de `./MyTimesheets.jsx` (devuelve la etiqueta en español o el propio estado).

- [ ] **Step 4: Campo en el formulario** — inmediatamente después del bloque `{/* Tipo de Trabajo */}` (cierra con `</div>` tras el `.map` de `WORK_TYPES`), añadir:

```jsx
              {showAttendees && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                    Asistentes • La reunión se registrará también en sus hojas
                  </label>
                  {attendees.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {attendees.map(a => (
                        <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 6px 3px 10px', borderRadius: '999px', background: 'var(--mgh-surface-1, #EEF1FA)', color: 'var(--mgh-ink)', fontSize: '12px', fontWeight: 600 }}>
                          {a.name}
                          <button type="button" aria-label={`Quitar a ${a.name}`} onClick={() => setAttendees(attendees.filter(x => x.id !== a.id))}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'var(--mgh-ink-3)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Buscar empleado por nombre..."
                    value={attendeeQuery}
                    onChange={(e) => setAttendeeQuery(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--mgh-surface-2)', fontSize: '13px', color: 'var(--mgh-ink)' }}
                  />
                  {attendeeQuery.trim() && (
                    <div style={{ border: '1px solid var(--mgh-surface-2)', borderRadius: '8px', maxHeight: '160px', overflowY: 'auto', background: '#fff' }}>
                      {staff
                        .filter(e => e.id !== activeEmpId && !attendees.some(a => a.id === e.id))
                        .filter(e => `${e.name} ${e.id}`.toLowerCase().includes(attendeeQuery.trim().toLowerCase()))
                        .slice(0, 8)
                        .map(e => (
                          <button key={e.id} type="button"
                            onClick={() => { setAttendees([...attendees, { id: e.id, name: e.name }]); setAttendeeQuery(''); }}
                            style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--mgh-ink)', textAlign: 'left' }}>
                            <span>{e.name}</span>
                            <span style={{ color: 'var(--mgh-ink-3)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{e.id}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 5: Compilar**

Run (desde `frontend/`): `npx vite build`
Expected: build sin errores.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/kit/MyTimeView.jsx
git commit -m "feat(myentry): seleccionar asistentes al registrar una reunion"
```

---

### Task 3: Frontend — etiqueta "Registrada por …" en la lista de actividades

**Files:**
- Modify: `frontend/src/kit/MyTimeView.jsx` (render de `filteredActs.map`, bloque `{/* Description */}`)

- [ ] **Step 1:** Dentro del `<div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>` de la descripción, después del `{act.description && act.jiraSummary && ( … )}`, añadir:

```jsx
                                    {act.loggedBy && (
                                      <span style={{ font: '600 11px/15px var(--font-sans)', color: 'var(--mgh-accent, #0094CC)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>groups</span>
                                        Registrada por {act.loggedByName || act.loggedBy}
                                      </span>
                                    )}
```

- [ ] **Step 2: Compilar**

Run (desde `frontend/`): `npx vite build`
Expected: build sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/kit/MyTimeView.jsx
git commit -m "feat(myentry): mostrar quien registro una reunion en la hoja del asistente"
```

---

### Task 4: Documentación y verificación final

**Files:**
- Modify: `CLAUDE.md` (sección "Data conventions", tras el párrafo "My time (…)")

- [ ] **Step 1:** Añadir esta viñeta a `CLAUDE.md` después del párrafo que empieza por "- My time (employee, contractor, PM, supervisor":

```markdown
- Meeting attendees: a pm/supervisor/admin logging a `Reunión` activity may send `attendees: [empId]` to
  `POST /activities`; `createMeeting` (`activities.controller.js`) creates the organizer's activity plus one copy per
  active attendee (same hours, shared `meeting_id`, `logged_by` = organizer) in one transaction. Attendees whose
  quincena sheet isn't Draft/Returned are skipped and returned in `meeting.skipped`. Copies are independent of the
  organizer's row; the attendee may delete theirs while editable. This is the only exception to "owner writes".
```

- [ ] **Step 2: Suite completa**

Run (desde `backend/`): `npm test`
Expected: todas las suites PASS (SQLite aislado; el runner lo anuncia como "100% LOCAL").

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: regla de asistentes en reuniones"
```

- [ ] **Step 4: Prueba manual (opcional, sin tocar producción)** — arrancar con `DATABASE_CLIENT=sqlite DISABLE_REMOTE_FIREBASE=true` en el backend, entrar como `joshua@myglobalhub.net`, registrar una Reunión con asistentes Luis y Lissandra, y entrar como `luis@myglobalhub.net` para ver la actividad con "Registrada por …" en `#myentry`.
