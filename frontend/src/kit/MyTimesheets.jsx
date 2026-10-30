import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getCurrentPeriod, getQuincenaForDate, localDateStr } from '../lib/periodService.js';

/*
 * Self-service timesheet views (employee, contractor, PM and supervisor — each sees ONLY their own records):
 *  - MySheets  (#mysheets):  one row per quincena with hours and status; submit Draft/Returned sheets for approval.
 *  - MyHistory (#myhistory): timeline of every status change on my sheets and my leave requests.
 * Data: GET /timesheets?empId&live=1 (editable sheets show the hours their activities add up to right now),
 * POST /timesheets/ensure, POST /timesheets/:id/submit. Hours are frozen by the backend at submission.
 */

export const EDITABLE = ['Draft', 'Returned'];
const STATUS_ES = {
  Draft: 'Borrador', Returned: 'Devuelta', Submitted: 'Enviada', 'Supervisión PM': 'En revisión del PM', 'PM Review': 'En revisión del PM',
  'Aprobación Dueño': 'En aprobación del dueño', 'Owner Approval': 'En aprobación del dueño', Approved: 'Aprobada', Paid: 'Pagada',
  Closed: 'Cerrada', Archived: 'Archivada', 'Pending Supervisor': 'Pendiente supervisor', 'Pending HR': 'Pendiente HR', Rejected: 'Rechazada', Cancelled: 'Cancelada',
};
export const statusLabel = (s) => STATUS_ES[s] || s || '—';
export const statusTone = (s) => (s === 'Returned' || s === 'Rejected' ? 'danger' : s === 'Approved' || s === 'Paid' ? 'success' : s === 'Draft' ? 'neutral' : 'warning');
const h1 = (n) => (Number(n) || 0).toFixed(1) + 'h';
const periodOf = (code) => {
  const m = /^PP-(\d{4})-(\d{2})$/.exec(code || '');
  if (!m) return null;
  const y = Number(m[1]), n = Number(m[2]);
  return getQuincenaForDate(new Date(y, Math.floor((n - 1) / 2), n % 2 ? 5 : 20));
};
const fmtDay = (ymd) => { const [y, m, d] = String(ymd || '').split('-'); return d ? `${d}/${m}/${y}` : ''; };
const fmtWeekday = (ymd) => new Date(ymd + 'T12:00:00').toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
// A quincena is submitted once, with all its days, from its last day on (the backend refuses earlier submits)
const submitFrom = (s) => s.submittableFrom || (periodOf(s.period) || {}).endDate || '';
const fmtAt = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

function useMyEmployee(user) {
  const rbac = typeof window !== 'undefined' ? window.MGH_RBAC : null;
  const me = rbac && rbac.me ? rbac.me() : null;
  return {
    empId: (user && (user.employeeId || user.employee_id)) || (me && me.emp) || null,
    name: (user && user.name) || (me && me.person) || '',
  };
}

function useMySheets(empId, name, notify) {
  const [sheets, setSheets] = useState(null);
  const load = useCallback(async () => {
    if (!empId || !window.api) { setSheets([]); return; }
    try {
      // Make sure the current quincena has a sheet so it always shows up
      await window.api.ensureTimesheet(empId, getCurrentPeriod().code, name).catch(() => null);
      const list = await window.api.timesheets({ empId, live: '1' });
      setSheets((Array.isArray(list) ? list : []).sort((a, b) => String(b.period).localeCompare(String(a.period))));
    } catch (e) {
      setSheets([]);
      if (notify) notify('No se pudieron cargar tus hojas de tiempo • ' + e.message);
    }
  }, [empId, name]);
  useEffect(() => { load(); }, [load]);
  return [sheets, load];
}

function Shell({ title, crumb, desc, actions, children }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600, margin: '0 auto' }}>
      {DS.PageHeader ? <DS.PageHeader breadcrumbs={['Mi tiempo', crumb]} title={title} description={desc} actions={actions} /> : <h1>{title}</h1>}
      {children}
    </div>
  );
}

function NotLinked() {
  return <Shell title="Mi tiempo" crumb="—" desc="Tu usuario no está vinculado a un registro de empleado. Pide a HR que lo vincule para registrar y enviar tus horas." />;
}

