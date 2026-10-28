import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { calculateQuincena } from '../lib/periodService.js';
import { MySheets, MyHistory, EDITABLE, statusLabel, statusTone } from './MyTimesheets.jsx';
export { calculateQuincena };

// #myentry → daily activity log • #mysheets → my quincena timesheets • #myhistory → approval timeline
export default function MyTimeView(props) {
  if (props.tab === 'sheets') return <MySheets {...props} />;
  if (props.tab === 'history') return <MyHistory {...props} />;
  return <MyTimeEntry {...props} />;
}

export const WORK_TYPES = [
  { value: 'Desarrollo', label: 'Desarrollo / Implementación', tone: 'info', icon: 'code', color: '#0094CC', bg: '#EBF6FC' },
  { value: 'QA', label: 'Pruebas / QA', tone: 'warning', icon: 'bug_report', color: '#D97706', bg: '#FEF3C7' },
  { value: 'Reunión', label: 'Reunión técnica / Sync', tone: 'neutral', icon: 'groups', color: '#4B5563', bg: '#F3F4F6' },
  { value: 'Documentación', label: 'Documentación / Arquitectura', tone: 'success', icon: 'description', color: '#059669', bg: '#D1FAE5' },
  { value: 'Soporte', label: 'Soporte / Hotfix', tone: 'danger', icon: 'build', color: '#DC2626', bg: '#FEE2E2' },
];

