import React, { useState, useEffect, useCallback, useMemo } from 'react';

/*
 * "Mis proyectos" — what an employee, contractor or supervisor sees at #projects.
 * Data comes only from projects they are a member of (the backend scopes GET /projects, /tasks/search and
 * /projects/:key/* by membership). They can: see project tasks, create tasks (assigned to themselves),
 * move the status of tasks assigned to them, and jump to the activity log to record hours against a task.
 * Project setup (members, sprints, statuses, assignment to others) is done by the PM in the full workspace.
 */
export default function MyProjects({ notify, go, currentUser }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button, Badge, Card, StatCard, PageHeader, TextField } = DS;
  const rbac = window.MGH_RBAC;
  const me = (currentUser && (currentUser.employeeId || currentUser.employee_id)) || (rbac && rbac.me() ? rbac.me().emp : null);

  const [projects, setProjects] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [sel, setSel] = useState(null);
  const [projTasks, setProjTasks] = useState([]);
  const [statusesByProject, setStatusesByProject] = useState({});
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatuses = useCallback(async (key) => {
    if (!key || statusesByProject[key]) return;
    try {
      const s = await window.api.projectStatuses(key);
      setStatusesByProject((m) => ({ ...m, [key]: Array.isArray(s) ? s : [] }));
    } catch (_) {}
  }, [statusesByProject]);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([window.api.jiraProjects(), window.api.searchTasks({ mine: '1', limit: '200' })]);
      const list = Array.isArray(p) ? p : [];
      setProjects(list);
      setMyTasks(Array.isArray(t) ? t : []);
      setSel((cur) => cur || (list[0] && list[0].key) || null);
    } catch (e) {
      setProjects([]);
      notify && notify('No se pudieron cargar tus proyectos • ' + e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!sel) { setProjTasks([]); return; }
    let cancel = false;
    window.api.projectTasks(sel).then((r) => { if (!cancel) setProjTasks(Array.isArray(r) ? r : []); }).catch(() => { if (!cancel) setProjTasks([]); });
    loadStatuses(sel);
    return () => { cancel = true; };
  }, [sel]);
  useEffect(() => { [...new Set(myTasks.map((t) => t.project_key))].forEach(loadStatuses); }, [myTasks]);

  const move = async (task, statusId) => {
    try {
      await window.api.moveTask(task.id, { statusId });
      notify && notify(task.task_key + ' actualizada');
      await load();
      if (sel) setProjTasks(await window.api.projectTasks(sel));
    } catch (e) {
      notify && notify('No se pudo actualizar • ' + e.message);
    }
  };
  const create = async () => {
    if (!sel || !newTitle.trim()) return;
    setBusy(true);
    try {
      const t = await window.api.createTask(sel, { title: newTitle.trim() });
      notify && notify(t.task_key + ' creada y asignada a ti');
      setNewTitle('');
      await load();
      setProjTasks(await window.api.projectTasks(sel));
    } catch (e) {
      notify && notify('No se pudo crear la tarea • ' + e.message);
    } finally {
      setBusy(false);
    }
  };
  const logHours = (task) => {
    try { sessionStorage.setItem('mgh-myentry-task', task.task_key); } catch (_) {}
    go && go('myentry');
  };

  const open = myTasks.filter((t) => !t.status_is_done && t.status_category !== 'done');
  const logged = myTasks.reduce((s, t) => s + (Number(t.logged_hours) || 0), 0);
  const selProject = (projects || []).find((p) => p.key === sel);
  const statusSelect = (task) => {
    const sts = statusesByProject[task.project_key] || statusesByProject[sel] || [];
    if (!sts.length) return <Badge size="sm">{task.status_name || '—'}</Badge>;
    return (
      <select value={task.status_id || ''} onChange={(e) => move(task, e.target.value)} disabled={!!task.assignee_id && task.assignee_id !== me}
        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', font: '500 12px var(--font-sans)', background: '#fff' }}>
        {sts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    );
  };
  const th = { textAlign: 'left', padding: '8px 10px', background: 'var(--mgh-surface-1)', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-2)' };
  const td = { padding: '9px 10px', borderTop: '1px solid var(--mgh-surface-2)', font: '500 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' };

  if (!me) {
    return <div style={{ padding: 28 }}><PageHeader breadcrumbs={['Proyectos']} title="Mis proyectos" description="Tu usuario no está vinculado a un empleado. Pide a HR que lo vincule." /></div>;
  }
  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600, margin: '0 auto' }}>
      <PageHeader breadcrumbs={['Proyectos']} title="Mis proyectos" description="Proyectos de My Global Hub en los que participas, tus tareas y su estado. Las horas se registran en Mi registro, contra la tarea." />
      {projects == null ? <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>Cargando…</div> : !projects.length ? (
        <Card padding={24}><div className="mgh-body">Aún no perteneces a ningún proyecto. Pide a tu PM que te añada como miembro (Proyectos → Miembros).</div></Card>
      ) : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          <StatCard label="Mis proyectos" value={String(projects.length)} icon="folder_open" footer={projects.map((p) => p.name).join(' • ')} />
          <StatCard label="Tareas abiertas" value={String(open.length)} icon="task_alt" tone="warning" footer={myTasks.length + ' asignadas en total'} />
          <StatCard label="Horas registradas" value={logged.toFixed(1) + 'h'} icon="schedule" tone="success" footer="Sumadas desde tus actividades" />
        </div>

        <Card padding={20} title="Mis tareas" icon="assignment_ind">
          {!myTasks.length ? <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>No tienes tareas asignadas. Crea una en tu proyecto o pide a tu PM que te asigne.</div> : (
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead><tr>{['Tarea', 'Proyecto', 'Estado', 'Estimado', 'Registrado', ''].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
              <tbody>{myTasks.map((t) => (
                <tr key={t.id}>
                  <td style={td}><b style={{ fontFamily: 'var(--font-mono)' }}>{t.task_key}</b> {t.title}</td>
                  <td style={td}>{t.project_name || t.project_key}</td>
                  <td style={td}>{statusSelect(t)}</td>
                  <td style={td}>{(Number(t.estimate_hours) || 0).toFixed(1)}h</td>
                  <td style={td}>{(Number(t.logged_hours) || 0).toFixed(1)}h</td>
                  <td style={{ ...td, textAlign: 'right' }}><Button size="sm" variant="ghost" icon="more_time" onClick={() => logHours(t)}>Registrar horas</Button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>

        <Card padding={20} title="Tareas del proyecto" icon="view_kanban"
          actions={<select value={sel || ''} onChange={(e) => setSel(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3)', font: '600 13px var(--font-sans)' }}>
            {projects.map((p) => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}
          </select>}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <div style={{ flex: '1 1 260px' }}><TextField label={'Nueva tarea en ' + (selProject ? selProject.name : '')} value={newTitle} onChange={(x) => setNewTitle(typeof x === 'string' ? x : x.target.value)} placeholder="Título de la tarea (quedará asignada a ti)" /></div>
            <Button icon="add" disabled={busy || !newTitle.trim()} onClick={create}>Crear tarea</Button>
          </div>
          {!projTasks.length ? <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>Este proyecto aún no tiene tareas.</div> : (
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead><tr>{['Tarea', 'Responsable', 'Estado', 'Sprint', 'Estimado'].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
              <tbody>{projTasks.map((t) => (
                <tr key={t.id}>
                  <td style={td}><b style={{ fontFamily: 'var(--font-mono)' }}>{t.task_key}</b> {t.title}</td>
                  <td style={td}>{t.assignee_name || 'Sin asignar'}{t.assignee_id === me ? ' (tú)' : ''}</td>
                  <td style={td}>{t.assignee_id === me ? statusSelect({ ...t, project_key: sel }) : <Badge size="sm">{t.status_name || '—'}</Badge>}</td>
                  <td style={td}>{t.sprint_name || 'Backlog'}</td>
                  <td style={td}>{(Number(t.estimate_hours) || 0).toFixed(1)}h</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      </>}
    </div>
  );
}
