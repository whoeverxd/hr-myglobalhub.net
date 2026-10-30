import React, { useState, useEffect, useMemo, useRef } from 'react';
import { statusLabel } from './MyTimesheets.jsx';

// The one form to log or edit a daily activity, shared by #myentry (MyTimeView) and #actDaily (DailyActivities).
// Writes go through POST /activities (new, optionally with meeting attendees) or PUT /activities/:id (edit in place).

export const WORK_TYPES = [
  { value: 'Desarrollo', label: 'Desarrollo / Implementación', tone: 'info', icon: 'code', color: '#0094CC', bg: '#EBF6FC' },
  { value: 'QA', label: 'Pruebas / QA', tone: 'warning', icon: 'bug_report', color: '#D97706', bg: '#FEF3C7' },
  { value: 'Reunión', label: 'Reunión técnica / Sync', tone: 'neutral', icon: 'groups', color: '#4B5563', bg: '#F3F4F6' },
  { value: 'Documentación', label: 'Documentación / Arquitectura', tone: 'success', icon: 'description', color: '#059669', bg: '#D1FAE5' },
  { value: 'Soporte', label: 'Soporte / Hotfix', tone: 'danger', icon: 'build', color: '#DC2626', bg: '#FEE2E2' },
];

// A copy created on an attendee's sheet by the meeting organizer: it can be deleted, never edited
export const isMeetingCopy = (act) => !!(act && act.loggedBy && act.loggedBy !== act.empId);

const MEETING_ORGANIZER_ROLES = ['pm', 'supervisor', 'admin'];

// Durations are stored as decimal hours (2.25) but shown and typed as hours + minutes ("2h 15m"):
// "2.15" used to read as 2h 15m while it means 2h 09m.
export function fmtDuration(hours) {
  const total = Math.round((Number(hours) || 0) * 60);
  const h = Math.floor(total / 60), m = total % 60;
  return h && m ? `${h}h ${m}m` : m ? `${m}m` : `${h}h`;
}
const splitHours = (hours) => { const total = Math.round((Number(hours) || 0) * 60); return [String(Math.floor(total / 60)), String(total % 60)]; };
const MINUTE_OPTIONS = ['0', '15', '30', '45'];
const PRESETS = [0.5, 1, 2, 4, 8];

const CSS = `
.mgh-actmodal-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}
.mgh-actmodal{width:640px;max-width:100%;max-height:calc(100vh - 40px);background:#fff;border-radius:16px;box-shadow:var(--shadow-xl);display:flex;flex-direction:column;overflow:hidden}
.mgh-actmodal-body{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:18px}
.mgh-actmodal-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.mgh-actmodal-label{display:block;font:600 12px/16px var(--font-sans);color:var(--mgh-ink);margin-bottom:6px}
.mgh-actmodal-input{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:8px;border:1px solid var(--mgh-surface-3,#D5DAE6);font:500 13px/18px var(--font-sans);color:var(--mgh-ink);background:#fff;outline:none}
.mgh-actmodal-input:focus{border-color:var(--mgh-primary)}
.mgh-actmodal-unit{font:600 13px/18px var(--font-sans);color:var(--mgh-ink-3)}
.mgh-actmodal-chip{padding:5px 10px;border-radius:8px;border:1px solid var(--mgh-surface-2);background:var(--mgh-surface-1);font:600 12px/16px var(--font-sans);color:var(--mgh-ink-2);cursor:pointer}
@media (max-width:640px){
  .mgh-actmodal-overlay{padding:0}
  .mgh-actmodal{width:100%;height:100%;max-height:none;border-radius:0}
  .mgh-actmodal-grid{grid-template-columns:1fr}
}`;

const todayLocal = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/**
 * Props: empId (whose sheet), date (default day), activity (edit mode), initialTask ({key, summary}),
 * notify, onClose, onSaved(savedActivity).
 */