function MyTimeEntry({ user, empId, notify, go }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button, IconButton, Badge, Card, StatCard, Icon } = DS;

  // Active employee ID & role
  const rbac = typeof window !== 'undefined' ? window.MGH_RBAC : null;
  const isSelf = rbac && (rbac.role === 'Employee' || rbac.role === 'Contractor');
  // No fallback to another employee: an unlinked account must not read or write someone else's activities
  const myEmpId = (user && (user.employee_id || user.employeeId)) || (rbac && rbac.me() ? rbac.me().emp : null) || null;
  const activeEmpId = isSelf ? myEmpId : (empId || myEmpId);
  const employeeName = (user && user.name) || (rbac && rbac.me() ? rbac.me().person : 'User');
  const employeeRole = (user && user.role) ? String(user.role).toUpperCase() : (rbac && rbac.role ? rbac.role.toUpperCase() : 'EMPLOYEE');

  // Current anchor date (defaults to today, or the quincena opened from "Mis hojas")
  const [currentDate, setCurrentDate] = useState(() => {
    try {
      const d = sessionStorage.getItem('mgh-myentry-date');
      sessionStorage.removeItem('mgh-myentry-date');
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); }
    } catch (_) {}
    return new Date();
  });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  // Jira issues from database
  const [jiraIssues, setJiraIssues] = useState([]);

  // Modal for registering a task
  const [modalOpen, setModalOpen] = useState(false);
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [jiraKey, setJiraKey] = useState('');
  const [customTicket, setCustomTicket] = useState('');
  const [jiraSummary, setJiraSummary] = useState('');
  const [workType, setWorkType] = useState('Desarrollo');
  const [hours, setHours] = useState('2.0');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // Filter by work type inside quincena
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate quincena metadata based on currentDate
  const quincena = useMemo(() => calculateQuincena(currentDate), [currentDate]);

  // Is viewing the current quincena for real today?
  const isViewingTodayQuincena = useMemo(() => {
    const todayQ = calculateQuincena(new Date());
    return todayQ.dateFrom === quincena.dateFrom && todayQ.dateTo === quincena.dateTo;
  }, [quincena]);

  // Load activities for the period from SQLite backend API
  const loadPeriodActivities = useCallback(async () => {
    if (!activeEmpId) { setActivities([]); return; }
    setLoading(true);
    try {
      if (window.api && window.api.activities) {
        const res = await window.api.activities({
          empId: activeEmpId,
          dateFrom: quincena.dateFrom,
          dateTo: quincena.dateTo,
        });
        setActivities(Array.isArray(res) ? res : []);
      }
    } catch (err) {
      console.warn('Could not load period activities:', err);
    } finally {
      setLoading(false);
    }
  }, [activeEmpId, quincena.dateFrom, quincena.dateTo]);

  // Initial and reactive load on quincena change
  useEffect(() => {
    loadPeriodActivities();
  }, [loadPeriodActivities]);

  // Status of this quincena's timesheet: activities are editable only by their owner while it is Draft/Returned
  const [sheetStatus, setSheetStatus] = useState(null);
  useEffect(() => {
    let cancel = false;
    setSheetStatus(null);
    if (!activeEmpId || !window.api || !window.api.timesheets) return;
    window.api.timesheets({ empId: activeEmpId, periodId: quincena.code })
      .then(list => { if (!cancel) setSheetStatus((Array.isArray(list) && list[0] && list[0].status) || 'Draft'); })
      .catch(() => { if (!cancel) setSheetStatus('Draft'); });
    return () => { cancel = true; };
  }, [activeEmpId, quincena.code]);
  const viewingOther = !!(activeEmpId && myEmpId && activeEmpId !== myEmpId);
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
  const readOnly = !activeEmpId || viewingOther || (sheetStatus != null && !EDITABLE.includes(sheetStatus));
  const lockReason = !activeEmpId ? 'Tu usuario no está vinculado a un empleado.'
    : viewingOther ? 'Estás viendo el registro de otra persona (solo lectura).'
    : sheetStatus && !EDITABLE.includes(sheetStatus) ? `Esta quincena está "${statusLabel(sheetStatus)}": ya no se puede editar. Si hay un error, pide al PM que te la devuelva.`
    : '';

  // Tasks of my projects (backend scopes the search to projects I'm a member of); mine first
  const [projectTasks, setProjectTasks] = useState([]);
  useEffect(() => {
    if (!window.api || !window.api.searchTasks) return;
    window.api.searchTasks({ limit: '200' })
      .then(r => { const l = Array.isArray(r) ? r : []; setProjectTasks(l.sort((a, b) => (b.assignee_id === myEmpId) - (a.assignee_id === myEmpId))); })
      .catch(() => {});
  }, [myEmpId]);

  // Load Jira issues from database cache
  useEffect(() => {
    async function loadJira() {
      if (window.api && window.api.jiraIssues) {
        try {
          const res = await window.api.jiraIssues();
          if (Array.isArray(res) && res.length > 0) {
            setJiraIssues(res);
          }
        } catch (_) {}
      }
    }
    loadJira();
  }, []);

  // Navigation handlers
  const prevQuincena = () => {
    const { year, month, isFirstHalf } = quincena;
    if (!isFirstHalf) {
      // Go to 1st half of current month
      setCurrentDate(new Date(year, month, 5));
    } else {
      // Go to 2nd half of previous month
      setCurrentDate(new Date(year, month - 1, 20));
    }
  };

  const nextQuincena = () => {
    const { year, month, isFirstHalf } = quincena;
    if (isFirstHalf) {
      // Go to 2nd half of current month
      setCurrentDate(new Date(year, month, 20));
    } else {
      // Go to 1st half of next month
      setCurrentDate(new Date(year, month + 1, 5));
    }
  };

  const goToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateJump = (e) => {
    const val = e.target.value;
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      setCurrentDate(new Date(y, m - 1, d));
    }
  };

  // Group activities by date
  const activitiesByDate = useMemo(() => {
    const map = {};
    for (const a of activities) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [activities]);

  // Filtered days & activities
  const periodStats = useMemo(() => {
    let totalHours = 0;
    let daysWithWork = 0;
    let businessDays = 0;
    const taskCount = activities.length;

    for (const day of quincena.days) {
      if (!day.isWeekend) businessDays++;
      const dayActs = activitiesByDate[day.dateStr] || [];
      const dayHrs = dayActs.reduce((acc, x) => acc + (Number(x.hours) || 0), 0);
      if (dayHrs > 0) {
        daysWithWork++;
        totalHours += dayHrs;
      }
    }

    const avgHours = daysWithWork > 0 ? (totalHours / daysWithWork).toFixed(1) : '0.0';
    const targetHours = (businessDays * 8).toFixed(1);

    return {
      totalHours: totalHours.toFixed(1),
      targetHours,
      daysWithWork,
      businessDays,
      taskCount,
      avgHours,
      percentComplete: Math.min(100, Math.round((totalHours / (businessDays * 8 || 80)) * 100)),
    };
  }, [activities, activitiesByDate, quincena.days]);

  // Open modal pre-filled for a date (today when it falls in the viewed quincena, else its first day)
  const openNewTaskModal = (dateStr) => {
    if (readOnly) { if (notify) notify(lockReason); return; }
    const today = new Date().toISOString().slice(0, 10);
    const target = dateStr || (today >= quincena.dateFrom && today <= quincena.dateTo ? today : quincena.dateFrom);
    setTaskDate(target);
    setJiraKey('');
    setCustomTicket('');
    setJiraSummary('');
    setWorkType('Desarrollo');
    setHours('2.5');
    setDescription('');
    setLinkUrl('');
    setAttendees([]);
    setAttendeeQuery('');
    setModalOpen(true);
  };

  // Save new task
  const handleSaveTask = async (e) => {
    if (e) e.preventDefault();
    const finalKey = jiraKey === 'CUSTOM' ? (customTicket.trim() || 'GENERAL') : (jiraKey || customTicket.trim() || 'GENERAL');
    const parsedHours = parseFloat(hours);
    if (!activeEmpId) {
      if (notify) notify('Tu usuario no tiene un empleado asociado; no se puede registrar la tarea');
      return;
    }

    if (isNaN(parsedHours) || parsedHours <= 0) {
      if (notify) notify('Ingrese una cantidad válida de horas (> 0)');
      return;
    }

    setSavingTask(true);
    try {
      const payload = {
        employeeId: activeEmpId,
        date: taskDate,
        hours: parsedHours,
        jiraKey: finalKey,
        jiraSummary: jiraSummary.trim() || description.slice(0, 50) || 'Registro de jornada',
        workType,
        description: description.trim() || 'Actividad registrada en jornada quincenal',
        links: linkUrl.trim() ? [{ label: 'Enlace de trabajo', url: linkUrl.trim() }] : [],
        ...(showAttendees && attendees.length ? { attendees: attendees.map(a => a.id) } : {}),
      };

      if (window.api && window.api.createActivity) {
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
      }

      setModalOpen(false);
      await loadPeriodActivities();
    } catch (err) {
      if (notify) notify('Error al guardar tarea: ' + err.message);
    } finally {
      setSavingTask(false);
    }
  };

  // Arriving from "Mis proyectos → Registrar horas": open the form with that task once the sheet status is known
  const pendingTask = React.useRef((() => { try { const k = sessionStorage.getItem('mgh-myentry-task'); sessionStorage.removeItem('mgh-myentry-task'); return k; } catch (_) { return null; } })());
  useEffect(() => {
    if (!pendingTask.current || sheetStatus == null) return;
    const k = pendingTask.current;
    pendingTask.current = null;
    if (readOnly) { if (notify) notify(lockReason); return; }
    openNewTaskModal();
    setJiraKey(k);
    const t = projectTasks.find(x => x.task_key === k);
    if (t) setJiraSummary(t.title);
  }, [sheetStatus, projectTasks.length]);

  // Delete activity
  const handleDeleteTask = async (id, taskName) => {
    if (readOnly) { if (notify) notify(lockReason); return; }
    if (!window.confirm(`¿Eliminar la tarea "${taskName || id}" de la base de datos?`)) return;
    try {
      if (window.api && window.api.deleteActivity) {
        await window.api.deleteActivity(id);
        if (notify) notify('Tarea eliminada de la base de datos');
        await loadPeriodActivities();
      }
    } catch (err) {
      if (notify) notify('Error al eliminar tarea: ' + err.message);
    }
  };

  // Filter activities for display
  const getFilteredActivities = (dayActs) => {
    return dayActs.filter(a => {
      if (typeFilter !== 'ALL' && a.workType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${a.jiraKey || ''} ${a.jiraSummary || ''} ${a.description || ''} ${a.workType || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* HEADER & QUINCENA CONTROLS */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '24px 28px',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--mgh-surface-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        {/* Breadcrumb & Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--mgh-ink-3)', fontWeight: '500' }}>
              <span>Workforce</span>
              <span>/</span>
              <span>Registro de Jornada</span>
              <span>/</span>
              <span style={{ color: 'var(--mgh-primary)', fontWeight: '600' }}>Mis Tareas y Quincena</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <h1 style={{ font: '800 26px/32px var(--font-sans)', color: 'var(--mgh-ink)', margin: 0, letterSpacing: '-0.5px' }}>
                Registro de Jornada por Tareas
              </h1>
              <Badge tone={isViewingTodayQuincena ? 'success' : 'warning'} dot={true} size="sm">
                {isViewingTodayQuincena ? 'Quincena Actual' : 'Historial de Quincena'}
              </Badge>
              {sheetStatus ? <Badge tone={statusTone(sheetStatus)} size="sm">{'Hoja: ' + statusLabel(sheetStatus)}</Badge> : null}
            </div>

            <p style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink-2)', margin: 0 }}>
              Visualización y registro de tareas correspondientes a la quincena.
            </p>
          </div>

          {/* Quick Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {go ? <Button variant="secondary" icon="calendar_view_week" size="md" onClick={() => go('mysheets')}>Mis hojas / Enviar</Button> : null}
            <Button
              variant="primary"
              icon="add_circle"
              size="md"
              disabled={readOnly}
              onClick={() => openNewTaskModal()}
            >
              + Registrar Tarea
            </Button>
          </div>
        </div>

        {lockReason ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: viewingOther ? 'var(--mgh-surface-1)' : 'var(--mgh-warning-bg)', font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>
            <Icon name={viewingOther ? 'visibility' : 'lock'} size={18} color={viewingOther ? 'var(--mgh-ink-3)' : 'var(--mgh-warning)'} />
            <span style={{ flex: 1 }}>{lockReason}</span>
            {!viewingOther && activeEmpId && go ? <Button size="sm" variant="ghost" onClick={() => go('mysheets')}>Ver mis hojas</Button> : null}
          </div>
        ) : null}

        {/* PERIOD SELECTOR & NAVIGATION BAR */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          padding: '14px 18px',
          background: 'var(--mgh-surface-1)',
          borderRadius: '12px',
          border: '1px solid var(--mgh-surface-2)'
        }}>
          {/* Quincena arrows & label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={prevQuincena}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--mgh-surface-2)',
                background: '#fff',
                color: 'var(--mgh-ink)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Quincena Anterior"
            >
              <Icon name="chevron_left" size={18} />
              Anterior
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: '#fff',
              borderRadius: '8px',
              border: '1px solid var(--mgh-primary-50)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <Icon name="calendar_month" size={18} color="var(--mgh-primary)" />
              <span style={{ font: '700 14px/20px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                {quincena.label}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--mgh-ink-3)', fontFamily: 'var(--font-mono)' }}>
                ({quincena.dateFrom} al {quincena.dateTo})
              </span>
            </div>

            <button
              onClick={nextQuincena}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--mgh-surface-2)',
                background: '#fff',
                color: 'var(--mgh-ink)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Quincena Siguiente"
            >
              Siguiente
              <Icon name="chevron_right" size={18} />
            </button>

            {!isViewingTodayQuincena && (
              <button
                onClick={goToday}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--mgh-primary)',
                  background: 'var(--mgh-primary-50)',
                  color: 'var(--mgh-primary)',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Volver a Hoy
              </button>
            )}
          </div>

          {/* Jump to exact date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--mgh-ink-3)', fontWeight: '500' }}>
              Ir a fecha:
            </span>
            <input
              type="date"
              value={currentDate.toISOString().slice(0, 10)}
              onChange={handleDateJump}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--mgh-surface-2)',
                background: '#fff',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--mgh-ink)',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
      </div>

      {/* REAL PERIOD KPIS FROM SQLITE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <StatCard
          label="Horas Registradas"
          value={periodStats.totalHours}
          unit="h"
          icon="schedule"
          tone="primary"
          footer={`Meta de quincena: ${periodStats.targetHours}h (${periodStats.percentComplete}%)`}
        />
        <StatCard
          label="Días con Jornada"
          value={`${periodStats.daysWithWork} / ${periodStats.businessDays}`}
          unit="días"
          icon="event_available"
          tone={periodStats.daysWithWork >= periodStats.businessDays * 0.7 ? 'success' : 'primary'}
          footer={`${periodStats.businessDays - periodStats.daysWithWork} días laborales pendientes`}
        />
        <StatCard
          label="Tareas Registradas"
          value={periodStats.taskCount}
          unit="tareas"
          icon="task_alt"
          tone="info"
          footer={`En ${quincena.label}`}
        />
        <StatCard
          label="Promedio por Día"
          value={periodStats.avgHours}
          unit="h/día"
          icon="speed"
          tone={Number(periodStats.avgHours) >= 7.5 ? 'success' : 'warning'}
          footer="Jornada estándar: 8.0h / día"
        />
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '12px 18px',
        boxShadow: 'var(--shadow-xs)',
        border: '1px solid var(--mgh-surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-3)', letterSpacing: '0.5px' }}>
            Filtrar tipo:
          </span>
          <button
            onClick={() => setTypeFilter('ALL')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: typeFilter === 'ALL' ? '1px solid var(--mgh-primary)' : '1px solid var(--mgh-surface-2)',
              background: typeFilter === 'ALL' ? 'var(--mgh-primary-50)' : '#fff',
              color: typeFilter === 'ALL' ? 'var(--mgh-primary)' : 'var(--mgh-ink-2)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Todos ({activities.length})
          </button>
          {WORK_TYPES.map(wt => {
            const count = activities.filter(a => a.workType === wt.value).length;
            const active = typeFilter === wt.value;
            return (
              <button
                key={wt.value}
                onClick={() => setTypeFilter(wt.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: active ? `1px solid ${wt.color}` : '1px solid var(--mgh-surface-2)',
                  background: active ? wt.bg : '#fff',
                  color: active ? wt.color : 'var(--mgh-ink-2)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {wt.label.split(' / ')[0]} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            placeholder="Buscar por ticket o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--mgh-surface-2)',
              background: 'var(--mgh-surface-1)',
              fontSize: '12px',
              color: 'var(--mgh-ink)',
              minWidth: '220px'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mgh-ink-3)', fontSize: '12px' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* MAIN TABLE: DAYS & TASKS */}
      <Card padding={0}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--mgh-surface-2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--mgh-surface-1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon name="view_timeline" size={20} color="var(--mgh-primary)" />
            <span style={{ font: '700 15px/22px var(--font-sans)', color: 'var(--mgh-ink)' }}>
              Detalle Diario de Jornada • {quincena.label}
            </span>
          </div>
          <span style={{ font: '600 12px/16px var(--font-mono)', color: 'var(--mgh-ink-3)' }}>
            Colaborador: {employeeName} ({activeEmpId})
          </span>
        </div>

        <div className="mgh-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--mgh-surface-1)', borderBottom: '1px solid var(--mgh-surface-2)' }}>
                <th style={{ width: '180px', textAlign: 'left', padding: '12px 16px', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-3)', letterSpacing: '0.5px' }}>
                  Fecha y Día
                </th>
                <th style={{ textAlign: 'left', padding: '12px 16px', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-3)', letterSpacing: '0.5px' }}>
                  Tareas y Entregables de la Jornada
                </th>
                <th style={{ width: '120px', textAlign: 'right', padding: '12px 16px', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-3)', letterSpacing: '0.5px' }}>
                  Total Horas
                </th>
                <th style={{ width: '140px', textAlign: 'center', padding: '12px 16px', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-3)', letterSpacing: '0.5px' }}>
                  Estado
                </th>
                <th style={{ width: '130px', textAlign: 'center', padding: '12px 16px', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-3)', letterSpacing: '0.5px' }}>
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {quincena.days.map((day) => {
                const dayActs = activitiesByDate[day.dateStr] || [];
                const filteredActs = getFilteredActivities(dayActs);
                const dayTotal = dayActs.reduce((acc, a) => acc + (Number(a.hours) || 0), 0);

                // Row background style
                let rowBg = '#fff';
                if (day.isToday) rowBg = 'rgba(0, 148, 204, 0.04)';
                else if (day.isWeekend) rowBg = 'var(--mgh-surface-1)';

                // Day status calculation
                let statusBadge = null;
                if (day.isWeekend && dayTotal === 0) {
                  statusBadge = <Badge tone="neutral" size="sm">Fin de semana</Badge>;
                } else if (dayTotal >= 8) {
                  statusBadge = <Badge tone="success" dot={true} size="sm">Jornada completa</Badge>;
                } else if (dayTotal > 0) {
                  statusBadge = <Badge tone="warning" dot={true} size="sm">Parcial ({dayTotal}h)</Badge>;
                } else if (day.isToday) {
                  statusBadge = <Badge tone="info" dot={true} size="sm">En curso</Badge>;
                } else {
                  statusBadge = <Badge tone="neutral" size="sm">Sin registrar</Badge>;
                }

                return (
                  <tr
                    key={day.dateStr}
                    style={{
                      background: rowBg,
                      borderBottom: '1px solid var(--mgh-surface-2)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Date Column */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            font: '700 14px/20px var(--font-sans)',
                            color: day.isToday ? 'var(--mgh-primary)' : 'var(--mgh-ink)'
                          }}>
                            {day.dowFull}, {day.dayNum} {quincena.monthName.slice(0, 3)}
                          </span>
                          {day.isToday && (
                            <span style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'var(--mgh-primary)',
                              color: '#fff',
                              fontSize: '10px',
                              fontWeight: '800',
                              letterSpacing: '0.4px',
                              textTransform: 'uppercase'
                            }}>
                              Hoy
                            </span>
                          )}
                        </div>
                        <span style={{ font: '500 11px/14px var(--font-mono)', color: 'var(--mgh-ink-3)' }}>
                          {day.dateStr}
                        </span>
                      </div>
                    </td>

                    {/* Tasks Column */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      {filteredActs.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                          <span style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink-3)', fontStyle: 'italic' }}>
                            {day.isWeekend ? 'Descanso semanal' : 'Sin tareas registradas para esta jornada'}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {filteredActs.map((act) => {
                            const wtInfo = WORK_TYPES.find(w => w.value === act.workType) || WORK_TYPES[0];
                            return (
                              <div
                                key={act.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: '#fff',
                                  border: '1px solid var(--mgh-surface-2)',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                  gap: '12px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                  {/* Jira Ticket Badge */}
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: '#1F2937',
                                    color: '#F9FAFB',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    letterSpacing: '0.3px',
                                    flexShrink: 0
                                  }}>
                                    {act.jiraKey || 'GENERAL'}
                                  </span>

                                  {/* Work Type Pill */}
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: wtInfo.bg,
                                    color: wtInfo.color,
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    flexShrink: 0
                                  }}>
                                    {wtInfo.label.split(' / ')[0]}
                                  </span>

                                  {/* Description */}
                                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                    <span style={{
                                      font: '600 13px/18px var(--font-sans)',
                                      color: 'var(--mgh-ink)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {act.jiraSummary || act.description || 'Actividad registrada'}
                                    </span>
                                    {act.description && act.jiraSummary && (
                                      <span style={{
                                        font: '400 11px/15px var(--font-sans)',
                                        color: 'var(--mgh-ink-3)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {act.description}
                                      </span>
                                    )}
                                    {act.reviewStatus && (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', font: '500 11px/15px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>
                                        <Badge size="sm" tone={act.reviewStatus === 'approved' ? 'success' : act.reviewStatus === 'partial' ? 'warning' : 'danger'}>
                                          {act.reviewStatus === 'approved' ? 'Aprobada' : act.reviewStatus === 'partial' ? `Aprobadas ${act.approvedHours}h de ${act.hours}h` : 'Horas rechazadas'}
                                        </Badge>
                                        {act.reviewComment ? `“${act.reviewComment}”${act.reviewedBy ? ' — ' + act.reviewedBy : ''}` : null}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Hours & Delete */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                  <span style={{
                                    font: '700 13px/18px var(--font-mono)',
                                    color: 'var(--mgh-primary)',
                                    background: 'var(--mgh-primary-50)',
                                    padding: '3px 8px',
                                    borderRadius: '6px'
                                  }}>
                                    {Number(act.hours).toFixed(1)}h
                                  </span>

                                  <button
                                    disabled={readOnly}
                                    onClick={() => handleDeleteTask(act.id, act.jiraSummary || act.jiraKey)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--mgh-ink-3)',
                                      cursor: readOnly ? 'not-allowed' : 'pointer',
                          opacity: readOnly ? 0.35 : 1,
                                      padding: '4px',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                    title="Eliminar tarea de base de datos"
                                  >
                                    <Icon name="delete" size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Total Hours Column */}
                    <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <span style={{
                          font: '800 16px/22px var(--font-sans)',
                          color: dayTotal >= 8 ? 'var(--mgh-success)' : (dayTotal > 0 ? 'var(--mgh-warning)' : 'var(--mgh-ink-3)'),
                          fontVariantNumeric: 'tabular-nums'
                        }}>
                          {dayTotal > 0 ? `${dayTotal.toFixed(1)}h` : '—'}
                        </span>
                        {dayTotal > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--mgh-ink-3)' }}>
                            de 8.0h meta
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Column */}
                    <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'top' }}>
                      {statusBadge}
                    </td>

                    {/* Action Column */}
                    <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'top' }}>
                      <button
                        disabled={readOnly}
                                    onClick={() => openNewTaskModal(day.dateStr)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--mgh-surface-2)',
                          background: day.isToday ? 'var(--mgh-primary-50)' : '#fff',
                          color: day.isToday ? 'var(--mgh-primary)' : 'var(--mgh-ink-2)',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: readOnly ? 'not-allowed' : 'pointer',
                          opacity: readOnly ? 0.35 : 1,
                          transition: 'all 0.15s ease'
                        }}
                        title={`Registrar tarea para el ${day.dateStr}`}
                      >
                        <Icon name="add" size={14} />
                        Tarea
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Quincena Total Footer */}
        <div style={{
          padding: '16px 20px',
          background: 'var(--mgh-surface-1)',
          borderTop: '1px solid var(--mgh-surface-2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <span style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>
            Total Quincena ({quincena.label}):{' '}
            <strong style={{ color: 'var(--mgh-ink)', fontSize: '15px' }}>
              {periodStats.totalHours} horas
            </strong>{' '}
            en {periodStats.taskCount} tareas registradas
          </span>

          <span style={{ font: '700 11px/14px var(--font-mono)', color: 'var(--mgh-ink-3)' }}>
            Registro por actividades • daily_activities
          </span>
        </div>
      </Card>

      {/* MODAL: REGISTRAR TAREA EN BASE DE DATOS */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '560px',
              maxWidth: '100%',
              background: '#fff',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ font: '700 18px/24px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                  Registrar Tarea de Jornada
                </span>
                <span style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>
                  Se guardará directamente en la base de datos para la quincena activa.
                </span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mgh-ink-3)' }}
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Fecha y Horas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                    Fecha de la Jornada
                  </label>
                  <input
                    type="date"
                    required
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--mgh-surface-2)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--mgh-ink)'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                    Horas Dedicadas
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="16"
                      required
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--mgh-surface-2)',
                        fontSize: '13px',
                        fontWeight: '700',
                        color: 'var(--mgh-ink)',
                        width: '90px'
                      }}
                    />
                    {['1h', '2h', '4h', '8h'].map(h => (
                      <button
                        type="button"
                        key={h}
                        onClick={() => setHours(h.replace('h', '.0'))}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--mgh-surface-2)',
                          background: 'var(--mgh-surface-1)',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: 'var(--mgh-ink-2)',
                          cursor: 'pointer'
                        }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Jira Issue Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                  Ticket Jira o Tarea del Proyecto
                </label>
                <select
                  value={jiraKey}
                  onChange={(e) => {
                    const k = e.target.value;
                    setJiraKey(k);
                    const found = projectTasks.find(t => t.task_key === k) || jiraIssues.find(i => i.key === k);
                    if (found) setJiraSummary(found.title || found.summary);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--mgh-surface-2)',
                    fontSize: '13px',
                    color: 'var(--mgh-ink)',
                    background: '#fff'
                  }}
                >
                  <option value="">Seleccionar tarea (o ingresar referencia)...</option>
                  {projectTasks.length ? <optgroup label="Mis proyectos">
                    {projectTasks.map(t => (
                      <option key={t.id} value={t.task_key}>
                        {t.task_key} • {String(t.title || '').slice(0, 50)}{t.assignee_id === myEmpId ? ' (asignada a ti)' : ''}
                      </option>
                    ))}
                  </optgroup> : null}
                  {jiraIssues.length ? <optgroup label="Jira">
                    {jiraIssues.filter(i => !projectTasks.some(t => t.task_key === i.key)).map(i => (
                      <option key={i.key} value={i.key}>
                        {i.key} • {String(i.summary || '').slice(0, 50)}
                      </option>
                    ))}
                  </optgroup> : null}
                  <option value="CUSTOM">+ Ingresar ticket o referencia manual...</option>
                </select>

                {jiraKey === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="Ej. MSH-300 o TAREA-SPRINT"
                    value={customTicket}
                    onChange={(e) => setCustomTicket(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--mgh-surface-2)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--mgh-ink)',
                      marginTop: '4px'
                    }}
                  />
                )}
              </div>

              {/* Tipo de Trabajo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                  Tipo de Actividad
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {WORK_TYPES.map(wt => (
                    <button
                      type="button"
                      key={wt.value}
                      onClick={() => setWorkType(wt.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: workType === wt.value ? `2px solid ${wt.color}` : '1px solid var(--mgh-surface-2)',
                        background: workType === wt.value ? wt.bg : '#fff',
                        color: workType === wt.value ? wt.color : 'var(--mgh-ink-2)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {wt.label.split(' / ')[0]}
                    </button>
                  ))}
                </div>
              </div>

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

              {/* Resumen / Título */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                  Título / Resumen del Entregable
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Implementación del módulo de registro por actividades"
                  value={jiraSummary}
                  onChange={(e) => setJiraSummary(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--mgh-surface-2)',
                    fontSize: '13px',
                    color: 'var(--mgh-ink)'
                  }}
                />
              </div>

              {/* Descripción detallada */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                  Detalle del Trabajo Realizado
                </label>
                <textarea
                  rows={3}
                  placeholder="Explique las tareas, avances, entregables o PRs asociados..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--mgh-surface-2)',
                    fontSize: '13px',
                    color: 'var(--mgh-ink)',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Enlace opcional */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                  Enlace de Evidencia (GitHub PR, Loom, Jira, etc.) • Opcional
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/.../pull/..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--mgh-surface-2)',
                    fontSize: '13px',
                    color: 'var(--mgh-ink)'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--mgh-surface-2)',
                    background: '#fff',
                    color: 'var(--mgh-ink-2)',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--mgh-primary)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {savingTask ? 'Guardando...' : 'Guardar en Base de Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
