/* My Global Hub — i18n runtime (prototype).
   Spanish (es) is the default; English (en) is the source catalog.
   Production build: replace with key-based i18n (es.json / en.json) — see handoff ARCHITECTURE.md. */
(function () {
  if (window.MGH_I18N) return; // helmet scripts can execute twice; a second instance would fight the first
  const LS_LANG = 'mgh-lang', LS_EN = 'mgh-i18n-enabled', LS_CUSTOM = 'mgh-i18n-custom';
  const LOCALES = [
    { code: 'es', name: 'Español', en: 'Spanish', locale: 'es-DO', dir: 'ltr', flag: 'DO' },
    { code: 'en', name: 'English', en: 'English', locale: 'en-US', dir: 'ltr', flag: 'US' },
  ];
  const LS_DEF = 'mgh-i18n-default';
  const MON_ES = { Jan: 'ene', Feb: 'feb', Mar: 'mar', Apr: 'abr', May: 'may', Jun: 'jun', Jul: 'jul', Aug: 'ago', Sep: 'sept', Oct: 'oct', Nov: 'nov', Dec: 'dic' };
  const DOW_ES = { Sun: 'dom', Mon: 'lun', Tue: 'mar', Wed: 'mié', Thu: 'jue', Fri: 'vie', Sat: 'sáb' };

  // English source string → Spanish. {n} = any number / ID / date / amount token.
  const RAW = `
Overview|Resumen
Daily operation in one place|Operación diaria en un solo lugar
{n} people in your scope|{n} personas en tu alcance
Every figure links to its source record.|Cada cifra enlaza a su registro de origen.
Attendance Exceptions|Excepciones de asistencia
Open record|Abrir
Operations Center|Centro de operaciones
Daily operation in one place • {n} • {n} people in your scope. Every figure links to its source record.|Operación diaria en un solo lugar • {n} • {n} personas en tu alcance. Cada cifra enlaza a su registro de origen.
Live • refreshes on every change|En vivo • se actualiza con cada cambio
Timesheets in review|Hojas en revisión
Ready for payroll|Listas para nómina
Attendance exceptions|Excepciones de asistencia
Missing clock-out|Salida sin marcar
Blocked approvals|Aprobaciones bloqueadas
Attendance today|Asistencia hoy
Approve Pending|Aprobar pendientes
Run Payroll|Ejecutar nómina
Create Employee|Crear empleado
Export Reports|Exportar reportes
Alerts|Alertas
{n} open • sorted by severity|{n} abiertas • ordenadas por severidad
Open|Abrir
No open alerts in your scope.|Sin alertas abiertas en tu alcance.
Timesheet waiting > 48h at {n}|Hoja esperando > 48 h en {n}
Returned for corrections|Devuelta para corrección
{n} approved timesheet(s) not yet paid|{n} hoja(s) aprobada(s) sin pagar
Payroll must generate pay stubs|Nómina debe generar los volantes de pago
Employee without supervisor|Empleado sin supervisor
Leave request pending|Solicitud de licencia pendiente
System health|Estado del sistema
Integrations and platform services|Integraciones y servicios de la plataforma
Connected • 14 worklogs syncing|Conectado • 14 registros sincronizando
Sandbox • payouts simulated|Sandbox • pagos simulados
Back-end|Back-end
Prototype • data stored in this browser|Prototipo • datos guardados en este navegador
In-app only • email/push pending|Solo en la app • correo/push pendiente
PDF / Excel / CSV / Print available|PDF / Excel / CSV / Imprimir disponibles
Exports|Exportaciones
Audit log • live|Registro de auditoría • en vivo
Latest {n} events in {n}|Últimos {n} eventos en {n}
No events yet|Aún no hay eventos
Actions (approvals, corrections, leave, configuration) appear here as they happen.|Las acciones (aprobaciones, correcciones, licencias, configuración) aparecen aquí al ocurrir.
just now|ahora
{n} min ago|hace {n} min
{n} h ago|hace {n} h
Approval History|Historial de aprobación
This week|Esta semana
PTO balance|Saldo de PTO
Top project|Proyecto principal
Vacation available • 2025|Vacaciones disponibles • 2025
{n} • of logged work|{n} • del trabajo registrado
No work logged|Sin trabajo registrado
Tue, Apr 15 • in progress|mar, 15 abr • en curso
Period closed|Período cerrado
Clock in and out, record breaks, log project work and review your bi-weekly timesheet before submission.|Registra entrada, salida y pausas, el trabajo por proyecto y revisa tu hoja quincenal antes de enviarla.
Timesheets waiting at your approval step in {n}. Open one to review hours, worklogs and punches.|Hojas de tiempo pendientes en tu paso de aprobación en {n}. Abre una para revisar horas, registros y marcaciones.
My Work|Mi trabajo
Time Entry|Registro de tiempo
My Timesheets|Mis hojas de tiempo
Time entries|Registros de tiempo
Project (required)|Proyecto (obligatorio)
Client|Cliente
Hour type|Tipo de horas
Attachment (optional)|Adjunto (opcional)
No file selected|Ningún archivo seleccionado
Select a project|Selecciona un proyecto
Save changes|Guardar cambios
Work description (required)|Descripción del trabajo (obligatoria)
Task|Tarea
Duplicate|Duplicar
No time entries yet for this period.|Aún no hay registros de tiempo en este período.
Nothing is waiting at your approval step.|No hay nada pendiente en tu paso de aprobación.
Open Approval Queue|Abrir cola de aprobación
Break Start|Inicio de pausa
Break End|Fin de pausa
Break start|Inicio de pausa
Break end|Fin de pausa
Select a project • hours cannot be saved without a valid project|Selecciona un proyecto • no se pueden guardar horas sin un proyecto válido
Add a description of the work done|Agrega una descripción del trabajo realizado
Delete time entry?|¿Eliminar registro de tiempo?
Entry deleted|Registro eliminado
Roles & Permissions|Roles y permisos
403 • Access Denied|403 • Acceso denegado
You do not have permission to open this page in the active organization.|No tienes permiso para abrir esta página en la organización activa.
Go to my home page|Ir a mi página de inicio
Switch user|Cambiar de usuario
My Profile|Mi perfil
Edit My Profile|Editar mi perfil
Profile updated|Perfil actualizado
Role, compensation, bank and organization details are managed by HR.|El cargo, la compensación, el banco y los datos de la organización los gestiona RR. HH.
My Payslips|Mis volantes de pago
View as (demo) • changes the permission set|Ver como (demo) • cambia el conjunto de permisos
Active organization • data never crosses organizations|Organización activa • los datos nunca cruzan organizaciones
Permission|Permiso
Route protection|Protección de rutas
Memberships|Membresías
One person can hold a different role in each organization|Una persona puede tener un rol distinto en cada organización
Central permission matrix. Menus, routes, buttons and engines call can(permission, record) — the record must be inside the role's scope and the active organization.|Matriz central de permisos. Menús, rutas, botones y motores llaman a can(permiso, registro): el registro debe estar dentro del alcance del rol y de la organización activa.
Self|Propio
Team|Equipo
Department|Departamento
Project|Proyecto
Organization|Organización
Platform Admin|Administrador de plataforma
Org Admin|Administrador de organización
Contractor|Contratista
Your role approves requests at its workflow step.|Tu rol aprueba solicitudes en su paso del flujo.
No timesheets in your scope for this organization.|No hay hojas de tiempo en tu alcance para esta organización.
Reports|Reportes
Shift {n} • {n} • grace {n} min|Turno {n} • {n} • gracia {n} min
{n} • Shift {n} • {n} • grace {n} min|{n} • Turno {n} • {n} • gracia {n} min
{n} • Flexible schedule|{n} • Horario flexible
Attendance|Asistencia
Attendance Dashboard|Panel de asistencia
Daily Attendance|Asistencia diaria
Attendance Calendar|Calendario de asistencia
Exceptions|Excepciones
Leave Requests|Solicitudes de licencia
Holidays|Feriados
Attendance Reports|Reportes de asistencia
Attendance Rules|Reglas de asistencia
Dashboard|Panel
Calendar|Calendario
Rules|Reglas
Single source for punches, daily status, exceptions and leave • feeds My Time Entry, timesheets, payroll and reports.|Fuente única de marcaciones, estado diario, excepciones y licencias • alimenta Mi registro de tiempo, hojas, nómina y reportes.
Employees Present|Empleados presentes
Employees Absent|Empleados ausentes
Late Arrivals|Llegadas tarde
Early Departures|Salidas tempranas
Missing Clock-Out|Salida sin marcar
Missing Clock-In|Entrada sin marcar
On Leave|De licencia
Remote|Remoto
Field Work|Trabajo de campo
Attendance %|% de asistencia
Present|Presente
Late|Tarde
Absent|Ausente
Holiday|Feriado
Vacation|Vacaciones
Sick|Enfermedad
Training|Capacitación
Business Trip|Viaje de trabajo
Pending Review|Pendiente de revisión
Weekend|Fin de semana
Scheduled|Programado
In progress|En curso
Lunch|Almuerzo
Exception|Excepción
Month|Mes
Week|Semana
Day|Día
Today|Hoy
Week of {n}|Semana del {n}
Attendance % • last 10 working days|% de asistencia • últimos 10 días laborables
Open exceptions • {n}|Excepciones abiertas • {n}
All exceptions|Todas las excepciones
No open exceptions for this day.|Sin excepciones abiertas para este día.
Leave requests pending|Solicitudes de licencia pendientes
Nothing pending.|Nada pendiente.
Missing Clock In|Entrada sin marcar
Missing Clock Out|Salida sin marcar
Late Arrival • {n} min|Llegada tarde • {n} min
Early Departure • {n}|Salida temprana • {n}
Overtime • {n}|Horas extra • {n}
Duplicate Entries • clock-in recorded twice|Entradas duplicadas • entrada registrada dos veces
Overlapping Time • lunch in before lunch out|Tiempo superpuesto • regreso antes de salida a almuerzo
Severity|Severidad
high|alta
medium|media
low|baja
Resolved|Resueltas
Comments|Comentarios
Comment|Comentar
Approve as is|Aprobar tal cual
Save correction|Guardar corrección
Reopen|Reabrir
Comment (visible to the employee and approvers)|Comentario (visible para el empleado y aprobadores)
In Review|En revisión
Corrected|Corregido
No exceptions in this range.|Sin excepciones en este rango.
All types|Todos los tipos
Last 7 days|Últimos 7 días
Leave workflow|Flujo de licencias
Employee → Supervisor → HR → Approved → Calendar → Payroll|Empleado → Supervisor → RR. HH. → Aprobado → Calendario → Nómina
Type|Tipo
From|Desde
To|Hasta
Reason|Motivo
Optional for vacation|Opcional para vacaciones
Request Leave|Solicitar licencia
Request|Solicitud
Dates|Fechas
Days|Días
Paid|Pagado
Pending Supervisor|Pendiente de supervisor
Pending HR|Pendiente de RR. HH.
Personal|Personal
Bereavement|Duelo
Jury Duty|Servicio de jurado
Maternity|Maternidad
Paternity|Paternidad
Unpaid|Sin goce de sueldo
Reason (required)|Motivo (obligatorio)
No leave requests.|No hay solicitudes de licencia.
Add Holiday|Agregar feriado
Description|Descripción
Region|Región
Working holiday|Feriado laborable
No holidays configured.|No hay feriados configurados.
e.g. Company anniversary|ej. Aniversario de la empresa
Late Employees|Empleados con tardanzas
Monthly Attendance|Asistencia mensual
Absence Summary|Resumen de ausencias
Overtime by Attendance|Horas extra por asistencia
Missing Punches|Marcaciones faltantes
Attendance by Department|Asistencia por departamento
Late days|Días tarde
Avg minutes late|Minutos promedio de tardanza
Worst|Peor
Unjustified absences|Ausencias injustificadas
Scheduled days|Días programados
Days present|Días presente
Days with OT|Días con horas extra
Hours worked|Horas trabajadas
Missing|Faltante
Leave|Licencia
Attendance rules|Reglas de asistencia
Per organization • applied to statuses, exceptions and hours|Por organización • se aplica a estados, excepciones y horas
Save rules|Guardar reglas
Shift start|Inicio de turno
Shift duration (h)|Duración del turno (h)
Grace period (min)|Período de gracia (min)
Max late minutes (min)|Máximo de minutos tarde (min)
Minimum lunch (min)|Almuerzo mínimo (min)
Maximum hours per day (h)|Máximo de horas por día (h)
Automatic lunch deduction|Descuento automático de almuerzo
Flexible schedule|Horario flexible
No late / early flags; only short days (under the shift duration) are flagged|Sin alertas de tardanza ni salida temprana; solo se marcan días cortos (bajo la duración del turno)
Attendance rules saved • statuses and exceptions recalculated|Reglas de asistencia guardadas • estados y excepciones recalculados
All organizations|Todas las organizaciones
All supervisors|Todos los supervisores
Previous day|Día anterior
Next day|Día siguiente
Reports & Export Center|Centro de reportes y exportación
Ten operational reports with live filters. Every report exports to PDF, Excel, CSV or print in the selected language.|Diez reportes operativos con filtros en vivo. Cada reporte se exporta a PDF, Excel, CSV o impresión en el idioma seleccionado.
Hours worked|Horas trabajadas
Labor cost|Costo laboral
Active employees|Empleados activos
Pending timesheets|Hojas pendientes
Payroll pending|Nómina pendiente
Avg approval time|Tiempo promedio de aprobación
no completed approvals yet|sin aprobaciones completadas
Employee Hours|Horas por empleado
Weekly Hours|Horas semanales
Biweekly Payroll|Nómina quincenal
Attendance|Asistencia
Payroll Summary|Resumen de nómina
Labor Cost|Costo laboral
Contractor Payments|Pagos a contratistas
Organization Summary|Resumen por organización
All organizations|Todas las organizaciones
All departments|Todos los departamentos
All projects|Todos los proyectos
All clients|Todos los clientes
All supervisors|Todos los supervisores
All employees|Todos los empleados
All statuses|Todos los estados
Clear filters|Limpiar filtros
{n} rows|{n} filas
{n} filter(s)|{n} filtro(s)
Period total|Total del período
Overtime (rule)|Horas extra (regla)
Deductions|Deducciones
OT hours|Horas extra
OT cost (1.5×)|Costo horas extra (1,5×)
% of hours|% de horas
Days worked|Días trabajados
Absences|Ausencias
PTO days|Días de vacaciones
Organization|Organización
Client|Cliente
Labor cost|Costo laboral
Jira match|Coincidencia Jira
PTO used (h)|Vacaciones usadas (h)
Balance (days)|Saldo (días)
Holidays (DR 2025)|Feriados (RD 2025)
Contractor|Contratista
Pending timesheets|Hojas pendientes
CSV downloaded|CSV descargado
Excel downloaded|Excel descargado
Print dialog opened|Diálogo de impresión abierto
Choose "Save as PDF" in the print dialog|Elige "Guardar como PDF" en el diálogo de impresión
Allow pop-ups to print or save as PDF|Permite ventanas emergentes para imprimir o guardar como PDF
No records match these filters.|Ningún registro coincide con estos filtros.
Overtime recalculated with the organization rule: {n}|Horas extra recalculadas con la regla de la organización: {n}
Contractors are reported separately from employee payroll; organization, department and supervisor filters do not apply.|Los contratistas se reportan aparte de la nómina de empleados; no aplican los filtros de organización, departamento ni supervisor.
Role: {n}|Rol: {n}
Role: Employee|Rol: Empleado
Role: Supervisor|Rol: Supervisor
Role: Manager|Rol: Gerente
Role: Payroll|Rol: Nómina
Role: HR|Rol: RR. HH.
Role: CFO|Rol: CFO
Role: Admin|Rol: Admin
View as role (prototype)|Ver como rol (prototipo)
Manager|Gerente
Admin|Administrador
CFO|CFO
Notifications • {n}|Notificaciones • {n}
Mark all read|Marcar todo como leído
No notifications for this role yet.|Aún no hay notificaciones para este rol.
Timesheet submitted.|Hoja de tiempo enviada.
Timesheet awaiting your review.|Hoja de tiempo pendiente de tu revisión.
Supervisor approved.|Supervisor aprobó.
Manager approved.|Gerente aprobó.
HR approved.|RR. HH. aprobó.
CFO approved.|CFO aprobó.
Payroll approved.|Nómina aprobada.
Returned for corrections.|Devuelta para corrección.
Timesheet rejected.|Hoja de tiempo rechazada.
Payment completed.|Pago completado.
Settings • Approval Workflow|Configuración • Flujo de aprobación
Settings • Overtime Rule|Configuración • Regla de horas extra
Submits • always on|Envía • siempre activo
Approved → Paid|Aprobado → Pagado
Payroll generates the pay stub|Nómina genera el volante de pago
Add HR|Agregar RR. HH.
Add CFO|Agregar CFO
Add Manager|Agregar Gerente
Add Supervisor|Agregar Supervisor
Reset to default|Restablecer predeterminado
Reset demo timesheets|Restablecer hojas de demostración
Reset demo timesheets?|¿Restablecer hojas de demostración?
Weekly (44h)|Semanal (44 h)
Daily (8h)|Diaria (8 h)
Daily + Weekly|Diaria + semanal
Custom|Personalizada
Daily threshold (h)|Umbral diario (h)
Weekly threshold (h)|Umbral semanal (h)
Applies to My Time Entry and payroll for this organization. Default: overtime after 44h per week.|Aplica a Mi registro de tiempo y a la nómina de esta organización. Predeterminado: horas extra después de 44 h por semana.
Weekly > {n}|Semanal > {n}
Daily > {n}|Diaria > {n}
Submitted|Enviado
Supervisor Review|Revisión del supervisor
Manager Review|Revisión del gerente
Payroll Review|Revisión de nómina
HR Review|Revisión de RR. HH.
CFO Review|Revisión del CFO
Rejected|Rechazado
Cancelled|Cancelado
Draft • {n}|Borrador • {n}
Approve Only|Solo aprobar
Reject|Rechazar
Reject Timesheet|Rechazar hoja de tiempo
Generate Pay Stub & Mark Paid|Generar volante y marcar pagado
Waiting for {n}|Esperando a {n}
Waiting for the employee to submit|Esperando que el empleado envíe
Only Payroll can generate the pay stub|Solo Nómina puede generar el volante de pago
Only the employee can submit • switch role to Employee|Solo el empleado puede enviar • cambia el rol a Empleado
History|Historial
Current step|Paso actual
Awaiting payment|Esperando pago
View only|Solo lectura
Delete synced Jira worklog?|¿Eliminar registro sincronizado con Jira?
Open timesheet|Abrir hoja de tiempo
Timesheet • {n}|Hoja de tiempo • {n}
Multi-Bank Allocations|Asignaciones multibanco
Net pay split • must total 100%|División del neto • debe sumar 100 %
Compensation & Tax|Compensación e impuestos
Overtime rule|Regla de horas extra
Overtime rate|Tarifa de horas extra
Gross / period|Bruto / período
Net / period|Neto / período
Jira Integration|Integración Jira
Bound project|Proyecto vinculado
Jira match this period|Coincidencia Jira este período
Time Off & PTO|Tiempo libre y vacaciones
Balances as of Apr 15, 2025|Saldos al 15 abr 2025
Vacation available|Vacaciones disponibles
Used this year|Usado este año
Sick leave|Licencia por enfermedad
Documents|Documentos
Employment contract|Contrato de trabajo
National ID / Cédula|Cédula / ID nacional
Bank account verification|Verificación de cuenta bancaria
On file|Archivado
Approval workflow & overtime rule|Flujo de aprobación y regla de horas extra
Timesheet status changes|Cambios de estado de la hoja
Payment completed|Pago completado
Require MFA for approvers|Exigir MFA a aprobadores
Audit every state change|Auditar cada cambio de estado
In review|En revisión
Operating Entity|Entidad operativa
Región de Operación|Región de Operación
Operating Region|Región de Operación
Help|Ayuda
Passed|Aprobado
In {n} days|En {n} días
{n} Periods|{n} períodos
Pay date {n}|Fecha de pago {n}
Search employee ID, Jira issue, pay period, department...|Buscar ID de empleado, incidencia Jira, período de pago, departamento...
Language settings|Configuración de idioma
The application supports Spanish (default) and English. Choose the default, enable English and preview both.|La aplicación admite español (predeterminado) e inglés. Elige el predeterminado, habilita el inglés y previsualiza ambos.
Default application language|Idioma predeterminado de la aplicación
Used when a user has not chosen a language|Se usa cuando el usuario no ha elegido idioma
Enable English|Habilitar inglés
Users can switch to English from the top navigation|Los usuarios pueden cambiar a inglés desde la barra superior
Default language updated|Idioma predeterminado actualizado
Current|Actual
Sign in|Iniciar sesión
Sign in to My Global Hub|Inicia sesión en My Global Hub
Timekeeping & payroll for every operating entity|Control de tiempo y nómina para cada entidad operativa
Password|Contraseña
Remember me|Recordarme
Forgot password?|¿Olvidaste tu contraseña?
Signed in|Sesión iniciada
Signed out|Sesión cerrada
Choose your language|Elige tu idioma
Secured with SSO + 2FA|Protegido con SSO + 2FA
Enter your email and password|Ingresa tu correo y contraseña
Executive Dashboard|Panel ejecutivo
Payroll Dashboard|Panel de nómina
Workforce|Personal
My Time Entry|Mi registro de tiempo
Add Employee|Agregar empleado
Approval Workspace|Espacio de aprobación
Team Approval Queue|Cola de aprobación del equipo
Team Timesheets|Hojas de tiempo del equipo
Employee Directory|Directorio de empleados
Payroll & Finance|Nómina y finanzas
Pay Periods|Períodos de pago
Adjustments|Ajustes
Payroll Processing|Procesamiento de nómina
Pay Stubs|Volantes de pago
Banking & Allocations|Banca y asignaciones
Reports & Register|Reportes y registro
Contractors|Contratistas
Contractor Payments|Pagos a contratistas
Integrations|Integraciones
Jira Cloud Sync|Sincronización Jira Cloud
Projects|Proyectos
System / Administration|Sistema / Administración
Organization & Multi-HQ|Organización y multisede
Approval Workflows|Flujos de aprobación
Audit Logs|Registros de auditoría
Settings|Configuración
Languages|Idiomas
Enterprise Payroll|Nómina empresarial
Operating entity|Entidad operativa
Jira Cloud: Active|Jira Cloud: activo
{n} Syncing|{n} sincronizando
Lead PM & Approver|PM líder y aprobadora
Project Manager Approval Phase|Fase de aprobación del gerente de proyecto
Supervisor Approval Phase|Fase de aprobación del supervisor
Bulk Actions|Acciones masivas
Export Register|Exportar registro
Search employees, IDs, Jira tasks…|Buscar empleados, IDs, tareas Jira…
Search|Buscar
Payroll register export queued (XLSX)|Exportación del registro de nómina en cola (XLSX)
{n} Pending|{n} pendientes
Language|Idioma
Default|Predeterminado
Español (Default)|Español (predeterminado)
Add Language|Agregar idioma
Language Management|Gestión de idiomas
Enable or disable languages, edit and import translations, track missing strings and preview the interface in each language.|Habilita o deshabilita idiomas, edita e importa traducciones, controla textos faltantes y previsualiza la interfaz en cada idioma.
Import Translations|Importar traducciones
Export es.json|Exportar es.json
Export en.json|Exportar en.json
Enabled languages|Idiomas habilitados
Default language|Idioma predeterminado
Translated strings|Textos traducidos
Missing translations|Traducciones faltantes
Code|Código
Enabled|Habilitado
Completion|Avance
Direction|Dirección
Preview|Previsualizar
Previewing|Previsualizando
Falls back to English|Usa inglés como respaldo
Track missing translations|Control de traducciones faltantes
Strings seen in the interface without a Spanish translation. Add one and it applies immediately.|Textos vistos en la interfaz sin traducción al español. Agrega una y se aplica de inmediato.
No missing translations detected yet. Browse the app in Español to collect them.|Aún no se detectan traducciones faltantes. Navega la app en español para recopilarlas.
Translation|Traducción
Source (English)|Origen (inglés)
Locale formats|Formatos regionales
Dates, currency, numbers and time adapt to the selected language|Fechas, moneda, números y hora se adaptan al idioma seleccionado
Time|Hora
Number|Número
Translation saved|Traducción guardada
Translations imported|Traducciones importadas
Invalid translation file|Archivo de traducción no válido
Language enabled|Idioma habilitado
Language disabled|Idioma deshabilitado
The default language cannot be disabled|El idioma predeterminado no se puede deshabilitar
Enable this language first|Primero habilita este idioma
Preferred language|Idioma preferido
Saved to the user profile and restored on every login|Se guarda en el perfil del usuario y se restaura en cada inicio de sesión
Interface language|Idioma de la interfaz
Pay stubs, PDFs, emails and exports use the employee's language|Volantes, PDF, correos y exportaciones usan el idioma del empleado
Cancel|Cancelar
Save|Guardar
Save Draft|Guardar borrador
Save Changes|Guardar cambios
Discard|Descartar
Changes discarded|Cambios descartados
Settings saved|Configuración guardada
Back|Volver
Close|Cerrar
Edit|Editar
Remove|Quitar
Replace|Reemplazar
Upload|Subir
Download|Descargar
Download PDF|Descargar PDF
Export|Exportar
Export CSV|Exportar CSV
Export PDF|Exportar PDF
Export queued|Exportación en cola
Export CSV queued|Exportación CSV en cola
Import CSV|Importar CSV
Import CSV opened|Importación CSV abierta
Print|Imprimir
Print queued|Impresión en cola
Schedule|Programar
Schedule opened|Programación abierta
Columns|Columnas
Columns opened|Columnas abiertas
Message|Mensaje
Message opened|Mensaje abierto
More|Más
Copy|Copiar
Approve|Aprobar
Return|Devolver
Review|Revisar
Resolve|Resolver
Resolve opened|Resolución abierta
Open|Abierto
Draft|Borrador
Approved|Aprobado
Paid|Pagado
Closed|Cerrado
Archived|Archivado
Processing|Procesando
Processing Payroll|Procesando nómina
Awaiting Employee|Esperando empleado
Awaiting Supervisor|Esperando supervisor
Awaiting PM|Esperando PM
Awaiting HR|Esperando RR. HH.
Awaiting Finance|Esperando finanzas
Awaiting Employee Submission|Esperando envío del empleado
Awaiting Supervisor Approval|Esperando aprobación del supervisor
Awaiting Project Manager Approval|Esperando aprobación del gerente de proyecto
Awaiting HR Approval|Esperando aprobación de RR. HH.
Awaiting Finance Approval|Esperando aprobación de finanzas
Awaiting Project Mgr|Esperando gerente de proyecto
Awaiting|En espera
Awaiting you|Esperándote
Awaiting approval|Esperando aprobación
Pending|Pendiente
Pending Approval|Pendiente de aprobación
Pending 2FA|2FA pendiente
Pending Onboarding|Incorporación pendiente
Pending verification|Verificación pendiente
In Progress|En progreso
In Review|En revisión
In approval|En aprobación
In flight|En tránsito
Complete|Completo
Completed|Completado
Done|Hecho
Ready|Listo
Active|Activo
Ended|Finalizado
Upcoming|Próximo
Scheduled|Programado
Syncing|Sincronizando
Optional|Opcional
On Hold|En espera
Blocked|Bloqueado
Sent|Enviado
Submitted|Enviado
Returned|Devuelto
Verified|Verificado
Connected|Conectado
Live|En vivo
Missing|Faltante
Flagged|Marcados
Frozen|Congelado
Locked|Bloqueado
Permanent|Permanente
Immutable|Inmutable
Accruing|Acumulando
Calculated|Calculado
Recommended|Recomendado
Company-paid|Pagado por la empresa
Today|Hoy
Yesterday|Ayer
Just now|Justo ahora
Now|Ahora
Day|Día
Day {n}|Día {n}
Week|Semana
Week {n}|Semana {n}
total|total
Period|Período
Period total|Total del período
period|período
days|días
In|En
Stage|Etapa
Stage {n}|Etapa {n}
Stage {n} Final|Etapa {n} final
Jan|ene
Feb|feb
Mar|mar
Apr|abr
May|may
Jun|jun
Jul|jul
Aug|ago
Sep|sept
Oct|oct
Nov|nov
Dec|dic
Sun|dom
Mon|lun
Tue|mar
Wed|mié
Thu|jue
Fri|vie
Sat|sáb
Monday|Lunes
Sunday|Domingo
Date|Fecha
Type|Tipo
Status|Estado
Actions|Acciones
Amount|Monto
Description|Descripción
Notes|Notas
Owner|Responsable
Rule|Regla
Notification|Notificación
Entity|Entidad
Rate|Tarifa
Hours|Horas
Total|Total
Gross|Bruto
Tax|Impuesto
Net|Neto
Dept|Depto.
Reg h|H. reg.
OT h|H. extra
Reg|Reg.
Location|Ubicación
Department|Departamento
Manager|Gerente
Manager:|Gerente:
Project|Proyecto
Country|País
Countries|Países
Currency|Moneda
Method|Método
Delivery|Entrega
Payment|Pago
Payments|Pagos
Transaction|Transacción
Transfer|Transferencia
Value date|Fecha valor
Lead|Líder
People|Personas
Health|Salud
Billable|Facturable
Budget used|Presupuesto usado
Headcount|Plantilla
Institution|Institución
Rail|Canal
Account|Cuenta
BIC / Routing|BIC / Ruta
Cycle volume|Volumen del ciclo
Cycle|Ciclo
Work period|Período laboral
Issue|Incidencia
Severity|Severidad
Suggested action|Acción sugerida
High|Alta
Medium|Media
Clock|Reloj
Out|Salida
Logged|Registrado
Jira|Jira
Users|Usuarios
Changes|Cambios
Actor|Actor
Event|Evento
Target|Destino
Ledger hash|Hash del libro
Timestamp (AST)|Fecha y hora (AST)
Employee|Empleado
Employees|Empleados
Supervisor|Supervisor
Project Mgr|Gerente de proyecto
HR|RR. HH.
Finance|Finanzas
Lock|Cierre
System|Sistema
Contractor|Contratista
Basis|Base
Start|Inicio
End|Fin
Directory|Directorio
Contracts|Contratos
Hourly|Por hora
Fixed|Fijo
Fixed Monthly|Fijo mensual
Weekly|Semanal
Monthly|Mensual
Bi-Weekly|Quincenal
Semi-Monthly|Semimensual
Regular|Regular
Overtime|Horas extra
Weekend|Fin de semana
Holiday|Feriado
PTO|Vacaciones
Sick|Enfermedad
PTO / Leave|Vacaciones / licencia
All|Todos
All types|Todos los tipos
All departments|Todos los departamentos
All entities|Todas las entidades
All rails|Todos los canales
All actors|Todos los actores
All events|Todos los eventos
Last 7 days|Últimos 7 días
This period|Este período
Enterprise Payroll|Nómina empresarial
Cycles & Compliance|Ciclos y cumplimiento
CY-2025 Calendar|Calendario CY-2025
Pay Periods &amp; Processing Schedule|Calendario de períodos de pago y procesamiento
Pay Periods & Processing Schedule|Calendario de períodos de pago y procesamiento
Manage annual bi-weekly payroll cycles, multi-tier approval deadlines, retroactive adjustment queues and period locking protocols.|Gestiona los ciclos quincenales anuales, los plazos de aprobación por niveles, las colas de ajustes retroactivos y los protocolos de cierre de período.
Generate 2026 Pay Calendar|Generar calendario de pago 2026
Create Payroll Adjustment|Crear ajuste de nómina
Upload Bank Confirmations|Subir confirmaciones bancarias
Export Annual Schedule|Exportar calendario anual
Lock Historical Periods|Bloquear períodos históricos
Current active cycle|Ciclo activo actual
Phase: PM Approval|Fase: aprobación del PM
Upcoming payroll date|Próxima fecha de nómina
ACH Batch {n}|Lote ACH {n}
Locked / completed|Bloqueados / completados
Periods|Períodos
{n} YTD processed|{n} procesado en el año
{n} tax settled|{n} impuestos liquidados
Open adjustments|Ajustes abiertos
{n} delta queued for {n}|{n} de diferencia en cola para {n}
All Cycles|Todos los ciclos
Active & Upcoming|Activos y próximos
Locked / Completed|Bloqueados / completados
Filter cycle (e.g. PP-2025-08)|Filtrar ciclo (ej. PP-2025-08)
Pay period|Período de pago
Work start|Inicio de trabajo
Work end|Fin de trabajo
Payroll cutoff|Corte de nómina
Emp. deadline|Plazo empleado
Sup. deadline|Plazo supervisor
PM deadline|Plazo PM
HR deadline|Plazo RR. HH.
Finance deadline|Plazo finanzas
Pay date|Fecha de pago
Calendar Year:|Año calendario:
Showing|Mostrando
Annual Processing Velocity &amp; Timeliness|Velocidad y puntualidad del procesamiento anual
Annual Processing Velocity & Timeliness|Velocidad y puntualidad del procesamiento anual
Average approval completion time across each sequential approval stage|Tiempo promedio de aprobación en cada etapa secuencial
{n} On Schedule|{n} a tiempo
Before cutoff|Antes del corte
Avg turnaround|Tiempo promedio
Current step|Paso actual
HR Compliance|Cumplimiento RR. HH.
SLA: {n}|SLA: {n}
Finance / ACH|Finanzas / ACH
Instant batch|Lote instantáneo
Cycle Locking Rules|Reglas de cierre de ciclo
Non-repudiation parameters enforced for Dominican Republic DGII statutory reporting|Parámetros de no repudio aplicados a los reportes legales de la DGII (República Dominicana)
Automatic Period Freeze|Congelamiento automático del período
Periods lock 24 hours post disbursement. All direct edits permanently rejected.|Los períodos se bloquean 24 horas después del desembolso. Toda edición directa se rechaza de forma permanente.
Hours, Rates & Calculations Preserved|Horas, tarifas y cálculos preservados
Gross, deductions, employer contributions and net pay stored exactly as computed.|Bruto, deducciones, aportes patronales y neto se guardan exactamente como se calcularon.
Corrections via Payroll Adjustments Only|Correcciones solo mediante ajustes de nómina
Retro pay or deductions are new entries routed through approval.|Pagos retroactivos o deducciones son nuevas entradas que pasan por aprobación.
Two-Party Override Required|Se requiere autorización de dos partes
Unlocking an archived cycle requires Finance VP and Lead Auditor dual-signature.|Desbloquear un ciclo archivado requiere doble firma del VP de Finanzas y el auditor líder.
Period Locking Protocol Policy|Política de protocolo de cierre de período
Auto-lock: 24h post pay date|Cierre automático: 24 h después de la fecha de pago
Open Audit Log|Abrir registro de auditoría
Audit Hash Certification|Certificación hash de auditoría
Payroll Settings|Configuración de nómina
Applies to My Global Hub and all its projects|Aplica a My Global Hub y todos sus proyectos
Payroll settings saved for My Global Hub, Kairoon, Arawaki|Configuración de nómina guardada para My Global Hub, Kairoon, Arawaki
Bi-Weekly (default)|Quincenal (predeterminado)
Standard work week|Semana laboral estándar
Mon – Fri • 40h (8h/day)|Lun – vie • 40 h (8 h/día)
Overtime rules|Reglas de horas extra
Holiday calendar|Calendario de feriados
Dominican Republic 2025 • 12 days|República Dominicana 2025 • 12 días
Time zone|Zona horaria
Payroll cutoff time|Hora de corte de nómina
Approval workflow|Flujo de aprobación
Default pay date offset|Desfase predeterminado de fecha de pago
Decrease|Disminuir
Increase|Aumentar
Automatic period generation|Generación automática de períodos
Creates next year's 26 cycles on Nov 1 as Draft|Crea los 26 ciclos del próximo año el 1 de nov. como borrador
Automatic Notifications|Notificaciones automáticas
Employees and managers are notified at every milestone|Empleados y gerentes reciben aviso en cada hito
New pay period opens|Se abre un nuevo período de pago
All employees • Email + in-app|Todos los empleados • correo + en la app
Timesheets are due|Vencen las hojas de tiempo
24h and 2h before deadline • Email + Slack|24 h y 2 h antes del plazo • correo + Slack
Approvals are pending|Hay aprobaciones pendientes
Every 4h until SLA • Approvers|Cada 4 h hasta el SLA • aprobadores
Payroll is approved|La nómina fue aprobada
Payroll admins & Finance|Administradores de nómina y finanzas
Payroll has been paid|La nómina fue pagada
All employees • pay stub link|Todos los empleados • enlace al volante
A new pay period begins|Comienza un nuevo período de pago
Day 1 • 07:00 AST|Día 1 • 07:00 AST
Review Cycle|Revisar ciclo
Current Cycle|Ciclo actual
Next in Queue|Siguiente en cola
1 Adjustment|1 ajuste
Reopen|Reabrir
Payroll Adjustments &amp; Statutory Severance Engine|Motor de ajustes de nómina y prestaciones legales
Payroll Adjustments & Statutory Severance Engine|Motor de ajustes de nómina y prestaciones legales
Calculate Regalía Pascual|Calcular Regalía Pascual
Statutory Severance|Prestaciones legales
New Adjustment Entry|Nueva entrada de ajuste
Total cycle adjustments|Total de ajustes del ciclo
Cycle PP-2025-08 Adjustments &amp; Bonuses Register|Registro de ajustes y bonos del ciclo PP-2025-08
Cycle PP-2025-08 Adjustments & Bonuses Register|Registro de ajustes y bonos del ciclo PP-2025-08
Audit register of one-off compensation items, non-taxable stipends and payroll corrections queued for release|Registro auditado de compensaciones puntuales, estipendios no gravables y correcciones de nómina en cola
All Adjustments|Todos los ajustes
Discretionary Bonuses|Bonos discrecionales
Expense Stipends|Estipendios de gastos
Statutory Deductions|Deducciones legales
Retroactive Corrections|Correcciones retroactivas
Employee ID & name|ID y nombre del empleado
Type & category|Tipo y categoría
Gross amount|Monto bruto
Tax treatment|Tratamiento fiscal
Allocation target|Destino de asignación
Approved by & timestamp|Aprobado por y fecha
History|Historial
Approved & Queued|Aprobado y en cola
Tax Audited|Auditado fiscalmente
Statutory Deduction|Deducción legal
TSS Exempt|Exento de TSS
DGII Taxable ISR|ISR gravable DGII
Q1 Performance Bonus|Bono de desempeño T1
Discretionary incentive pool|Fondo de incentivos discrecional
Remote Office Stipend|Estipendio de oficina remota
Hardware & ergonomics|Equipos y ergonomía
Retroactive OT Parity|Paridad retroactiva de horas extra
Health Plan Upgrade|Mejora del plan de salud
ARS Humano international coverage|Cobertura internacional ARS Humano
Payroll retention • internal ledger|Retención de nómina • libro interno
Equipment Reimbursement|Reembolso de equipos
Laptop dock & monitor|Base de laptop y monitor
Regalía Pascual (13th Salary) Engine|Motor de Regalía Pascual (salario 13)
Código de Trabajo Art. 219–222 • Exempt from ISR &amp; TSS|Código de Trabajo Art. 219–222 • exento de ISR y TSS
Código de Trabajo Art. 219–222 • Exempt from ISR & TSS|Código de Trabajo Art. 219–222 • exento de ISR y TSS
Dominican statutory formula|Fórmula legal dominicana
Regalía = ( Σ Ordinary Earned Salaries in Calendar Year ) / 12|Regalía = ( Σ salarios ordinarios devengados en el año ) / 12
Computed over ordinary base earnings. Excludes overtime, tips, profit sharing and expense stipends.|Se calcula sobre el salario ordinario. Excluye horas extra, propinas, bonificaciones y estipendios.
Annual provision progress|Avance de la provisión anual
Eligible employees|Empleados elegibles
48 Active Staff|48 empleados activos
100% Ley 16-92 enrolled|100 % inscritos Ley 16-92
Statutory deadline|Plazo legal
Mandatory payout date|Fecha de pago obligatoria
Prestaciones Laborales Simulator|Simulador de prestaciones laborales
Ley 16-92 Articles 76–86 (Desahucio Laboral)|Ley 16-92, artículos 76–86 (desahucio laboral)
Simulation mode|Modo simulación
Preaviso (notice period • 28 days)|Preaviso (28 días)
Cesantía (severance • 21 days/yr worked)|Cesantía (21 días por año trabajado)
Vacaciones no gozadas (14 statutory days)|Vacaciones no gozadas (14 días legales)
Proportional Regalía Pascual (YTD)|Regalía Pascual proporcional (año en curso)
Total severance liability|Pasivo total de prestaciones
TSS &amp; DGII exemption verified (Art. 86)|Exención TSS y DGII verificada (Art. 86)
TSS & DGII exemption verified (Art. 86)|Exención TSS y DGII verificada (Art. 86)
Dominican Labor Code (Código de Trabajo Ley 16-92) Calculators|Calculadoras del Código de Trabajo (Ley 16-92)
Automated legal engines governing mandatory Christmas salary reserves (Art. 219) and statutory termination settlements (Art. 76–86).|Motores legales automatizados para la reserva obligatoria de Regalía Pascual (Art. 219) y las prestaciones por terminación (Art. 76–86).
Approval Workflows &amp; Policy Governance|Flujos de aprobación y gobierno de políticas
Approval Workflows & Policy Governance|Flujos de aprobación y gobierno de políticas
Audit Workflow Logs|Registros de auditoría del flujo
Simulate Approval Pipeline|Simular flujo de aprobación
Create Workflow Rule|Crear regla de flujo
Active approval pipelines|Flujos de aprobación activos
{n} Active|{n} activos
Covering 100% of workforce|Cubre el 100 % del personal
Avg cycle approval velocity|Velocidad promedio de aprobación
Days|Días
Target ≤ 2.5 days • 72% under threshold|Meta ≤ 2,5 días • 72 % bajo el umbral
Dual-signature threshold|Umbral de doble firma
Requires VP Finance + Lead PM|Requiere VP de Finanzas + PM líder
Active pipeline model|Modelo de flujo activo
Version 3.4.9 • Production|Versión 3.4.9 • producción
Bi-Weekly Timesheet &amp; Statutory Payroll Approval Sequence|Secuencia de aprobación quincenal de hojas de tiempo y nómina
Bi-Weekly Timesheet & Statutory Payroll Approval Sequence|Secuencia de aprobación quincenal de hojas de tiempo y nómina
Auto-freeze cutoff:|Corte de congelamiento automático:
Every other Monday at 23:59 AST|Cada dos lunes a las 23:59 AST
Deadline / SLA|Plazo / SLA
Threshold &amp; Trigger Rules Matrix|Matriz de umbrales y reglas de activación
Threshold & Trigger Rules Matrix|Matriz de umbrales y reglas de activación
Condition engine|Motor de condiciones
Condition / policy rule|Condición / regla de política
Autonomous trigger action|Acción automática
Status Mapping|Mapeo de estados
12 period statuses → who can edit|12 estados de período → quién puede editar
Payroll admin (dates)|Admin. de nómina (fechas)
Supervisor (return)|Supervisor (devolver)
PM (return)|PM (devolver)
HR (return)|RR. HH. (devolver)
Adjustments only|Solo ajustes
Next Pay Period Lock Hash|Hash de cierre del próximo período
Audit seal engine|Motor de sello de auditoría
Upon final Finance sign-off, an immutable SHA-256 block seal is pinned to the audit journal.|Tras la firma final de Finanzas se fija un sello SHA-256 inmutable en el diario de auditoría.
Employee Submission|Envío del empleado
Employee commits the bi-weekly timesheet. Jira worklogs and manual non-Jira entries are locked.|El empleado envía su hoja de tiempo quincenal. Se bloquean los registros de Jira y las entradas manuales.
Cutoff|Corte
Sync hook|Gancho de sincronización
Jira worklogs locked|Registros de Jira bloqueados
Cannot submit with missing entries; OT > 5h needs justification|No se puede enviar con entradas faltantes; horas extra > 5 h requieren justificación
Timesheet due • 24h and 2h before|Hoja de tiempo pendiente • 24 h y 2 h antes
Supervisor Review|Revisión del supervisor
Direct supervisor validates attendance, punches, PTO and overtime.|El supervisor directo valida asistencia, marcaciones, vacaciones y horas extra.
Approvers|Aprobadores
Direct supervisor|Supervisor directo
SLA window|Ventana de SLA
Sequential|Secuencial
Missing punches or unapproved OT block approval|Marcaciones faltantes u horas extra no aprobadas bloquean la aprobación
Approvals pending • every 4h|Aprobaciones pendientes • cada 4 h
Approvals pending|Aprobaciones pendientes
Project Manager Review|Revisión del gerente de proyecto
Lead PM validates sprint deliverables, worklog distribution and billable tags.|El PM líder valida entregables del sprint, distribución de registros y etiquetas facturables.
Project Manager • Elena Rostova|Gerente de proyecto • Elena Rostova
Jira variance > 1.0h blocks approval until resynced|Diferencia con Jira > 1,0 h bloquea la aprobación hasta resincronizar
HR & Statutory|RR. HH. y legal
Regulatory compliance checks for Punta Cana operations and overseas staff.|Controles de cumplimiento para las operaciones de Punta Cana y el personal en el exterior.
Jurisdiction|Jurisdicción
Audits|Auditorías
Policy Gate|Control de política
HR Compliance • Roberto Gomez|Cumplimiento RR. HH. • Roberto Gomez
44h weekly OT threshold, 36h weekly rest|Umbral de 44 h semanales, 36 h de descanso semanal
Finance & Disbursement|Finanzas y desembolso
Register review, budget vs actual, then release across bank, Coinbase and Western Union rails.|Revisión del registro, presupuesto vs. real y liberación por banco, Coinbase y Western Union.
Signers|Firmantes
Rails|Canales
Dual-Keys Req|Requiere doble llave
Finance VP • Treasury|VP de Finanzas • Tesorería
Batches over $25,000 need dual signature • payout splits must total 100%|Lotes mayores a $25,000 requieren doble firma • las divisiones de pago deben sumar 100 %
Payroll approved • Payroll paid|Nómina aprobada • nómina pagada
Ledger Seal & Lock|Sello y cierre del libro
Immutable SHA-256 seal burned into the audit journal. Edits strictly blocked.|Sello SHA-256 inmutable grabado en el diario de auditoría. Ediciones bloqueadas.
Ledger state|Estado del libro
Hash root|Raíz hash
Tamper-Proof|A prueba de manipulación
Auto-Trigger|Activación automática
Bank Confirm|Confirmación bancaria
Day {n} • value date|Día {n} • fecha valor
Corrections only via Payroll Adjustments in next open period|Correcciones solo mediante ajustes en el próximo período abierto
New period begins|Comienza nuevo período
Overtime > 5 Hours|Horas extra > 5 horas
Engineering & Operations|Ingeniería y operaciones
Requires written justification + Lead PM sign-off|Requiere justificación escrita + firma del PM líder
Escalates to Elena Rostova|Escala a Elena Rostova
Jira Worklog Variance > 1.0h|Diferencia de registro Jira > 1,0 h
Jira Cloud sync hook|Gancho de sincronización Jira Cloud
Block approval until re-synced|Bloquear aprobación hasta resincronizar
Webhook auto-flags task tickets|El webhook marca las tareas automáticamente
Bank Split Modification|Cambio de división bancaria
Banking & multi-currency split|Banca y división multimoneda
Mandatory 2FA + HR auditor notification|2FA obligatorio + aviso al auditor de RR. HH.
Enforces 72h holding buffer on change|Aplica 72 h de espera tras el cambio
Disbursement > $50,000 USD|Desembolso > $50,000 USD
Single batch or total net payroll run|Lote único o nómina neta total
Executive board approval required|Requiere aprobación de la junta directiva
Generates cryptographic multi-sig payload|Genera una carga criptográfica multifirma
Approver Misses SLA|Aprobador incumple el SLA
Any approval stage|Cualquier etapa de aprobación
Auto-escalate to next level + Slack alert|Escalar al siguiente nivel + alerta en Slack
48h before payroll freeze|48 h antes del congelamiento de nómina
SLA: 24h before payroll freeze|SLA: 24 h antes del congelamiento
Employee Self-Service|Autoservicio del empleado
Clock in and out, record lunch, log Jira work and review your bi-weekly timesheet before submission.|Marca entrada y salida, registra el almuerzo y el trabajo en Jira, y revisa tu hoja quincenal antes de enviarla.
Request Time Off|Solicitar tiempo libre
Submit Timesheet|Enviar hoja de tiempo
Timesheet draft saved|Borrador de hoja de tiempo guardado
Worked today|Trabajado hoy
Clocked In|Entrada registrada
On Lunch Break|En almuerzo
Back at Work|De vuelta al trabajo
Clocked Out|Salida registrada
since {n}|desde {n}
Clock In|Entrada
Lunch Out|Salida a almuerzo
Lunch In|Regreso de almuerzo
Clock Out|Salida
Clock in|Entrada
Lunch out|Salida almuerzo
Lunch in|Regreso almuerzo
Clock out|Salida
Start Lunch|Iniciar almuerzo
End Lunch|Terminar almuerzo
Lunch started at {n}|Almuerzo iniciado a las {n}
Clocked out at {n}|Salida registrada a las {n}
Back from lunch at {n}|Regreso del almuerzo a las {n}
Total hours|Horas totales
Target {n}|Meta {n}
{n} / hr|{n} / h
{n} • pre-approved|{n} • preaprobado
approved|aprobado
None this period|Ninguno este período
Good Friday|Viernes Santo
Good Friday • Credited|Viernes Santo • acreditado
Missing entries|Entradas faltantes
Fix before submission|Corregir antes de enviar
All punches complete|Todas las marcaciones completas
Remaining days|Días restantes
Ends {n}|Termina {n}
Period ended {n}|Período terminado {n}
Approval status|Estado de aprobación
Not submitted|No enviado
{n} days remaining|{n} días restantes
Submitted Apr 14 at 17:52 • read-only while in approval. Ask your supervisor to return it if you need a correction.|Enviado el 14 abr a las 17:52 • solo lectura durante la aprobación. Pide a tu supervisor que lo devuelva si necesitas corregirlo.
OT starts after 44h / week|Las horas extra empiezan después de 44 h / semana
Submission due {n}|Envío vence {n}
Fix Entry|Corregir entrada
Missing Punch|Marcación faltante
Before clock-in|Antes de la entrada
Before lunch out|Antes de salir a almuerzo
Other|Otro
Notes|Notas
Meetings, training, admin…|Reuniones, capacitación, administración…
Log Work • Today|Registrar trabajo • hoy
Log Work|Registrar trabajo
Jira worklogs sync to Jira Cloud • meetings and other non-Jira tasks are logged manually • all matched against clocked hours|Los registros de Jira se sincronizan con Jira Cloud • reuniones y otras tareas fuera de Jira se registran manualmente • todo se compara con las horas marcadas
Work type|Tipo de trabajo
Jira issue|Incidencia Jira
Jira Issue|Incidencia Jira
Jira Issue (synced)|Incidencia Jira (sincronizada)
Meeting|Reunión
Meeting (manual)|Reunión (manual)
Training|Capacitación
Training (manual)|Capacitación (manual)
Internal Admin|Administración interna
Internal Admin (manual)|Administración interna (manual)
Client Support|Soporte al cliente
Client Support (manual)|Soporte al cliente (manual)
Interview / Hiring|Entrevista / contratación
Interview / Hiring (manual)|Entrevista / contratación (manual)
Other (manual)|Otro (manual)
Task title|Título de la tarea
Short task title|Título corto
e.g. Weekly payroll sync|ej. Reunión semanal de nómina
e.g. AML compliance course|ej. Curso de cumplimiento AML
e.g. Expense reports|ej. Reportes de gastos
e.g. Arawaki merchant onboarding call|ej. Llamada de incorporación de comercio en Arawaki
e.g. Backend candidate interview|ej. Entrevista a candidato backend
Work description|Descripción del trabajo
Description (required)|Descripción (obligatoria)
What did you work on?|¿En qué trabajaste?
Enter hours between 0.25 and 12|Ingresa horas entre 0,25 y 12
Add a description for non-Jira work|Agrega una descripción para el trabajo fuera de Jira
Synced to Jira Cloud|Sincronizado con Jira Cloud
Manual entry • not in Jira|Entrada manual • no está en Jira
{n} accounted|{n} justificado
{n} other|{n} otros
{n} Jira match|{n} coincidencia con Jira
{n} logged|{n} registradas
logged to {n}|registradas en {n}
synced to Jira Cloud|sincronizado con Jira Cloud
included in timesheet, not sent to Jira|incluido en la hoja, no se envía a Jira
Weekly Payroll Sync|Reunión semanal de nómina
Finance + HR alignment on PP-2025-08 approvals|Alineación de Finanzas y RR. HH. sobre aprobaciones de PP-2025-08
Sprint planning|Planificación del sprint
Client call with Arawaki|Llamada con cliente Arawaki
AML training|Capacitación AML
Approval Route|Ruta de aprobación
Submit {n} early?|¿Enviar {n} antes de tiempo?
Submit Anyway|Enviar de todos modos
Personal|Personal
Employment|Empleo
Payroll|Nómina
Banking|Banca
Jira & Approvals|Jira y aprobaciones
Personal Information|Información personal
Legal identity used on pay stubs and statutory filings|Identidad legal usada en volantes de pago y declaraciones
First name|Nombre
Last name|Apellido
Work email|Correo de trabajo
Enter a valid email|Ingresa un correo válido
Phone|Teléfono
Cédula / SSN / NI number|Cédula / SSN / NI
Date of birth|Fecha de nacimiento
Entity, reporting line and contract|Entidad, línea de reporte y contrato
Engineering|Ingeniería
Product|Producto
Infrastructure|Infraestructura
Quality|Calidad
Analytics|Analítica
Security|Seguridad
HR & People|RR. HH. y personas
Employment type|Tipo de empleo
Full-time|Tiempo completo
Part-time|Medio tiempo
Exempt|Exento
Independent Contractor|Contratista independiente
Start date|Fecha de inicio
First period:|Primer período:
Work location|Lugar de trabajo
Job title|Cargo
Payroll & Compensation|Nómina y compensación
Bi-weekly by default • 80h standard period|Quincenal por defecto • período estándar de 80 h
Pay frequency|Frecuencia de pago
Hourly rate|Tarifa por hora
Pay currency|Moneda de pago
Tax profile|Perfil fiscal
DGII ISR + TSS (Dominican Republic)|DGII ISR + TSS (República Dominicana)
Exempt (no tax deductions)|Exento (sin deducciones fiscales)
Overtime eligible|Elegible para horas extra
Contract Details|Detalles del contrato
Contractors appear on the Contractors page and stay out of payroll tax reports|Los contratistas aparecen en la página de Contratistas y quedan fuera de los reportes fiscales de nómina
Contract start|Inicio del contrato
Contract end|Fin del contrato
Tax form|Formulario fiscal
Invoice required per period|Factura requerida por período
Contractor uploads an invoice before payout|El contratista sube una factura antes del pago
Payment Method|Método de pago
Contractors can be paid by bank, USDC through Coinbase Business, or Western Union|Los contratistas pueden cobrar por banco, USDC vía Coinbase Business o Western Union
International employees can be paid in USDC through Coinbase Business|Los empleados internacionales pueden cobrar en USDC vía Coinbase Business
How is this employee paid?|¿Cómo se le paga a este empleado?
Bank Deposit|Depósito bancario
Coinbase Only|Solo Coinbase
Split: Bank + Coinbase|Dividido: banco + Coinbase
Bank Accounts|Cuentas bancarias
Split deposits across banks|Dividir depósitos entre bancos
Primary bank|Banco principal
Account number / IBAN|Número de cuenta / IBAN
Routing / SWIFT|Ruta / SWIFT
Primary allocation|Asignación principal
Secondary bank (optional)|Banco secundario (opcional)
Coinbase Payout (International)|Pago por Coinbase (internacional)
Paid through Coinbase Business on pay date • USD net pay sent 1:1 as USDC|Pagado vía Coinbase Business en la fecha de pago • neto en USD enviado 1:1 como USDC
Coinbase account email|Correo de la cuenta Coinbase
Coinbase user / account ID (optional)|ID de usuario / cuenta Coinbase (opcional)
Country of residence|País de residencia
Payout asset|Activo de pago
Network|Red
Wallet address|Dirección de billetera
Coinbase share of net pay|Porcentaje del neto por Coinbase
Use 1–99% for a split|Usa 1–99 % para dividir
Coinbase identity verified (KYC)|Identidad verificada en Coinbase (KYC)
Required before the first payout|Requerido antes del primer pago
W-8BEN / tax form on file|W-8BEN / formulario fiscal archivado
Non-US contractors • no US withholding|Contratistas fuera de EE. UU. • sin retención de EE. UU.
Western Union Payout (International)|Pago por Western Union (internacional)
Sent through Western Union Business Solutions on pay date • USD converted at the locked WU rate • fee company-paid|Enviado vía Western Union Business Solutions en la fecha de pago • USD convertido a la tasa fijada por WU • comisión pagada por la empresa
Receiver full name (exactly as on ID)|Nombre completo del receptor (igual que en su ID)
Delivery method|Método de entrega
Cash Pickup|Retiro en efectivo
Mobile Wallet|Billetera móvil
Receiver country|País del receptor
City / state|Ciudad / estado
Payout currency|Moneda de pago
Local currency|Moneda local
Receiver ID type|Tipo de ID del receptor
National ID|Cédula / ID nacional
Passport|Pasaporte
Driver License|Licencia de conducir
Receiver ID number|Número de ID del receptor
As printed on the ID|Tal como aparece en el ID
Receiver bank|Banco del receptor
Account number / CLABE|Número de cuenta / CLABE
18-digit CLABE or account #|CLABE de 18 dígitos o n.º de cuenta
Mobile wallet number|Número de billetera móvil
Worklog binding and approval routing|Vinculación de registros y ruta de aprobación
Atlassian account email|Correo de la cuenta Atlassian
Bound Jira projects|Proyectos Jira vinculados
Approval route|Ruta de aprobación
Record Preview|Vista previa del registro
Estimated Pay per Period|Pago estimado por período
Estimate based on|Estimación basada en
Readiness Checks|Verificaciones de preparación
Personal & identity complete|Datos personales e identidad completos
Employment details complete|Datos de empleo completos
Hourly rate set|Tarifa por hora definida
Bank allocation totals {n}|Asignación bancaria suma {n}
Payout allocations total 100%|Las asignaciones de pago suman 100 %
Jira account bound (optional)|Cuenta Jira vinculada (opcional)
Coinbase wallet address valid|Dirección de billetera Coinbase válida
KYC verified & tax form on file|KYC verificado y formulario fiscal archivado
Western Union receiver details complete|Datos del receptor de Western Union completos
Tax form on file|Formulario fiscal archivado
Create Employee|Crear empleado
Create with missing details?|¿Crear con datos faltantes?
Create as Pending|Crear como pendiente
Still missing:|Aún falta:
Employee ID|ID de empleado
Employee Created|Empleado creado
The record is saved and onboarding has started. Track the remaining steps below.|El registro se guardó y comenzó la incorporación. Sigue los pasos restantes abajo.
Onboarding Progress|Progreso de incorporación
Record Summary|Resumen del registro
Employee record created|Registro de empleado creado
ESS invitation sent|Invitación de autoservicio enviada
Add a work email to send the invite|Agrega un correo de trabajo para enviar la invitación
Supervisor notified|Supervisor notificado
Approval routing activated|Ruta de aprobación activada
Bank account verification|Verificación de cuenta bancaria
Micro-deposit check • 72h cooling period + 2FA|Microdepósito de prueba • 72 h de espera + 2FA
Western Union receiver validation|Validación del receptor de Western Union
Coinbase wallet test transfer|Transferencia de prueba a Coinbase
Jira Cloud binding|Vinculación con Jira Cloud
Worklogs sync on next webhook cycle|Los registros se sincronizan en el próximo ciclo del webhook
No Atlassian account bound|Sin cuenta Atlassian vinculada
Enrolled in first pay period|Inscrito en el primer período de pago
Held until onboarding items are completed|Retenido hasta completar la incorporación
Timesheet opens automatically|La hoja de tiempo se abre automáticamente
Active • Ready for Payroll|Activo • listo para nómina
Add Another Employee|Agregar otro empleado
View Directory|Ver directorio
Open Profile|Abrir perfil
Complete Details|Completar datos
Proof of Payment|Comprobante de pago
Attach bank transfer confirmations or Coinbase transaction hashes • printed on the pay stub and logged to the Audit Log|Adjunta confirmaciones de transferencia o hashes de Coinbase • se imprimen en el volante y quedan en el registro de auditoría
All transfers confirmed|Todas las transferencias confirmadas
{n} of {n} transfers confirmed|{n} de {n} transferencias confirmadas
Proof Attached|Comprobante adjunto
Awaiting Proof|Esperando comprobante
Payment Confirmed|Pago confirmado
Attach Proof to Pay Stub|Adjuntar comprobante al volante
Trace / reference #|N.º de rastreo / referencia
IMAD / OMAD #|N.º IMAD / OMAD
Drop the bank transfer confirmation here|Suelta aquí la confirmación de transferencia
PDF, PNG or JPG up to 8 MB • or click to browse|PDF, PNG o JPG hasta 8 MB • o haz clic para buscar
PDF, PNG or JPG • Max 5 MB|PDF, PNG o JPG • máx. 5 MB
Enter a valid transaction hash (0x + 64 hex)|Ingresa un hash válido (0x + 64 hex)
Drop or choose the confirmation file first|Primero suelta o elige el archivo de confirmación
On-chain record|Registro en cadena
Proof removed|Comprobante quitado
Proofs can be removed until PP-2025-08 is locked (Apr 21). After lock they become part of the sealed record.|Los comprobantes se pueden quitar hasta que PP-2025-08 se bloquee (21 abr). Después forman parte del registro sellado.
Est. net pay|Pago neto est.
Bi-Weekly Approval Workspace|Espacio de aprobación quincenal
Active • Synced 2m ago|Activo • sincronizado hace 2 min
Approval Policy|Política de aprobación
Pending Approvals|Aprobaciones pendientes
/ 86 Employees|/ 86 empleados
{n} On-Track|{n} en curso
{n} Processed|{n} procesados
Total Hours Under Review|Horas totales en revisión
hrs|h
Estimated Payroll Obligation|Obligación de nómina estimada
Jira Sync Discrepancies|Discrepancias de sincronización Jira
Needs supervisor review|Requiere revisión del supervisor
Search team member, ID, or Jira task...|Buscar miembro, ID o tarea Jira...
Bulk Approve|Aprobar en lote
No employees match.|Ningún empleado coincide.
Hourly cost basis|Base de costo por hora
Timesheet lifecycle • Multi-tier multi-role clearance|Ciclo de la hoja de tiempo • aprobación por niveles y roles
Billable Jira|Jira facturable
Non-billable|No facturable
Total time|Tiempo total
Est. Gross|Bruto est.
Est. gross|Bruto est.
Daily Breakdown & Jira Worklogs Cross-Reference|Desglose diario y cruce con registros Jira
Date & Day|Fecha y día
Clock In / Out|Entrada / salida
Jira Issue & Task|Incidencia y tarea Jira
Jira Worklog|Registro Jira
Jira Variance|Diferencia Jira
Jira Sync Validated|Sincronización Jira validada
Jira Worklogs by Issue|Registros Jira por incidencia
Realtime bi-directional map • Atlassian Cloud|Mapa bidireccional en tiempo real • Atlassian Cloud
Payroll Summary|Resumen de nómina
Estimated for {n}|Estimado para {n}
Gross pay|Pago bruto
Attachments|Adjuntos
Comments|Comentarios
Add a comment for the approval chain…|Agrega un comentario para la cadena de aprobación…
Post|Publicar
Approval History|Historial de aprobación
Apply Electronic Signature (Elena Rostova, PM)|Aplicar firma electrónica (Elena Rostova, PM)
Return for Corrections|Devolver para corrección
Approve Only|Solo aprobar
Approve & Next Employee|Aprobar y siguiente empleado
Return Timesheet|Devolver hoja de tiempo
Reason (required) — e.g. Apr 08 worklog on ATLAS-420 is 0.5h short of clock time.|Motivo (obligatorio) — ej. el registro del 08 abr en ATLAS-420 tiene 0,5 h menos que la marcación.
The employee and supervisor will be notified. The timesheet re-enters the lifecycle at|Se notificará al empleado y al supervisor. La hoja vuelve al ciclo en
Supervisor Note • Marcus Vance|Nota del supervisor • Marcus Vance
Current Step|Paso actual
HR Review|Revisión RR. HH.
Finance Run|Corrida de finanzas
Lock / Batch|Cierre / lote
Disbursement|Desembolso
Approved by Elena Rostova (PM)|Aprobado por Elena Rostova (PM)
Just now • e-signature applied|Justo ahora • firma electrónica aplicada
Supervisor approved|Supervisor aprobó
Jira worklogs reconciled|Registros Jira conciliados
Auto-sync • {n}|Sincronización automática • {n}
Timesheet submitted|Hoja de tiempo enviada
Draft saved|Borrador guardado
PDF exported|PDF exportado
Upload dialog|Diálogo de carga
Approvals|Aprobaciones
Pay Period {n}|Período de pago {n}
Team Queue|Cola del equipo
Every timesheet awaiting your sign-off across entities. Select rows to approve or return in bulk.|Todas las hojas de tiempo que esperan tu firma en todas las entidades. Selecciona filas para aprobar o devolver en lote.
Saved Views|Vistas guardadas
Saved Views opened|Vistas guardadas abiertas
Open Workspace|Abrir espacio de trabajo
Approved this period|Aprobados este período
SLA: due in|SLA: vence en
Search name, ID, project…|Buscar nombre, ID, proyecto…
Jira match|Coincidencia Jira
Timesheets|Hojas de tiempo
Bi-Weekly Timesheet|Hoja de tiempo quincenal
Import Jira Worklogs|Importar registros Jira
Submit for Approval|Enviar para aprobación
Submitted • Awaiting Supervisor|Enviado • esperando supervisor
Pulled 14 worklogs from Jira Cloud|Se trajeron 14 registros de Jira Cloud
Timesheet submitted for approval|Hoja de tiempo enviada para aprobación
Good morning, Elena|Buenos días, Elena
Review 14 Approvals|Revisar 14 aprobaciones
Active workforce|Personal activo
employees|empleados
+4 this quarter|+4 este trimestre
Period payroll|Nómina del período
Billable utilization|Utilización facturable
Compliance alerts|Alertas de cumplimiento
2 Jira • 1 Banking|2 Jira • 1 banca
Gross payroll trend|Tendencia de nómina bruta
Last 6 bi-weekly periods (thousands USD)|Últimos 6 períodos quincenales (miles USD)
Cost by department|Costo por departamento
Needs your attention|Requiere tu atención
View queue|Ver cola
Period timeline|Línea de tiempo del período
Timesheet submission closed|Envío de hojas cerrado
Supervisor & PM approval|Aprobación de supervisor y PM
HR review|Revisión RR. HH.
Disbursement (ACH / FedWire)|Desembolso (ACH / FedWire)
86 people across 3 operating entities. Independent contractors are managed separately.|86 personas en 3 entidades operativas. Los contratistas independientes se gestionan por separado.
View Contractors|Ver contratistas
Search name, ID, role, location…|Buscar nombre, ID, cargo, ubicación…
Dominicana SRL|Dominicana SRL
Edit Employee|Editar empleado
Edit Employee opened|Edición de empleado abierta
Generate Pay Statement|Generar estado de pago
Reset Jira API Token|Restablecer token API de Jira
Jira API token reset|Token API de Jira restablecido
Active / On-Roll|Activo / en nómina
Overview & Profile|Resumen y perfil
Multi-Bank Allocations|Asignaciones multibanco
Compensation & Tax|Compensación e impuestos
Jira Integration|Integración Jira
Time Off & PTO|Tiempo libre y vacaciones
Documents|Documentos
Employment details|Datos de empleo
RNC / Cédula Personal|RNC / cédula personal
TSS Registry|Registro TSS
Compensation & Overtime Rules|Reglas de compensación y horas extra
Edit Tariff|Editar tarifa
Edit Tariff opened|Edición de tarifa abierta
Base hourly|Tarifa base por hora
Sunday / Holiday|Domingo / feriado
Billable efficiency — target ≥ 95%|Eficiencia facturable — meta ≥ 95 %
Jira Cloud Account Binding|Vinculación de cuenta Jira Cloud
Atlassian Cloud ID|ID de Atlassian Cloud
Bound worklog projects|Proyectos de registro vinculados
Bind Project|Vincular proyecto
Bind Project opened|Vinculación de proyecto abierta
Real-Time Worklog Auto-Sync|Sincronización automática en tiempo real
Sync interval: Every 5m • Webhook Active|Intervalo: cada 5 min • webhook activo
System audit log|Registro de auditoría del sistema
Live Feed|En vivo
No withholdings|Sin retenciones
Withholding|Retención
Bank route verification confirmed|Verificación de ruta bancaria confirmada
Tariff updated: OT threshold 44h|Tarifa actualizada: umbral de horas extra 44 h
Overtime & premiums|Horas extra y primas
Payroll ready • Cycle PP-2025-08 • Auto-lock in 4d 18h|Nómina lista • ciclo PP-2025-08 • cierre automático en 4 d 18 h
Pay calendar|Calendario de pago
Start Payroll Run|Iniciar corrida de nómina
Gross payroll|Nómina bruta
Employer taxes|Impuestos patronales
Net disbursement|Desembolso neto
Exceptions|Excepciones
Regular vs overtime cost|Costo regular vs. horas extra
Thousands USD per period|Miles USD por período
By operating entity|Por entidad operativa
Upcoming pay periods|Próximos períodos de pago
100% routed|100 % enrutado
5 banks|5 bancos
Pre-checks|Verificaciones previas
Import Hours|Importar horas
Review Exceptions|Revisar excepciones
Calculate|Calcular
Approve & Lock|Aprobar y bloquear
Disburse|Desembolsar
Exceptions to resolve|Excepciones por resolver
Payroll cannot lock while high-severity items are open.|La nómina no puede bloquearse con incidencias de alta severidad abiertas.
Resolve before lock|Resolver antes del cierre
Mark resolved|Marcar resuelto
Overtime exceeds 10h policy cap|Horas extra exceden el tope de 10 h
Needs VP sign-off|Requiere firma del VP
Jira worklog 4.0h short of clock time|Registro Jira 4,0 h menor que la marcación
Return to employee|Devolver al empleado
New bank account in 72h cooling period|Cuenta bancaria nueva en espera de 72 h
Hold allocation|Retener asignación
Pre-run checklist|Lista previa a la corrida
Exchange rates locked (DOP 59.12)|Tasas de cambio fijadas (DOP 59,12)
TSS & ISR tables — 2025 rev.|Tablas TSS e ISR — rev. 2025
Jira Cloud sync < 5m old|Sincronización Jira Cloud < 5 min
Bank cut-off: FedWire 16:00 ET|Corte bancario: FedWire 16:00 ET
Dual control approver assigned|Aprobador de doble control asignado
Release Funds|Liberar fondos
Continue to|Continuar a
Disbursement released to banks|Desembolso liberado a los bancos
Employees|Empleados
Pay Stub Preview|Vista previa del volante de pago
Earnings statement|Estado de ingresos
Employer|Empleador
Earnings|Ingresos
Deductions|Deducciones
Tax deductions|Deducciones fiscales
Tax deductions — Exempt|Deducciones fiscales — exento
Direct deposit allocation|Asignación de depósito directo
Net pay|Pago neto
Summary|Resumen
Year to date|Acumulado del año
YTD gross|Bruto acumulado
YTD withholding|Retención acumulada
Pay stub emailed to employee|Volante enviado al empleado
PDF downloaded|PDF descargado
Overtime 1.5×|Horas extra 1,5×
Tax-exempt profile — no statutory withholdings applied. The payee is responsible for their own tax obligations.|Perfil exento — no se aplican retenciones legales. El beneficiario es responsable de sus obligaciones fiscales.
Withholdings computed under Dominican Law 87-01 and the Dominican Tax Code.|Retenciones calculadas según la Ley 87-01 y el Código Tributario dominicano.
Withholdings computed from the employee W-4 and IRS Pub. 15-T tables.|Retenciones calculadas según el W-4 del empleado y las tablas IRS Pub. 15-T.
Withholdings computed under HMRC PAYE and NI thresholds.|Retenciones calculadas según los umbrales PAYE y NI de HMRC.
Exempt — not subject to tax deductions|Exento — no sujeto a deducciones fiscales
ISR withholding|Retención ISR
Federal income tax|Impuesto federal sobre la renta
PAYE income tax|Impuesto PAYE
National Insurance|Seguro Nacional (NI)
Social Security (6.2%)|Seguro Social (6,2 %)
Central Banking & Treasury|Banca central y tesorería
Funding accounts, payout rails and multi-bank splits for every operating entity.|Cuentas de fondeo, canales de pago y divisiones multibanco por entidad.
Audit History|Historial de auditoría
Add Bank Account|Agregar cuenta bancaria
Treasury balance|Saldo de tesorería
This cycle outflow|Salidas de este ciclo
Verified rails|Canales verificados
Disbursement accounts|Cuentas de desembolso
Search bank, country, rail…|Buscar banco, país, canal…
Primary ACH|ACH principal
Offshore FedWire|FedWire extraterritorial
United States|Estados Unidos
United Kingdom|Reino Unido
Dominican Republic|República Dominicana
Cooling 72h|Espera 72 h
2FA challenge sent to YubiKey|Desafío 2FA enviado a YubiKey
Default split rule|Regla de división predeterminada
Applied to contractors in MGH Dominicana SRL|Aplicada a contratistas de MGH Dominicana SRL
Allocation ratio summary|Resumen de proporciones de asignación
Compliance & 3-Day Verification Policy|Política de cumplimiento y verificación de 3 días
Connected • globalhub.atlassian.net • Synced 2m ago|Conectado • globalhub.atlassian.net • sincronizado hace 2 min
Field Mapping|Mapeo de campos
Sync Now|Sincronizar ahora
Worklogs this period|Registros este período
Hours reconciled|Horas conciliadas
Discrepancies|Discrepancias
Sprint 24 labor cost|Costo laboral sprint 24
+16% vs S23|+16 % vs. S23
Sprint cost analytics|Analítica de costo por sprint
Labor cost per sprint (thousands USD)|Costo laboral por sprint (miles USD)
Connection|Conexión
Site|Sitio
Webhook|Webhook
Real-time worklog sync|Sincronización en tiempo real
Every 5m + webhook push|Cada 5 min + webhook
Bi-directional mapping|Mapeo bidireccional
Write approvals back to Jira as labels|Escribir aprobaciones en Jira como etiquetas
Reconciliation exceptions|Excepciones de conciliación
Full re-sync started — 1,284 worklogs|Resincronización completa iniciada — 1,284 registros
Labor budgets and billable utilization by Jira project.|Presupuestos laborales y utilización facturable por proyecto Jira.
Search project, key, lead…|Buscar proyecto, clave, líder…
Link Jira Project|Vincular proyecto Jira
New project linked|Nuevo proyecto vinculado
On track|En curso
At risk|En riesgo
Over budget|Sobre presupuesto
Insights|Análisis
Executive Payroll Register|Registro ejecutivo de nómina
Register exported (XLSX)|Registro exportado (XLSX)
Payroll Register|Registro de nómina
Labor Distribution|Distribución laboral
Tax Liability|Obligación fiscal
Overtime Analysis|Análisis de horas extra
Billable vs Non-billable|Facturable vs. no facturable
Filter register…|Filtrar registro…
Administration|Administración
Operating entities, users, roles and approval governance.|Entidades operativas, usuarios, roles y gobierno de aprobaciones.
Invite User|Invitar usuario
Invite sent|Invitación enviada
Branch|Sucursal
HQ|Sede
Users & roles|Usuarios y roles
Require MFA|Exigir MFA
Require MFA opened|Exigir MFA abierto
Suspend|Suspender
Suspend opened|Suspensión abierta
Last active|Última actividad
User|Usuario
Role|Rol
Entity scope|Alcance de entidad
Approval workflow policy|Política de flujo de aprobación
Employee → Supervisor → Project Manager → HR → Finance → Lock • managed in one place|Empleado → Supervisor → Gerente de proyecto → RR. HH. → Finanzas → Cierre • gestionado en un solo lugar
Open Approval Workflows|Abrir flujos de aprobación
Company Settings|Configuración de la empresa
General|General
Pay Schedule|Calendario de pago
Time & Overtime|Tiempo y horas extra
Notifications|Notificaciones
Company profile|Perfil de la empresa
Legal name|Razón social
RNC (Tax ID)|RNC (ID fiscal)
Headquarters|Sede principal
Base currency|Moneda base
Multi-currency|Multimoneda
Pay schedule|Calendario de pago
Frequency|Frecuencia
Period start|Inicio del período
Submission deadline|Plazo de envío
Pay date offset|Desfase de fecha de pago
Bi-weekly (26 / yr)|Quincenal (26 / año)
Time & approval rules|Reglas de tiempo y aprobación
Require pre-authorization for overtime|Exigir autorización previa para horas extra
Overtime over 44h/week must be approved before it is logged.|Las horas extra sobre 44 h/semana deben aprobarse antes de registrarse.
Electronic signature on approval|Firma electrónica al aprobar
Approvers sign each decision; signatures are hashed into the audit log.|Los aprobadores firman cada decisión; las firmas se registran con hash en la auditoría.
Auto-lock period after Finance Run|Bloquear período tras la corrida de finanzas
Prevents edits once disbursement is batched.|Impide ediciones una vez agrupado el desembolso.
Allow weekend time entry|Permitir registro en fin de semana
Sunday hours are paid at double rate.|Las horas del domingo se pagan doble.
Audit Log|Registro de auditoría
Tamper-evident • Hash chain intact|Evidencia de manipulación • cadena hash intacta
Export Evidence Pack|Exportar paquete de evidencia
Export Evidence Pack queued|Paquete de evidencia en cola
Search actor, event, target…|Buscar actor, evento, destino…
API keys|Claves API
Compliance Engine|Motor de cumplimiento
Scheduler|Programador
Independent contractors paid against invoices and approved timesheets — no employee payroll, withholdings or TSS.|Contratistas independientes pagados contra facturas y hojas aprobadas — sin nómina de empleados, retenciones ni TSS.
Add Contractor|Agregar contratista
New contractor draft created|Borrador de contratista creado
Active contractors|Contratistas activos
Due {n}|Vence {n}
Payout rails|Canales de pago
Coinbase • WU|Coinbase • WU
Search name, ID, country…|Buscar nombre, ID, país…
Payout|Pago
Personal information|Información personal
Email|Correo
Contract|Contrato
End date|Fecha de fin
Open-ended|Indefinido
Fixed monthly fee|Tarifa mensual fija
Contract currency|Moneda del contrato
Receiver name (as on ID)|Nombre del receptor (como en el ID)
Payout location|Lugar de pago
Transfer fee|Comisión de transferencia
Preferred currency|Moneda preferida
Payment History|Historial de pagos
Total due|Total a pagar
Search payment or contractor ID…|Buscar pago o ID de contratista…
Paid via|Pagado vía
Amount sent|Monto enviado
Timesheet|Hoja de tiempo
Manager Approval|Aprobación del gerente
Calculate Amount|Calcular monto
Create Payment|Crear pago
Approve Payment|Aprobar pago
Send via Western Union|Enviar por Western Union
Record MTCN|Registrar MTCN
Send via Coinbase|Enviar por Coinbase
Record Tx ID|Registrar ID de transacción
Record MTCN & Mark Paid|Registrar MTCN y marcar pagado
Record Transaction & Mark Paid|Registrar transacción y marcar pagado
Enter the 10-digit MTCN|Ingresa el MTCN de 10 dígitos
Enter the Coinbase transaction ID and hash|Ingresa el ID de transacción y el hash de Coinbase
Payment recorded as Paid|Pago registrado como pagado
Western Union payment recorded as Paid|Pago de Western Union registrado como pagado
Payment created • awaiting approval|Pago creado • esperando aprobación
Payment register exported|Registro de pagos exportado
Payment date|Fecha de pago
MTCN (tracking number)|MTCN (número de seguimiento)
Receiver (as on ID)|Receptor (como en el ID)
Exchange rate|Tasa de cambio
Coinbase transaction ID|ID de transacción Coinbase
Blockchain tx hash|Hash de la transacción
Blockchain transaction hash|Hash de la transacción en blockchain
Network fee|Comisión de red
MTCN from Western Union receipt|MTCN del recibo de Western Union
Supporting document|Documento de respaldo
Drop Coinbase receipt or|Suelta el recibo de Coinbase o
Drop Western Union receipt or|Suelta el recibo de Western Union o
browse|busca
Accounting entry|Asiento contable
Debit • Contractor Expense|Débito • gasto de contratistas
Credit • Coinbase USDC Wallet|Crédito • billetera USDC de Coinbase
Credit • Western Union Business Solutions|Crédito • Western Union Business Solutions
Debit • Network Fees|Débito • comisiones de red
Debit • Transfer Fees|Débito • comisiones de transferencia
Add a note for the payment record…|Agrega una nota al registro del pago…
Picked up at agent location. Receiver ID verified by Western Union.|Retirado en agente. ID del receptor verificado por Western Union.
Deposited to receiver bank account by Western Union.|Depositado en la cuenta del receptor por Western Union.
Confirmed on-chain. Contractor acknowledged receipt.|Confirmado en cadena. El contratista confirmó la recepción.
Upload a PDF, PNG or JPG receipt|Sube un recibo PDF, PNG o JPG
Max file size is 5 MB|El tamaño máximo es 5 MB
File too large to persist — kept for this session|Archivo muy grande para guardar — se mantiene en esta sesión
Sr. Full Stack Developer|Desarrollador Full Stack Sr.
Backend Engineer|Ingeniero backend
Frontend Engineer|Ingeniera frontend
DevOps Engineer|Ingeniero DevOps
QA Automation Lead|Líder de automatización QA
Data Engineer|Ingeniera de datos
Payroll Specialist|Especialista de nómina
Site Reliability Eng.|Ing. de confiabilidad (SRE)
Product Manager|Gerente de producto
Security Analyst|Analista de seguridad
ML Engineer|Ingeniera de ML
UI/UX Architect|Arquitecta UI/UX
QA Tester|Probador QA
Frontend Developer|Desarrolladora frontend
Data Analyst|Analista de datos
Backend Developer|Desarrollador backend
Product Designer|Diseñadora de producto
Content Writer|Redactora de contenido
Customer Support Lead|Líder de soporte al cliente
Mobile Developer|Desarrollador móvil
Venezuela|Venezuela
Mexico|México
Peru|Perú
Brazil|Brasil
Philippines|Filipinas
Spain|España
Remote, US|Remoto, EE. UU.
Remote, EU|Remoto, UE
`;
  const KEEP = new Set(['Carlos Mendez','Elena Rostova','Marcus Vance','Ana Gómez','Sofia Almonte','David Wu','Mariana Reyes','Javier Peña','Priya Natarajan','Luis Cabrera','Hannah Kim','Rafael Ortiz','Grace Okafor','Tomás Vidal','Elif Demir','Juan Pérez','María Fernández','Diego Salazar','Andrés Rojas','Lucía Torres','Camila Ortiz','Sofía Ramírez','Luis Hernández','Marcus Calderon','Roberto Gomez','M. Vance','E. Rostova','My Global Hub','My Global Hub Dominicana','My Global Hub Dominicana SRL','MGH Dominicana SRL','MGH USA Inc.','MGH UK Ltd.','My Global Hub USA Inc.','My Global Hub UK Ltd.','Kairoon','Arawaki','Banco BHD León','Banco Popular','Banreservas','Chase Bank USA','Chase Bank USA, N.A.','Wells Fargo','Barclays','Revolut Business','Banco Atlántida','Coinbase','Western Union','Jira','Jira Cloud','USDC','USD','DOP','GBP','MXN','HNL','ACH','FedWire','Base','Ethereum','Polygon','Solana','Multi-HQ','OAuth 2.0','TSS • DGII','TSS • FICA • NI','DGII (ISR + TSS)','W-4 (US Federal)','PAYE (HMRC)','MGH','SLA','PM','KPI','Punta Cana, DR','Santo Domingo, DR','Santiago, DR','Austin, TX','Seattle, WA','London, UK','Colombia','Argentina','Honduras','Guatemala','India','Nigeria','Portugal','Atlas Core','Global Hub v3','Perf Infra','Insights Lake','Internal Ops','GraphQL API Optimization','Hotfix: Redis Cluster Failover','Auth Microservice Integration','Database Sharding Pipeline','Standup & Sprint Planning','Atlas Core Platform','Perf Infrastructure','Core Billing Services','ATLAS (Core Platform)','PERF (Infrastructure)','Español','English','Français','Português','Italiano','Deutsch','Nederlands','简体中文','繁體中文','日本語','한국어','العربية','Enterprise Payroll','(Punta Cana Operations)','Elena','Total','General','Email','Webhook','Live','Art. 155 Ley 16-92','Ley 16-92','Banco BHD León • ACH • 80%','Chase Bank USA • FedWire • 20%','AFP 2.87%','Medicare (1.45%)','TSS — SFS (3.04%)','TSS — AFP (2.87%)','UK PAYE + NI','US Federal W-4 + State','W-8BEN (non-US individual)','W-8BEN-E (non-US entity)','W-9 (US person)','Local invoice + RNC (DR)','Employee → Supervisor → PM → HR → Finance','Employee → Supervisor → HR → Finance']);
  const dict = {}, tmpl = {};
  RAW.trim().split('\n').forEach(l => { const i = l.indexOf('|'); if (i < 0) return; const a = l.slice(0, i).trim(), b = l.slice(i + 1).trim(); (a.includes('{n}') ? tmpl : dict)[a] = b; });
  let custom = {}; try { custom = JSON.parse(localStorage.getItem(LS_CUSTOM) || '{}'); } catch (e) {}
  let enabled; try { enabled = JSON.parse(localStorage.getItem(LS_EN) || 'null'); } catch (e) {}
  if (!Array.isArray(enabled)) enabled = ['es', 'en'];
  let def = localStorage.getItem(LS_DEF) || 'es'; if (!['es', 'en'].includes(def)) def = 'es'; if (!enabled.includes(def)) enabled.push(def);
  let lang = localStorage.getItem(LS_LANG) || def; if (!enabled.includes(lang)) lang = def;
  const OUTS = new Set();
  const missing = new Map(); const hit = new Set();

  const DATE_RE = /(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),? )?\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})(?:, (\d{4}))?(?: at (\d{1,2}:\d{2}))?/g;
  const TOK_RE = /@@\d+@@|[#$€£A-Za-z]*[-\w$#.,:%/+−×–]*\d[\w.,:%/+×−–-]*(?:\s?(?:AM|PM))?/g;
  const locDate = (m, dw, mo, d, y, t) => (dw ? DOW_ES[dw] + ', ' : '') + parseInt(d, 10) + ' ' + MON_ES[mo] + (y ? ' ' + y : '') + (t ? ' a las ' + t : '');
  const look = s => custom[s] || dict[s] || (KEEP.has(s) ? s : null);
  function core(s) {
    let r = look(s); if (r != null) return r;
    if (s.endsWith(':') && look(s.slice(0, -1))) return look(s.slice(0, -1)) + ':';
    // tokenise dates + numbers/IDs
    const toks = []; let k = s.replace(DATE_RE, (...a) => { toks.push(locDate(...a)); return '@@' + (toks.length - 1) + '@@'; });
    const vals = []; const shape = k.replace(TOK_RE, m => { vals.push(/^@@\d+@@$/.test(m) ? toks[+m.slice(2, -2)] : m); return '{n}'; });
    if (vals.length) {
      const t = custom[shape] || tmpl[shape] || (/[A-Za-z]/.test(shape.replace(/\{n\}/g, '')) ? null : shape);
      if (t != null) { let i = 0; return t.replace(/\{n\}/g, () => vals[i++] ?? ''); }
    }
    for (const sep of [' • ', ' — ', ' / ', ' → ']) if (s.includes(sep)) { const parts = s.split(sep).map(p => core(p)); if (parts.every(p => p != null)) return parts.join(sep); }
    return null;
  }
  function tx(src) {
    if (lang === 'en' || !src) return src;
    const m = src.match(/^(\s*)([\s\S]*?)(\s*)$/); const s = m[2]; if (!s || !/[A-Za-z]{2}/.test(s)) return src;
    if (OUTS.has(s)) return src;
    const r = core(s);
    if (r == null) { if (/^[a-z]+(_[a-z]+)*$/.test(s) || /\b(ene|feb|mar|abr|may|jun|jul|ago|sept|oct|nov|dic)\b \d{4}|\d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sept|oct|nov|dic)\b/.test(s)) return src; if (lang === 'es' && s.length < 160 && !missing.has(s)) { missing.set(s, 1); bump(); } return src; }
    hit.add(s); OUTS.add(r); return m[1] + r + m[3];
  }
  let bt; const bump = () => { clearTimeout(bt); bt = setTimeout(() => window.dispatchEvent(new Event('mgh-i18n-missing')), 400); };

  // DOM translation layer (prototype): translates rendered text without touching React state.
  const SRC = new WeakMap(), OUT = new WeakMap(), ATTR = ['placeholder', 'title', 'aria-label'];
  const skip = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const t = n.tagName; if (t === 'SCRIPT' || t === 'STYLE' || t === 'TEXTAREA' || t === 'CODE' || n.hasAttribute('data-i18n-skip') || n.classList.contains('material-symbols-outlined') || n.classList.contains('material-symbols-rounded')) return true; } return false; };
  function doText(node) {
    const v = node.nodeValue; if (OUT.get(node) === v) return;
    if (!node.parentElement || skip(node.parentElement)) return;
    SRC.set(node, v); const o = tx(v); OUT.set(node, o); node.__mghSrc = v; node.__mghOut = o; if (o !== v) node.nodeValue = o;
  }
  function doAttrs(el) {
    if (skip(el)) return;
    for (const a of ATTR) { if (!el.hasAttribute(a)) continue; const v = el.getAttribute(a), key = 'i18n' + a; const prevOut = el['__o_' + a];
      if (prevOut === v) continue; el['__s_' + a] = v; const o = tx(v); el['__o_' + a] = o; if (o !== v) el.setAttribute(a, o); }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    doAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) n.nodeType === 3 ? doText(n) : doAttrs(n);
  }
  let REV = null;
  const revLookup = s => { if (!s) return null; if (!REV) { REV = {}; Object.keys(dict).forEach(k => { if (!(dict[k] in REV)) REV[dict[k]] = k; }); Object.keys(custom).forEach(k => { REV[custom[k]] = k; }); } return REV[s] != null && REV[s] !== s ? REV[s] : null; };
  function restoreAll() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        const src = SRC.has(n) ? SRC.get(n) : n.__mghSrc, out = OUT.has(n) ? OUT.get(n) : n.__mghOut;
        if (src != null && out === n.nodeValue) n.nodeValue = src;
        else if (!n.parentElement || !skip(n.parentElement)) { const m = n.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/); const en = m && revLookup(m[2]); if (en != null) n.nodeValue = m[1] + en + m[3]; }
        SRC.delete(n); OUT.delete(n); n.__mghSrc = n.__mghOut = undefined; }
      else for (const a of ATTR) { if (n['__s_' + a] != null && n.getAttribute(a) === n['__o_' + a]) n.setAttribute(a, n['__s_' + a]); n['__s_' + a] = n['__o_' + a] = undefined; }
    }
  }
  let obs;
  function start() {
    if (obs || !document.body) return;
    obs = new MutationObserver(list => { if (lang === 'en') return; for (const m of list) { if (m.type === 'characterData') doText(m.target); else if (m.type === 'attributes') doAttrs(m.target); else m.addedNodes.forEach(walk); } });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
    apply();
  }
  function apply() {
    const L = LOCALES.find(l => l.code === lang) || LOCALES[0];
    document.documentElement.lang = lang; document.documentElement.dir = L.dir;
    restoreAll(); if (lang !== 'en') walk(document.body);
  }
  const save = () => { try { localStorage.setItem(LS_EN, JSON.stringify(enabled)); localStorage.setItem(LS_CUSTOM, JSON.stringify(custom)); } catch (e) {} };
  const fire = () => window.dispatchEvent(new Event('mgh-lang'));

  window.MGH_I18N = {
    LOCALES, get lang() { return lang; }, get enabled() { return enabled.slice(); },
    locale() { return (LOCALES.find(l => l.code === lang) || LOCALES[0]).locale; },
    tx,
    setLang(c) { if (!enabled.includes(c)) return false; lang = c; try { localStorage.setItem(LS_LANG, c); } catch (e) {} apply(); fire(); return true; },
    get defaultLang() { return def; },
    setDefault(c) { if (!['es', 'en'].includes(c)) return false; def = c; if (!enabled.includes(c)) enabled.push(c); try { localStorage.setItem(LS_DEF, c); } catch (e) {} save(); fire(); return true; },
    setEnabled(c, on) { if (c === def && !on) return false; enabled = on ? [...new Set([...enabled, c])] : enabled.filter(x => x !== c); save(); if (!enabled.includes(lang)) this.setLang(def); fire(); return true; },
    completion(c) { if (c === 'en') return 100; if (c !== 'es') return 0; const t = hit.size, m = missing.size; return t + m ? Math.round(t / (t + m) * 1000) / 10 : 100; },
    stats() { return { translated: Object.keys(dict).length + Object.keys(tmpl).length + Object.keys(custom).length, seen: hit.size, missing: missing.size }; },
    missing() { return [...missing.keys()]; },
    addTranslation(src, es) { if (!es) return; custom[src] = es; REV = null; missing.delete(src); save(); apply(); fire(); },
    importJSON(obj) { if (!obj || typeof obj !== 'object') return false; const flat = obj.es && typeof obj.es === 'object' ? obj.es : obj; Object.keys(flat).forEach(k => { if (typeof flat[k] === 'string') { custom[k] = flat[k]; missing.delete(k); } }); save(); apply(); fire(); return true; },
    catalog(code) { const out = {}; Object.keys(dict).forEach(k => out[k] = code === 'en' ? k : dict[k]); Object.keys(tmpl).forEach(k => out[k] = code === 'en' ? k : tmpl[k]); Object.keys(custom).forEach(k => out[k] = code === 'en' ? k : custom[k]); return out; },
    formats() { const loc = this.locale(), d = new Date(Date.UTC(2025, 3, 19, 14, 30));
      return { date: new Intl.DateTimeFormat(loc, { dateStyle: 'long', timeZone: 'UTC' }).format(d), time: new Intl.DateTimeFormat(loc, { timeStyle: 'short', timeZone: 'UTC' }).format(d),
        currency: new Intl.NumberFormat(loc, { style: 'currency', currency: 'USD' }).format(3042.39) + ' • ' + new Intl.NumberFormat(loc, { style: 'currency', currency: 'DOP' }).format(179865.5),
        number: new Intl.NumberFormat(loc).format(1284.75) }; },
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
