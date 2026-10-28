# Asistentes en reuniones (registro de horas) — diseño

Fecha: 2026-10-28 · Estado: aprobado

## Objetivo
Un PM / supervisor / admin que registra una actividad de tipo **Reunión** en "Registrar Tarea de Jornada"
(`#myentry`) puede marcar asistentes. Al guardar, la reunión se crea también en la hoja de cada asistente,
con las mismas horas, y cuenta para su pago como cualquier otra actividad.

## Decisiones
- **Se crea directo** en la hoja de cada asistente (sin confirmación del asistente).
- **Asistentes elegibles:** cualquier empleado/contratista activo (status distinto de Terminated), excepto quien registra.
- **Hoja del asistente fuera de Draft/Returned para esa quincena:** se omite ese asistente y se informa al PM;
  el resto se crea. No se tocan hojas bloqueadas (correcciones vía Payroll Adjustments).
- **Roles que pueden enviar asistentes:** `pm`, `supervisor`, `admin`. Cualquier otro rol que envíe `attendees` → 403.
- Solo para `workType = 'Reunión'`. `attendees` con otro tipo → 400.
- Las copias son **independientes**: editar/borrar la actividad del PM no cambia las de los asistentes.
- Sin notificaciones ni correos.

## Backend
### Datos
`daily_activities` gana dos columnas opcionales (migración SQLite; Firestore no requiere esquema):
- `meeting_id TEXT` — mismo valor (`MTG-…`) en la actividad del PM y en todas las copias.
- `logged_by TEXT` — employee id de quien registró la reunión (null en actividades propias normales).

`listActivities` devuelve ambos campos (`meetingId`, `loggedBy`, y `loggedByName` resuelto contra `employees`).

### `POST /activities`
Si el body trae `attendees` (array no vacío de employee ids):
1. Validar rol (pm/supervisor/admin), `workType === 'Reunión'`, y que cada id exista y esté activo
   (ids desconocidos/inactivos → 400 con la lista). Deduplicar y quitar al propio registrador.
2. La actividad del registrador pasa por `activityWriteError` como hoy (si su hoja está bloqueada → 409, no se crea nada).
3. Para cada asistente, `activityWriteError` sobre su `employee_id` + fecha, ignorando la regla de "solo el dueño":
   si su hoja de la quincena no es editable → va a `skipped: [{ employeeId, name, periodId, status }]`.
4. Crear todas las actividades (registrador + asistentes no omitidos) en **una transacción**, con el mismo
   `meeting_id` y `logged_by` = registrador en las copias. Un `CREATE_ACTIVITY` de auditoría por actividad,
   incluyendo `meetingId` y `loggedBy`.
5. Respuesta 201: la actividad del registrador + `meeting: { id, created: [empId…], skipped: [...] }`.

Sin `attendees` el endpoint se comporta exactamente igual que hoy. La regla general "solo el dueño escribe sus
actividades" no cambia; esta es la única excepción.

El asistente puede borrar su copia con el `DELETE /activities/:id` existente mientras su hoja sea editable.

## Frontend (`frontend/src/kit/MyTimeView.jsx`)
- Con tipo **Reunión** seleccionado y rol pm/supervisor/admin: campo **Asistentes** — buscador con chips sobre
  `api.employees()` (activos, sin el usuario actual). Componentes DS; sin emoji.
- Al guardar: `attendees` en el payload. Tras éxito, mensaje con el número de asistentes y, si los hay, los omitidos
  ("No se agregó a Zain: su hoja PP-2026-20 está Submitted").
- En la lista de actividades: si `loggedBy` está presente, etiqueta "Registrada por {loggedByName}".
- `frontend/src/lib/api.js`: `createActivity` ya envía el payload completo; sin cambios salvo si hace falta.

## Pruebas (SQLite local, nunca Firebase)
- PM con 3 asistentes → 4 actividades con el mismo `meeting_id`; copias con `logged_by` = PM.
- Asistente con hoja Submitted → en `skipped`; los demás creados.
- Empleado que envía `attendees` → 403. `attendees` con tipo distinto de Reunión → 400. Id inexistente → 400.
- Las horas de la copia suman en la hoja del asistente (cálculo existente de `timesheets.controller.js`).
- Sin `attendees` → comportamiento idéntico al actual.
