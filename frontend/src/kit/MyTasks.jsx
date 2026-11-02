import React, { useCallback, useEffect, useMemo, useState } from 'react';

/*
 * #mytasks "Mis tareas": the signed-in worker's own queue — every task and subtask assigned to them in their projects.
 * Filter by sprint / status / text, mark done or reopen (POST /tasks/:id/complete), jump to #myentry to log time.
 * Data: GET /my/tasks → { tasks, sprints } (agile.service myTasks).
 */

const fmtH = (n) => { const t = Math.round((Number(n) || 0) * 60), h = Math.floor(t / 60), m = t % 60; return h && m ? `${h}h ${m}m` : m ? `${m}m` : `${h}h`; };
const fmtDay = (ymd) => { const d = new Date(String(ymd || '') + 'T12:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }); };
const isDone = (t) => Number(t.status_is_done) === 1;
const PRIORITY_TONE = { Urgent: 'danger', High: 'warning', Medium: 'neutral', Low: 'neutral' };
const PRIORITY_ES = { Urgent: 'Urgente', High: 'Alta', Medium: 'Media', Low: 'Baja' };

export default function MyTasks({ go, notify }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { PageHeader, Card, StatCard, FilterChips, Badge, Button, Icon } = DS;
  const R = window.MGH_RBAC;
  const empId = (R && R.user && (R.user.employeeId || R.user.employee_id)) || (R && R.me() && R.me().emp) || null;
  const [data, setData] = useState(null);
  const [sprint, setSprint] = useState('current'); // current | all | backlog | <sprint id>
  const [state, setState] = useState('open'); // open | done | all
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null); // expanded task id
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try { setData(await window.api.myTasks()); }
    catch (err) { setData({ tasks: [], sprints: [] }); if (notify) notify('No se pudieron cargar tus tareas • ' + err.message); }
  }, []);
  useEffect(() => { if (empId) load(); }, [empId, load]);

  const tasks = (data && data.tasks) || [];
  const sprints = (data && data.sprints) || [];
  const activeIds = sprints.filter((s) => s.status === 'ACTIVE').map((s) => s.id);
  // "Sprint actual" = the active sprint(s); without one it shows everything
  const sprintOk = (t) => sprint === 'all' ? true
    : sprint === 'backlog' ? !t.sprint_id
      : sprint === 'current' ? (activeIds.length ? activeIds.includes(t.sprint_id) : true)
        : t.sprint_id === sprint;
  const inSprint = tasks.filter(sprintOk);
  const term = q.trim().toLowerCase();
  const shown = inSprint
    .filter((t) => state === 'all' || (state === 'done' ? isDone(t) : !isDone(t)))
    .filter((t) => !term || `${t.task_key} ${t.title} ${t.parent_key || ''} ${t.project_name || ''}`.toLowerCase().includes(term));

  // Subtasks right under their parent when the parent is also in the list; otherwise on their own
  const ordered = useMemo(() => {
    const ids = new Set(shown.map((t) => t.id));
    const top = shown.filter((t) => !t.parent_id || !ids.has(t.parent_id))
      .sort((a, b) => isDone(a) - isDone(b) || String(a.project_key).localeCompare(String(b.project_key)) || String(a.task_key).localeCompare(String(b.task_key), undefined, { numeric: true }));
    const out = [];
    for (const t of top) {
      out.push({ t, depth: 0 });
      shown.filter((k) => k.parent_id === t.id).sort((a, b) => String(a.task_key).localeCompare(String(b.task_key), undefined, { numeric: true })).forEach((k) => out.push({ t: k, depth: 1 }));
    }
    return out;
  }, [shown]);

  const toggle = async (t) => {
    const done = !isDone(t);
    setBusy(t.id);
    try {
      const updated = await window.api.completeTask(t.id, done);
      setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, ...updated, project_key: x.project_key, project_name: x.project_name } : x)) }));
      if (notify) notify(done ? `${t.task_key} completada` : `${t.task_key} reabierta`);
      if (t.parent_id) load(); // the parent's done/total count changes
    } catch (err) { if (notify) notify(err.message); }
    finally { setBusy(null); }
  };
  const logTime = (t) => {
    try { sessionStorage.setItem('mgh-myentry-task', t.task_key); } catch (_) {}
    if (go) go('myentry');
  };

  if (!empId) {
    return <div style={{ padding: 28 }}>{PageHeader ? <PageHeader breadcrumbs={['Mi trabajo', 'Mis tareas']} title="Mis tareas" description="Tu usuario no está vinculado a un registro de empleado. Pide a HR que lo vincule para ver tus tareas." /> : null}</div>;
  }

  const counts = { open: inSprint.filter((t) => !isDone(t)).length, done: inSprint.filter(isDone).length };
  const sprintOptions = [
    { value: 'current', label: activeIds.length ? 'Sprint actual' : 'Sprint actual (no hay uno activo)' },
    { value: 'all', label: 'Todos los sprints' },
    { value: 'backlog', label: 'Sin sprint (backlog)' },
    ...sprints.map((s) => ({ value: s.id, label: `${s.name}${s.projectKey ? ' • ' + s.projectKey : ''}${s.status === 'ACTIVE' ? ' (activo)' : s.status === 'COMPLETED' ? ' (cerrado)' : ''}` })),
  ];
  const curSprint = sprints.find((s) => s.id === sprint) || (sprint === 'current' && activeIds.length === 1 ? sprints.find((s) => s.id === activeIds[0]) : null);
  const td = { padding: '10px 12px', borderTop: '1px solid var(--mgh-surface-2)', font: '500 13px/18px var(--font-sans)', color: 'var(--mgh-ink)', verticalAlign: 'top' };

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600, margin: '0 auto' }}>
      {PageHeader ? <PageHeader breadcrumbs={['Mi trabajo', 'Mis tareas']} title="Mis tareas"
        description="Las tareas y subtareas que tienes asignadas en tus proyectos. Márcalas como completadas al terminarlas y registra tus horas en ellas."
        actions={go ? <Button variant="secondary" icon="more_time" onClick={() => go('myentry')}>Registrar horas</Button> : null} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        <StatCard label="Pendientes" value={String(counts.open)} icon="pending_actions" tone="warning" footer={curSprint ? curSprint.name : sprint === 'backlog' ? 'Sin sprint' : 'En el filtro actual'} />
        <StatCard label="Completadas" value={String(counts.done)} icon="task_alt" tone="success" footer={inSprint.length ? Math.round((counts.done / inSprint.length) * 100) + '% del total' : '—'} />
        <StatCard label="Horas registradas" value={fmtH(inSprint.reduce((a, t) => a + (Number(t.logged_hours) || 0), 0))} icon="schedule" footer="En estas tareas" />
        <StatCard label="Sprint" value={curSprint ? curSprint.name : sprint === 'all' ? 'Todos' : sprint === 'backlog' ? 'Backlog' : '—'} icon="sprint" footer={curSprint && curSprint.endDate ? 'Termina el ' + fmtDay(curSprint.endDate) : ' '} />
      </div>

      <Card padding={20}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <select value={sprint} onChange={(e) => setSprint(e.target.value)} aria-label="Sprint"
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3,#D5DAE6)', font: '600 13px/18px var(--font-sans)', background: '#fff', color: 'var(--mgh-ink)', minWidth: 220 }}>
            {sprintOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {FilterChips ? <FilterChips value={state} onChange={setState} options={[{ value: 'open', label: 'Pendientes', count: counts.open }, { value: 'done', label: 'Completadas', count: counts.done }, { value: 'all', label: 'Todas', count: inSprint.length }]} /> : null}
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar clave, título o proyecto…"
            style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--mgh-surface-3,#D5DAE6)', font: '500 13px/18px var(--font-sans)', outline: 'none' }} />
        </div>

        {data == null ? <div className="mgh-body" style={{ padding: 24, color: 'var(--mgh-ink-3)' }}>Cargando…</div>
          : !tasks.length ? <div className="mgh-body" style={{ padding: 24, color: 'var(--mgh-ink-3)', textAlign: 'center' }}>Todavía no tienes tareas asignadas. Cuando un PM te asigne una (o crees una en Proyectos), aparecerá aquí.</div>
            : !ordered.length ? <div className="mgh-body" style={{ padding: 24, color: 'var(--mgh-ink-3)', textAlign: 'center' }}>{state === 'open' ? 'No tienes tareas pendientes en este filtro.' : 'No hay tareas en este filtro.'}</div>
              : <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead><tr>{['', 'Tarea', 'Proyecto / Sprint', 'Estado', 'Horas', ''].map((c, i) => <th key={i} style={{ textAlign: i === 4 ? 'right' : 'left', padding: '10px 12px', background: 'var(--mgh-surface-1)', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--mgh-ink-2)', width: i === 0 ? 44 : undefined }}>{c}</th>)}</tr></thead>
                  <tbody>{ordered.map(({ t, depth }) => {
                    const done = isDone(t), expanded = open === t.id;
                    return (
                      <React.Fragment key={t.id}>
                        <tr style={{ background: done ? 'var(--mgh-surface-1)' : '#fff' }}>
                          <td style={{ ...td, paddingLeft: 12 + depth * 22 }}>
                            <button type="button" disabled={busy === t.id} onClick={() => toggle(t)} title={done ? 'Reabrir' : 'Marcar como completada'} aria-label={done ? 'Reabrir ' + t.task_key : 'Completar ' + t.task_key}
                              style={{ border: 'none', background: 'transparent', padding: 0, cursor: busy === t.id ? 'wait' : 'pointer', display: 'inline-flex' }}>
                              {Icon ? <Icon name={done ? 'check_circle' : 'radio_button_unchecked'} size={22} color={done ? 'var(--mgh-success)' : 'var(--mgh-ink-3)'} /> : (done ? '✓' : '○')}
                            </button>
                          </td>
                          <td style={td}>
                            <button type="button" onClick={() => setOpen(expanded ? null : t.id)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <b style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--mgh-primary)' }}>{t.task_key}</b>
                                <span style={{ fontWeight: 600, color: done ? 'var(--mgh-ink-3)' : 'var(--mgh-ink)', textDecoration: done ? 'line-through' : 'none' }}>{t.title}</span>
                                {t.priority && t.priority !== 'Medium' && Badge ? <Badge size="sm" tone={PRIORITY_TONE[t.priority] || 'neutral'}>{PRIORITY_ES[t.priority] || t.priority}</Badge> : null}
                              </span>
                              <span style={{ font: '500 11px/15px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>
                                {t.parent_key && depth === 0 ? `↳ subtarea de ${t.parent_key}${t.parent_title ? ' • ' + t.parent_title : ''}` : null}
                                {t.subtask_count > 0 ? `${t.subtask_done}/${t.subtask_count} subtareas hechas` : null}
                              </span>
                            </button>
                          </td>
                          <td style={td}>
                            <div style={{ fontWeight: 600 }}>{t.project_name || t.project_key}</div>
                            <div style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{t.sprint_name || 'Backlog'}</div>
                          </td>
                          <td style={td}>{Badge ? <Badge size="sm" dot tone={done ? 'success' : t.status_category === 'in_progress' ? 'info' : 'neutral'}>{t.status_name || '—'}</Badge> : t.status_name}</td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {fmtH(t.logged_hours)}{Number(t.estimate_hours) > 0 ? <span style={{ color: 'var(--mgh-ink-3)' }}> / {fmtH(t.estimate_hours)}</span> : null}
                          </td>
                          <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {!done && Button ? <Button size="sm" variant="ghost" icon="more_time" onClick={() => logTime(t)}>Registrar horas</Button> : null}
                          </td>
                        </tr>
                        {expanded ? (
                          <tr><td colSpan={6} style={{ padding: '0 12px 14px ' + (56 + depth * 22) + 'px', background: done ? 'var(--mgh-surface-1)' : '#fff' }}>
                            <div style={{ font: '400 13px/20px var(--font-sans)', color: 'var(--mgh-ink-2)', whiteSpace: 'pre-wrap', maxWidth: 900 }}>{t.description || 'Sin descripción.'}</div>
                          </td></tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}</tbody>
                </table>
              </div>}
      </Card>
    </div>
  );
}
