# Formulario único de actividad (#actDaily + #myentry)

## Problema
`#actDaily` (`DailyActivities.jsx`, drawer) y `#myentry` (`MyTimeView.jsx`, modal) escriben la misma fila
`daily_activities` vía `POST /activities` con dos formularios distintos: evidencias y varios enlaces solo en uno,
asistentes de reunión solo en el otro. Editar en `#actDaily` hace DELETE + POST (no atómico, pierde `meeting_id`);
`#myentry` no edita.

## Diseño
1. **`frontend/src/kit/ActivityFormModal.jsx`** — modal centrado (overlay; pantalla completa en móvil), usado por
   ambas pantallas. Props: `empId`, `date` por defecto, `activity` (edición), `onSaved(activity|meeting)`, `onClose`,
   `notify`. Campos: fecha · tarea (buscador único: tareas de mis proyectos, asignadas a mí primero, + Jira + código
   manual) · tipo · horas con chips · descripción · asistentes (solo Reunión + pm/supervisor/admin + alta nueva) ·
   evidencias (drag & drop, `api.uploadFile` categoría `evidences`) · enlaces (varios, con nombre). Respeta el bloqueo
   por estado de la quincena (solo Draft/Returned) y no edita copias de reunión. Sustituye el drawer y el modal actuales.
2. **`PUT /activities/:id`** — mismos permisos que POST/DELETE (dueño, admin corrige; quincena Draft/Returned).
   Copia de asistente (`meeting_id` y `logged_by` ≠ dueño) → 409. La del organizador se edita solo ella. Audita
   `ACTIVITY_UPDATED`. `api.updateActivity`. `#myentry` gana botón de editar.
3. **`#actDaily` sobre el día de otro empleado** — solo lectura (sin registrar/editar/borrar, aviso "Solo lectura");
   el admin puede corregir.
4. **Pruebas** — backend: PUT por el dueño 200, tercero 403, hoja enviada 409, copia de asistente 409, admin 200.
   Build del frontend y suite completa en SQLite (nunca Firebase).