export default function ActivityFormModal({ empId, date, activity, initialTask, notify, onClose, onSaved }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button, IconButton, Badge, Icon } = DS;
  const rbac = window.MGH_RBAC;
  const editing = !!activity;
  const myEmpId = (rbac && rbac.user && (rbac.user.employeeId || rbac.user.employee_id)) || (rbac && rbac.me() ? rbac.me().emp : null) || null;
  const roleKey = String((rbac && rbac.user && rbac.user.role) || '').toLowerCase();
  const canAddAttendees = !editing && empId === myEmpId && MEETING_ORGANIZER_ROLES.includes(roleKey);

  const [taskDate, setTaskDate] = useState((activity && activity.date) || date || todayLocal());
  const [task, setTask] = useState(() => activity
    ? { key: activity.jiraKey, summary: activity.jiraSummary }
    : initialTask && initialTask.key ? initialTask : null);
  const [taskQuery, setTaskQuery] = useState('');
  const [title, setTitle] = useState((activity && activity.jiraSummary) || (initialTask && initialTask.summary) || '');
  const [workType, setWorkType] = useState((activity && activity.workType) || 'Desarrollo');
  const [[hrs, mins], setDuration] = useState(() => (activity ? splitHours(activity.hours) : ['2', '0']));
  const setHrs = (v) => setDuration(([, m]) => [v, m]);
  const setMins = (v) => setDuration(([h]) => [h, v]);
  const hours = Math.round(((Number(hrs) || 0) + (Number(mins) || 0) / 60) * 10000) / 10000;
  const [description, setDescription] = useState((activity && activity.description) || '');
  const [files, setFiles] = useState((activity && activity.files) || []);
  const [links, setLinks] = useState((activity && activity.links) || []);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [uploading, setUploading] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  // A click landing outside the dialog, or Escape, used to close it and throw away everything typed. Both now
  // go through requestClose: nothing changed since it opened -> close; something changed -> ask first.
  const formState = JSON.stringify({
    taskDate, taskKey: task ? task.key : null, title, workType, hours, description,
    files: files.map(f => f.url || f.id || f.name), links, linkUrl, linkLabel,
    attendees: attendees.map(a => a.id),
  });
  const asOpened = useRef(null);
  if (asOpened.current === null) asOpened.current = formState;
  const dirty = formState !== asOpened.current;
  const requestClose = () => {
    if (dirty && !window.confirm('Tienes cambios sin guardar en esta actividad. ¿Descartarlos?')) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, onClose]);

  // Tasks of my projects (membership-scoped by the backend; assigned to me first) + the Jira cache.
  // The search runs on the SERVER: what the browser holds is one page of the newest tasks, so filtering
  // that page found nothing outside it -- type the key of an older ticket and it simply did not exist.
  const PAGE = '50';
  const [projectTasks, setProjectTasks] = useState([]);
  const [jiraIssues, setJiraIssues] = useState([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!window.api) return;
    const q = taskQuery.trim();
    const params = q ? { query: q, limit: PAGE } : { limit: PAGE };
    let cancelled = false;
    setSearching(true);
    // Typing is debounced; the first, empty load is not
    const timer = setTimeout(() => {
      Promise.all([
        window.api.searchTasks ? window.api.searchTasks(params).catch(() => []) : Promise.resolve([]),
        window.api.jiraIssues ? window.api.jiraIssues(params).catch(() => []) : Promise.resolve([]),
      ]).then(([t, j]) => {
        if (cancelled) return;
        const list = Array.isArray(t) ? t : [];
        setProjectTasks(list.sort((a, b) => (b.assignee_id === empId) - (a.assignee_id === empId)));
        setJiraIssues(Array.isArray(j) ? j : []);
        setSearching(false);
      });
    }, q ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [empId, taskQuery]);
  const taskOptions = useMemo(() => ([
    ...projectTasks.map(t => ({ key: t.task_key, summary: t.title, project: t.project_name || t.project_key, native: true, mine: t.assignee_id === empId, status: t.status_name })),
    ...jiraIssues.filter(i => !projectTasks.some(t => t.task_key === i.key || t.origin_jira_key === i.key)).map(i => ({ key: i.key, summary: i.summary, project: i.project, native: false, status: i.status })),
  ]), [projectTasks, jiraIssues, empId]);
  // Opened with only a task key (from "Mis proyectos → Registrar horas"): take its title once the tasks load
  useEffect(() => {
    if (!task || task.summary) return;
    const t = projectTasks.find(x => x.task_key === task.key);
    // Filling the title from the task is not the user typing: re-baseline, or closing an untouched form would ask
    if (t) { setTask({ ...task, summary: t.title }); setTitle(prev => prev || t.title); asOpened.current = null; }
  }, [projectTasks]);
  const pickTask = (t) => { setTask(t); setTaskQuery(''); if (t.summary) setTitle(t.summary); };

  // Active staff for meeting attendees
  const [staff, setStaff] = useState([]);
  useEffect(() => {
    if (!canAddAttendees || !window.api || !window.api.employees) return;
    window.api.employees()
      .then(list => setStaff((Array.isArray(list) ? list : []).filter(e => !['Terminated', 'Inactive'].includes(e.status))))
      .catch(() => {});
  }, [canAddAttendees]);
  const showAttendees = canAddAttendees && workType === 'Reunión';
  const attendeeMatches = useMemo(() => {
    const q = attendeeQuery.trim().toLowerCase();
    if (!q) return [];
    return staff.filter(e => e.id !== empId && !attendees.some(a => a.id === e.id) && `${e.name} ${e.id}`.toLowerCase().includes(q)).slice(0, 8);
  }, [staff, attendees, attendeeQuery, empId]);
  const addAttendee = (e) => { setAttendees(prev => [...prev, { id: e.id, name: e.name }]); setAttendeeQuery(''); };

  // Evidence: uploaded to the backend; a failed upload is reported and left out (never a browser-only URL)
  const processFiles = (fileList) => {
    Array.from(fileList).forEach(file => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);
      const reader = new FileReader();
      setUploading(n => n + 1);
      reader.onload = async (event) => {
        try {
          const uploaded = await window.api.uploadFile({
            filename: file.name,
            dataBase64: event.target.result,
            mimeType: file.type || (isVideo ? 'video/mp4' : 'image/png'),
            category: 'evidences',
          });
          if (!uploaded || !uploaded.url) throw new Error('sin URL');
          setFiles(prev => [...prev, { id: uploaded.id, name: file.name, size: (file.size / (1024 * 1024)).toFixed(1) + ' MB', type: isVideo ? 'video' : 'image', url: uploaded.url }]);
        } catch (err) {
          if (notify) notify(`No se pudo subir ${file.name}: ${err.message}`);
        } finally {
          setUploading(n => n - 1);
        }
      };
      reader.onerror = () => { setUploading(n => n - 1); if (notify) notify(`No se pudo leer ${file.name}`); };
      reader.readAsDataURL(file);
    });
  };
  const onDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  };
  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { if (notify) notify('El enlace debe empezar por http:// o https://'); return; }
    setLinks(prev => [...prev, { label: linkLabel.trim() || url, url }]);
    setLinkUrl(''); setLinkLabel('');
  };

  const save = async (e) => {
    if (e) e.preventDefault();
    if (!empId || !window.api) { if (notify) notify('Tu usuario no tiene un empleado asociado; no se puede registrar la actividad'); return; }
    const parsedHours = hours;
    if (!/^\d{0,2}$/.test(String(hrs).trim()) || parsedHours <= 0 || parsedHours > 24) { if (notify) notify('Indica cuánto tiempo dedicaste: entre 15 minutos y 24 horas'); return; }
    if (!description.trim()) { if (notify) notify('Describe el trabajo realizado'); return; }
    if (uploading) { if (notify) notify('Espera a que terminen de subir las evidencias'); return; }
    // A link typed but not added with "+ Agregar" is still saved
    const allLinks = linkUrl.trim() && /^https?:\/\//i.test(linkUrl.trim()) ? [...links, { label: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim() }] : links;
    const key = task ? task.key : 'GENERAL';
    const payload = {
      employeeId: empId,
      empId,
      date: taskDate,
      jiraKey: key,
      jiraSummary: title.trim() || (task && task.summary) || description.trim().slice(0, 50),
      hours: parsedHours,
      workType,
      description: description.trim(),
      files,
      links: allLinks,
      ...(showAttendees && attendees.length ? { attendees: attendees.map(a => a.id) } : {}),
    };
    setSaving(true);
    try {
      const saved = editing ? await window.api.updateActivity(activity.id, payload) : await window.api.createActivity(payload);
      if (notify) {
        const m = saved && saved.meeting;
        if (m) {
          const skipped = m.skipped.length ? ` No se agregó a ${m.skipped.map(s => `${s.name} (hoja ${s.periodId} ${statusLabel(s.status)})`).join(', ')}.` : '';
          notify(`Reunión registrada para ti y ${m.created.length} asistente${m.created.length === 1 ? '' : 's'}.${skipped}`);
        } else {
          notify(editing ? `Actividad ${key} actualizada (${fmtDuration(parsedHours)})` : `Actividad ${key} registrada para el ${taskDate} (+${fmtDuration(parsedHours)})`);
        }
      }
      onSaved && onSaved(saved);
      onClose();
    } catch (err) {
      if (notify) notify(`No se pudo guardar la actividad: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const q = taskQuery.trim();
  return (
    <div className="mgh-actmodal-overlay" onClick={requestClose}>
      <style>{CSS}</style>
      <div className="mgh-actmodal" role="dialog" aria-modal="true" aria-labelledby="mgh-actmodal-title" onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--mgh-surface-2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div id="mgh-actmodal-title" style={{ font: '700 18px/24px var(--font-sans)', color: 'var(--mgh-ink)' }}>
              {editing ? 'Editar actividad' : 'Registrar actividad'}
            </div>
            <div style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)', marginTop: 2 }}>
              Las horas cuentan en tu hoja de la quincena mientras esté en borrador o devuelta.
            </div>
          </div>
          <IconButton icon="close" title="Cerrar" onClick={requestClose} />
        </div>

        <form onSubmit={save} className="mgh-actmodal-body">
          {/* Fecha y horas */}
          <div className="mgh-actmodal-grid">
            <div>
              <label className="mgh-actmodal-label" htmlFor="act-date">Fecha</label>
              <input id="act-date" className="mgh-actmodal-input" type="date" required value={taskDate} onChange={e => setTaskDate(e.target.value)} />
            </div>
            <div>
              <label className="mgh-actmodal-label" htmlFor="act-hours">Tiempo dedicado</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input id="act-hours" aria-label="Horas" className="mgh-actmodal-input" style={{ width: 64, fontWeight: 700, textAlign: 'right' }} type="number" inputMode="numeric" step="1" min="0" max="24" value={hrs}
                  onChange={e => setHrs(e.target.value.replace(/\D/g, '').slice(0, 2))} />
                <span className="mgh-actmodal-unit">h</span>
                <select id="act-mins" aria-label="Minutos" className="mgh-actmodal-input" style={{ width: 72, fontWeight: 700 }} value={mins} onChange={e => setMins(e.target.value)}>
                  {(MINUTE_OPTIONS.includes(mins) ? MINUTE_OPTIONS : [...MINUTE_OPTIONS, mins].sort((a, b) => a - b)).map(m => <option key={m} value={m}>{m.padStart(2, '0')}</option>)}
                </select>
                <span className="mgh-actmodal-unit">min</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {PRESETS.map(p => (
                  <button key={p} type="button" className="mgh-actmodal-chip" onClick={() => setDuration(splitHours(p))}
                    style={hours === p ? { background: 'var(--mgh-navy)', color: '#fff', borderColor: 'var(--mgh-navy)' } : undefined}>
                    {fmtDuration(p)}
                  </button>
                ))}
              </div>
              {hours > 24 ? <div style={{ marginTop: 6, font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-danger)' }}>Máximo 24 horas por actividad.</div> : null}
            </div>
          </div>

          {/* Tarea */}
          <div>
            <label className="mgh-actmodal-label" htmlFor="act-task">Tarea del proyecto o ticket</label>
            {task ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--mgh-primary-50, #EEF1FA)', border: '1px solid var(--mgh-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ font: '700 13px/16px var(--font-mono)', color: 'var(--mgh-primary)', flexShrink: 0 }}>{task.key}</span>
                  <span style={{ font: '500 13px/16px var(--font-sans)', color: 'var(--mgh-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.summary}</span>
                </div>
                <Button size="xs" variant="ghost" onClick={() => setTask(null)}>Cambiar</Button>
              </div>
            ) : (
              <>
                <input id="act-task" className="mgh-actmodal-input" type="text" placeholder="Buscar por clave o título (vacío = trabajo general)" value={taskQuery}
                  onChange={e => setTaskQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (taskOptions[0]) pickTask(taskOptions[0]); } }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 170, overflowY: 'auto', marginTop: 6 }}>
                  {taskOptions.map(o => (
                    <button key={o.key} type="button" onClick={() => pickTask(o)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: 'none', background: 'var(--mgh-surface-1)', cursor: 'pointer', textAlign: 'left', font: '500 12px/16px var(--font-sans)' }}>
                      <Badge tone={o.native ? 'success' : 'neutral'} size="sm">{o.native ? 'Proyecto' : 'Jira'}</Badge>
                      <span style={{ fontWeight: 700, color: 'var(--mgh-primary)', flexShrink: 0 }}>{o.key}</span>
                      <span style={{ color: 'var(--mgh-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{o.summary}</span>
                      {o.mine ? <span style={{ fontSize: 11, color: 'var(--mgh-ink-3)', flexShrink: 0 }}>asignada a ti</span> : null}
                    </button>
                  ))}
                  {searching && !taskOptions.length ? (
                    <div style={{ padding: '6px 10px', font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>Buscando…</div>
                  ) : !searching && !taskOptions.length ? (
                    <div style={{ padding: '6px 10px', font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>
                      {q ? `Ninguna tarea coincide con "${q}".` : 'Todavía no hay tareas en tus proyectos.'}
                    </div>
                  ) : null}
                  {q && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(q) && !taskOptions.some(o => o.key.toLowerCase() === q.toLowerCase()) && (
                    <button type="button" onClick={() => pickTask({ key: q.toUpperCase(), summary: title })}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px dashed var(--mgh-surface-3)', background: '#fff', cursor: 'pointer', textAlign: 'left', font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>
                      Usar la referencia manual {q.toUpperCase()}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Tipo de trabajo */}
          <div>
            <span className="mgh-actmodal-label">Tipo de actividad</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WORK_TYPES.map(wt => (
                <button key={wt.value} type="button" onClick={() => setWorkType(wt.value)} aria-pressed={workType === wt.value}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', font: '600 12px/16px var(--font-sans)',
                    border: workType === wt.value ? `2px solid ${wt.color}` : '1px solid var(--mgh-surface-2)',
                    background: workType === wt.value ? wt.bg : '#fff', color: workType === wt.value ? wt.color : 'var(--mgh-ink-2)' }}>
                  <Icon name={wt.icon} size={16} /> {wt.label.split(' / ')[0]}
                </button>
              ))}
            </div>
          </div>

          {showAttendees && (
            <div>
              <label className="mgh-actmodal-label" htmlFor="act-attendees">Asistentes • la reunión se registrará también en sus hojas</label>
              {attendees.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {attendees.map(a => (
                    <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 10px', borderRadius: 999, background: 'var(--mgh-surface-1, #EEF1FA)', color: 'var(--mgh-ink)', fontSize: 12, fontWeight: 600 }}>
                      {a.name}
                      <button type="button" aria-label={`Quitar a ${a.name}`} onClick={() => setAttendees(attendees.filter(x => x.id !== a.id))}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'var(--mgh-ink-3)' }}>
                        <Icon name="close" size={16} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input id="act-attendees" className="mgh-actmodal-input" type="text" placeholder="Buscar empleado por nombre..." value={attendeeQuery}
                onChange={e => setAttendeeQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (attendeeMatches[0]) addAttendee(attendeeMatches[0]); } }} />
              {attendeeMatches.length > 0 && (
                <div style={{ border: '1px solid var(--mgh-surface-2)', borderRadius: 8, maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
                  {attendeeMatches.map(e => (
                    <button key={e.id} type="button" onClick={() => addAttendee(e)}
                      style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--mgh-ink)', textAlign: 'left' }}>
                      <span>{e.name}</span>
                      <span style={{ color: 'var(--mgh-ink-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{e.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Título y detalle */}
          <div>
            <label className="mgh-actmodal-label" htmlFor="act-title">Título del entregable</label>
            <input id="act-title" className="mgh-actmodal-input" type="text" placeholder="Ej. Módulo de registro por actividades" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mgh-actmodal-label" htmlFor="act-desc">Detalle del trabajo realizado *</label>
            <textarea id="act-desc" className="mgh-actmodal-input" rows={4} style={{ resize: 'vertical' }} required
              placeholder="Qué hiciste, avances, decisiones, PRs o resultados de pruebas..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Evidencias */}
          <div>
            <span className="mgh-actmodal-label">Evidencias (imágenes y videos) • opcional</span>
            <div onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
              onClick={() => fileInput.current && fileInput.current.click()}
              role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current && fileInput.current.click(); } }}
              style={{ border: `2px dashed ${dragActive ? 'var(--mgh-primary)' : 'var(--mgh-surface-3, #D5DAE6)'}`, borderRadius: 10, padding: '16px', textAlign: 'center',
                background: dragActive ? 'var(--mgh-primary-50, #EEF1FA)' : 'var(--mgh-surface-1)', cursor: 'pointer' }}>
              <input ref={fileInput} type="file" multiple accept="image/*,video/mp4,video/webm" style={{ display: 'none' }}
                onChange={e => { if (e.target.files && e.target.files.length) processFiles(e.target.files); e.target.value = ''; }} />
              <Icon name="cloud_upload" size={26} color="var(--mgh-primary)" />
              <div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                {uploading ? `Subiendo ${uploading} archivo${uploading === 1 ? '' : 's'}…` : 'Arrastra capturas o videos aquí, o haz clic para elegir'}
              </div>
              <div style={{ font: '400 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>PNG, JPG, WebP, MP4 o WebM</div>
            </div>
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {files.map((f, i) => (
                  <div key={f.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 4px 10px', background: 'var(--mgh-surface-1)', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <Icon name={f.type === 'video' ? 'videocam' : 'image'} size={16} color="var(--mgh-primary)" />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ color: 'var(--mgh-ink-3)' }}>({f.size})</span>
                    </span>
                    <IconButton icon="close" size={28} title={`Quitar ${f.name}`} onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enlaces */}
          <div>
            <span className="mgh-actmodal-label">Enlaces (PR de GitHub, Loom, Figma, Jira) • opcional</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 6 }}>
              <input className="mgh-actmodal-input" type="text" placeholder="Etiqueta (ej. PR #42)" aria-label="Etiqueta del enlace" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} />
              <input className="mgh-actmodal-input" type="url" placeholder="https://..." aria-label="URL del enlace" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
              <Button size="sm" variant="secondary" onClick={addLink}>Agregar</Button>
            </div>
            {links.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {links.map((l, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 8px', background: 'var(--mgh-primary-50, #EEF1FA)', borderRadius: 6, fontSize: 12, color: 'var(--mgh-primary)' }}>
                    <Icon name="link" size={14} /> {l.label}
                    <button type="button" aria-label={`Quitar ${l.label}`} onClick={() => setLinks(prev => prev.filter((_, j) => j !== i))}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'var(--mgh-ink-3)' }}>
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--mgh-surface-2)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button size="sm" variant="secondary" onClick={requestClose}>Cancelar</Button>
          <Button size="sm" variant="primary" onClick={save} disabled={saving || uploading > 0}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar actividad'}
          </Button>
        </div>
      </div>
    </div>
  );
}