export function MySheets({ user, notify, go }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button, Badge, Card, StatCard } = DS;
  const { empId, name } = useMyEmployee(user);
  const [sheets, reload] = useMySheets(empId, name, notify);
  const [busy, setBusy] = useState(null);
  if (!empId) return <NotLinked />;

  const cur = getCurrentPeriod();
  const list = sheets || [];
  const current = list.find((s) => s.period === cur.code);
  const inReview = list.filter((s) => !EDITABLE.includes(s.status) && !['Approved', 'Paid', 'Closed', 'Archived'].includes(s.status));
  const approvedYear = list.filter((s) => ['Approved', 'Paid'].includes(s.status) && String(s.period).startsWith('PP-' + cur.year));
  const today = localDateStr();
  const overdue = list.filter((s) => EDITABLE.includes(s.status) && submitFrom(s) && today >= submitFrom(s) && (Number(s.total) || 0) > 0);

  const submit = async (s) => {
    const worked = (Number(s.reg) || 0) + (Number(s.ot) || 0) + (Number(s.pto) || 0);
    if (worked <= 0) { notify('No hay horas registradas en ' + s.period + '. Registra tus actividades primero.'); return; }
    if (localDateStr() < submitFrom(s)) { notify(`Podrás enviar ${s.period} a partir del ${fmtDay(submitFrom(s))}. Se envía una sola vez, con todos sus días.`); return; }
    const missing = s.missingDays || [];
    const gap = missing.length
      ? `\n\nAtención: ${missing.length} de ${s.workdays} días laborables no tienen actividades (${missing.slice(0, 6).map(fmtWeekday).join(', ')}${missing.length > 6 ? '…' : ''}). Se enviarán en 0h y después no podrás añadirlos.`
      : '';
    if (!window.confirm(`¿Enviar ${s.period} a aprobación con ${h1(s.total)}?${gap}\n\nLa quincena se envía una sola vez: después no podrás editar sus actividades salvo que el PM te la devuelva.`)) return;
    setBusy(s.id);
    try {
      await window.api.submitTimesheet(s.id);
      notify(s.period + ' enviada a aprobación');
      await reload();
    } catch (e) {
      notify('No se pudo enviar • ' + e.message);
    } finally {
      setBusy(null);
    }
  };
  const openEntry = (s) => {
    const p = periodOf(s.period);
    try { sessionStorage.setItem('mgh-myentry-date', p ? p.startDate : ''); } catch (_) {}
    go && go('myentry');
  };
  const returnReason = (s) => { const h = (s.history || []).filter((x) => x.to === 'Returned').slice(-1)[0]; return h ? h.comment : ''; };

  return (
    <Shell title="Mis hojas de tiempo" crumb="Mis hojas" desc="Una hoja por quincena. Registra tus actividades durante la quincena y envíala una sola vez, a partir de su último día, con todos sus días. Mientras está en Borrador o Devuelta sus horas se calculan en vivo; al enviarla se congelan y pasa a aprobación.">
      {overdue.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--mgh-warning-bg)', font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--mgh-warning)' }}>schedule_send</span>
          <span>{overdue.length === 1 ? `La quincena ${overdue[0].period} está lista para enviar.` : `${overdue.length} quincenas están listas para enviar: ${overdue.map((s) => s.period).join(', ')}.`} Revisa que estén todos tus días y pulsa Enviar.</span>
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        <StatCard label={'Quincena actual • ' + cur.code} value={current ? statusLabel(current.status) : '—'} icon="event_available" tone={current ? statusTone(current.status) : 'neutral'} footer={cur.rangeShort + ' • cierra en ' + cur.daysRemaining + 'd'} />
        <StatCard label="Horas de la quincena" value={current ? h1(current.total) : '0.0h'} icon="schedule" footer={current && current.liveHours ? 'En vivo desde tus actividades' : 'Congeladas al enviar'} />
        <StatCard label="En aprobación" value={String(inReview.length)} icon="pending_actions" tone="warning" footer="Esperando al PM o al dueño" />
        <StatCard label={'Aprobadas ' + cur.year} value={String(approvedYear.length)} icon="verified" tone="success" footer="Aprobadas o pagadas" />
      </div>
      <Card padding={20}>
        {sheets == null ? <div className="mgh-body" style={{ padding: 24, color: 'var(--mgh-ink-3)' }}>Cargando…</div> : !list.length ? <div className="mgh-body" style={{ padding: 24, color: 'var(--mgh-ink-3)' }}>Aún no tienes hojas de tiempo.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead><tr>{['Quincena', 'Regulares', 'Extra', 'Vacaciones', 'Feriado', 'Total', 'Estado', ''].map((c, i) => <th key={i} style={{ textAlign: i && i < 6 ? 'right' : 'left', padding: '10px 12px', background: 'var(--mgh-surface-1)', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--mgh-ink-2)' }}>{c}</th>)}</tr></thead>
              <tbody>{list.map((s) => {
                const p = periodOf(s.period), editable = EDITABLE.includes(s.status), reason = s.status === 'Returned' ? returnReason(s) : '';
                const td = { padding: '10px 12px', borderTop: '1px solid var(--mgh-surface-2)', font: '500 13px/18px var(--font-sans)', color: 'var(--mgh-ink)', fontVariantNumeric: 'tabular-nums' };
                return (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td style={td}><b>{s.period}</b><div style={{ color: 'var(--mgh-ink-3)', fontSize: 12 }}>{p ? p.rangeShort + ', ' + p.year : ''}</div></td>
                      <td style={{ ...td, textAlign: 'right' }}>{h1(s.reg)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{h1(s.ot)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{h1(s.pto)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{h1(s.hol)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{h1(s.total)}{s.liveHours ? <div style={{ color: 'var(--mgh-ink-3)', fontSize: 11, fontWeight: 500 }}>en vivo</div> : null}</td>
                      <td style={td}><Badge size="sm" dot tone={statusTone(s.status)}>{statusLabel(s.status)}</Badge></td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Button size="sm" variant="ghost" icon={editable ? 'edit_calendar' : 'visibility'} onClick={() => openEntry(s)}>{editable ? 'Registrar' : 'Ver'}</Button>
                        {editable ? (today < submitFrom(s)
                          ? <Button size="sm" icon="schedule" disabled title={`La quincena se envía una sola vez, con todos sus días, a partir del ${fmtDay(submitFrom(s))}`}>{'Enviar desde ' + fmtDay(submitFrom(s)).slice(0, 5)}</Button>
                          : <Button size="sm" icon="send" disabled={busy === s.id} onClick={() => submit(s)}>{busy === s.id ? 'Enviando…' : 'Enviar'}</Button>) : null}
                      </td>
                    </tr>
                    {reason ? <tr><td colSpan={8} style={{ padding: '0 12px 12px', font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-danger)' }}>Devuelta: “{reason}” — corrige tus actividades y vuelve a enviarla.</td></tr> : null}
                  </React.Fragment>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}

export function MyHistory({ user, notify }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Badge, Card, FilterChips } = DS;
  const { empId, name } = useMyEmployee(user);
  const [sheets] = useMySheets(empId, name, notify);
  const [kind, setKind] = useState('all');
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); window.addEventListener('mgh-att', f); return () => window.removeEventListener('mgh-att', f); }, []);

  const events = useMemo(() => {
    const out = [];
    (sheets || []).forEach((s) => (s.history || []).forEach((h) => out.push({ kind: 'sheet', ref: s.period, at: h.at, from: h.from, to: h.to, actor: h.actor, role: h.role, comment: h.comment, type: h.type })));
    const A = window.MGH_ATT;
    (A ? A.leave() : []).filter((l) => l.emp === empId).forEach((l) => (l.history || []).forEach((h) => out.push({ kind: 'leave', ref: l.id + ' • ' + l.type + ' ' + l.from + (l.to !== l.from ? ' → ' + l.to : ''), at: h.at, from: h.from, to: h.to, actor: h.actor, role: h.role, comment: h.comment })));
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }, [sheets, empId]);
  if (!empId) return <NotLinked />;

  const shown = events.filter((e) => kind === 'all' || e.kind === kind);
  return (
    <Shell title="Historial de aprobaciones" crumb="Historial" desc="Cada cambio de estado de tus hojas de tiempo y de tus solicitudes de permiso, con quién lo hizo y su comentario.">
      <Card padding={20}>
        {FilterChips ? <FilterChips value={kind} onChange={setKind} options={[{ value: 'all', label: 'Todo', count: events.length }, { value: 'sheet', label: 'Hojas de tiempo', count: events.filter((e) => e.kind === 'sheet').length }, { value: 'leave', label: 'Permisos', count: events.filter((e) => e.kind === 'leave').length }]} /> : null}
        {sheets == null ? <div className="mgh-body" style={{ padding: 24, color: 'var(--mgh-ink-3)' }}>Cargando…</div> : !shown.length ? <div className="mgh-body" style={{ padding: 24, color: 'var(--mgh-ink-3)' }}>Todavía no hay movimientos. Aparecerán cuando envíes una quincena o solicites un permiso.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
            {shown.map((e, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: 14, padding: '12px 0', borderTop: '1px solid var(--mgh-surface-2)' }}>
                <span style={{ font: '600 12px/16px var(--font-mono)', color: 'var(--mgh-ink-3)' }}>{fmtAt(e.at)}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge size="sm" tone={e.kind === 'sheet' ? 'primary' : 'info'}>{e.kind === 'sheet' ? 'Quincena ' + e.ref : 'Permiso ' + e.ref}</Badge>
                    {e.type === 'activity_review' ? <Badge size="sm" tone="warning">Revisión de actividad</Badge> : e.type === 'comment' ? <Badge size="sm" tone="neutral">Comentario</Badge> : <>
                      {e.from ? <span className="mgh-body">{statusLabel(e.from)} →</span> : null}
                      <Badge size="sm" dot tone={statusTone(e.to)}>{statusLabel(e.to)}</Badge>
                    </>}
                  </div>
                  <span style={{ font: '500 13px/18px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>{e.actor || '—'}{e.role ? ' • ' + e.role : ''}</span>
                  {e.comment ? <span style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>“{e.comment}”</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Shell>
  );
}
