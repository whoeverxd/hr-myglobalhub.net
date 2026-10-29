import React from 'react';
import DailyActivities from './DailyActivities.jsx';
import AgileWorkspace from './AgileWorkspace.jsx';
import MyProjects from './MyProjects.jsx';
import { api } from '../lib/api.js';
import { getCurrentPeriod, getQuincenaForDate, getPeriodsForYear } from '../lib/periodService.js';

// Bundled from the My Global Hub design-system UI kit (ui_kits/enterprise). Each file is scoped; globals are shared via window.

// ---- data.jsx ----
(function(){
// Sample data for the My Global Hub enterprise kit (names/values follow the Figma file's sample content)
const A = 'assets/avatars/';
// Real employees are loaded from the backend (App.loadFromApi); no sample records.
// UI locale for dates (shared with the other screen blocks through window.__MGH_DATA)
const LOC = () => window.MGH_I18N ? window.MGH_I18N.locale() : 'en-US';
const EMPLOYEES = [];
// Payroll deduction engine — reads each employee's tax profile; Exempt short-circuits all withholdings.
// One company (My Global Hub, Dominicana SRL): DGII (ISR + TSS) is the only tax regime; 24 quincenas per year.
const DEDUCT = e => {
  const g = Number(e.gross) || 0, N = 24, br = (a, b) => { let x = 0, p = 0; for (const [cap, r] of b) { if (a <= p) break; x += (Math.min(a, cap) - p) * r; p = cap; } return x; };
  if (/^Exempt/.test(e.tax || '')) return { exempt: true, lines: [], total: 0, net: g };
  let lines = [];
  if (/DGII/.test(e.tax || '')) { const afp = g * 0.0287, sfs = g * 0.0304, fx = 60.5, ad = (g - afp - sfs) * N * fx; lines = [['ISR withholding', br(ad, [[416220, 0], [624329, .15], [867123, .20], [Infinity, .25]]) / N / fx], ['TSS — SFS (3.04%)', sfs], ['TSS — AFP (2.87%)', afp]]; }
  lines = lines.map(([l, v]) => [l, +v.toFixed(2)]);
  const total = lines.reduce((s, d) => s + d[1], 0);
  return { exempt: false, lines, total, net: g - total };
};

const STATUS_TONE = { 'Awaiting PM': 'warning', 'Awaiting Supervisor': 'warning', 'Flagged OT': 'danger', 'Jira Mismatch': 'danger', 'Ready': 'success', 'Approved': 'success', 'Returned': 'danger', 'Draft': 'neutral' };

const NAV = [
  { label: 'Overview', items: [{ key: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' }] },
  { label: 'Workforce', items: [
    { key: 'approvals', label: 'Approval Workspace', icon: 'assignment_turned_in' },
    { key: 'queue', label: 'Team Approval Queue', icon: 'fact_check' },
    { key: 'timesheets', label: 'Bi-Weekly Timesheets', icon: 'more_time' },
    { key: 'employees', label: 'Employees', icon: 'badge' } ] },
  { label: 'Payroll & Finance', items: [
    { key: 'payroll', label: 'Payroll Dashboard', icon: 'monitoring' },
    { key: 'processing', label: 'Payroll Processing', icon: 'payments' },
    { key: 'paystub', label: 'Pay Stubs', icon: 'receipt_long' },
    { key: 'banking', label: 'Banking & Allocations', icon: 'account_balance' } ] },
  { label: 'Integrations', items: [
    { key: 'jira', label: 'Jira Cloud Sync', icon: 'sync_alt' },
    { key: 'projects', label: 'Projects', icon: 'folder_open' } ] },
  { label: 'Insights', items: [{ key: 'reports', label: 'Reports & Register', icon: 'bar_chart' }] },
  { label: 'System', items: [
    { key: 'admin', label: 'Administration', icon: 'admin_panel_settings' },
    { key: 'settings', label: 'Company Settings', icon: 'tune' },
    { key: 'audit', label: 'Audit Log', icon: 'shield_lock' } ] },
];

// Dynamic period days breakdown derived directly from #attDaily punches & backend reconciliation
function buildDays(emp, period, reconcil) {
  if (!emp) return [];
  const startStr = (period && (period.start || period.startDate)) || getCurrentPeriod().startDate;
  const endStr = (period && (period.end || period.endDate)) || getCurrentPeriod().endDate;

  if (reconcil && reconcil.reconciliation && Array.isArray(reconcil.reconciliation.days) && reconcil.reconciliation.days.length > 0) {
    return reconcil.reconciliation.days.map((d, i) => {
      const punch = d.punch;
      const attDay = window.MGH_ATT ? window.MGH_ATT.day(emp.id, d.date) : null;
      const primaryAct = (d.activities && d.activities[0]) || null;
      const clockIn = (punch && punch.clockIn) || (attDay && attDay.punches && attDay.punches.in) || '';
      const clockOut = (punch && punch.clockOut) || (attDay && attDay.punches && attDay.punches.out) || '';
      const hrs = punch && punch.hours != null ? Number(punch.hours) : (attDay && attDay.hours != null ? attDay.hours : 0);
      const ot = punch && punch.overtime != null ? Number(punch.overtime) : (hrs > 8 ? hrs - 8 : 0);
      const jira = Number(d.activityHours) || 0;
      const note = (punch && punch.note) || (ot > 0 ? `Sobretiempo (+${ot.toFixed(1)}h)` : d.isWeekend ? 'Fin de semana' : (hrs > 0 ? (attDay && attDay.status && attDay.status !== 'Present' ? attDay.status : 'Jornada Estándar') : 'Sin registro de ponche'));
      const dObj = new Date(d.date + 'T00:00:00Z');
      const dateLabel = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', timeZone: 'UTC' });

      return {
        id: i,
        dateStr: d.date,
        week: i < 7 ? 1 : 2,
        date: dateLabel,
        weekend: d.isWeekend,
        inn: clockIn || '—',
        out: clockOut || '—',
        hrs: +hrs.toFixed(1),
        ot: +ot.toFixed(1),
        key: primaryAct ? primaryAct.jiraKey : null,
        task: primaryAct ? (primaryAct.jiraSummary || primaryAct.description) : (d.isWeekend ? '' : 'Sin actividad registrada'),
        jira: +jira.toFixed(1),
        note,
        activities: d.activities || [],
        hasEvidences: d.hasEvidences || false,
        match: d.match
      };
    });
  }

  const out = [];
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  let idx = 0;
  for (let dt = new Date(start); dt <= end; dt.setUTCDate(dt.getUTCDate() + 1), idx++) {
    const dStr = dt.toISOString().slice(0, 10);
    const wd = dt.getUTCDay();
    const weekend = wd === 0 || wd === 6;
    const attDay = window.MGH_ATT ? window.MGH_ATT.day(emp.id, dStr) : null;
    const p = attDay ? attDay.punches : { in: '', out: '' };
    const hrs = attDay && attDay.hours != null ? attDay.hours : 0;
    const ot = hrs > 8 ? hrs - 8 : 0;
    const jira = 0;
    const dateLabel = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', timeZone: 'UTC' });

    out.push({
      id: idx,
      dateStr: dStr,
      week: idx < 7 ? 1 : 2,
      date: dateLabel,
      weekend,
      inn: (p && p.in) || '—',
      out: (p && p.out) || '—',
      hrs: +hrs.toFixed(1),
      ot: +ot.toFixed(1),
      key: null,
      task: weekend ? '' : 'Sin actividad registrada',
      jira: +jira.toFixed(1),
      note: ot > 0 ? `Sobretiempo (+${ot.toFixed(1)}h)` : weekend ? 'Fin de semana' : (hrs > 0 ? (attDay && attDay.status ? attDay.status : 'Jornada Estándar') : 'Sin registro de ponche'),
      activities: [],
      hasEvidences: false,
      match: true
    });
  }
  return out;
}
const fmt$ = n => {
  if (n == null || n === '' || typeof n === 'boolean') return '—';
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return '—';
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtH = n => {
  if (n == null || typeof n === 'boolean') return '0.0h';
  const num = typeof n === 'number' ? n : Number(n);
  return (isNaN(num) ? 0 : num).toFixed(1) + 'h';
};

function useTable(rows, { search = [], pageSize = 8, initialSort } = {}) {
  const [q, setQ] = React.useState(''); const [sort, setSort] = React.useState(initialSort || null);
  const [page, setPage] = React.useState(1); const [sel, setSel] = React.useState([]);
  const filtered = React.useMemo(() => {
    let r = rows.filter(x => !q || search.some(k => String(x[k]).toLowerCase().includes(q.toLowerCase())));
    if (sort) r = [...r].sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1));
    return r;
  }, [rows, q, sort]);
  React.useEffect(() => setPage(1), [q]);
  return { q, setQ, sort, setSort, page, setPage, sel, setSel, total: filtered.length, rows: filtered.slice((page - 1) * pageSize, page * pageSize), all: filtered, pageSize };
}

// Employees come only from the backend; drop the old browser-side cache of "new employees".
try { localStorage.removeItem('mgh-new-employees'); } catch (_) {}
const WF = window.MGH_WF;
const curPeriodInit = getCurrentPeriod();
if (WF) EMPLOYEES.forEach(e => WF.ensure(e.id, e.name, curPeriodInit.code, 'Draft'));
// Tenant scoping: EMPLOYEES is the active organization's repository view; ALL_EMP is the store.
const ALL_EMP = EMPLOYEES.slice();
function scopeTenant() {
  const R = window.MGH_RBAC; if (!R) return;
  EMPLOYEES.forEach(e => { if (!ALL_EMP.includes(e) && !ALL_EMP.some(x => x.id === e.id)) ALL_EMP.push(e); });
  const isSelf = R.scopeOf('employees.view') === 'self';
  EMPLOYEES.splice(0, EMPLOYEES.length, ...ALL_EMP.filter(e => e.entity === R.org && (!isSelf || R.can('employees.view', e))));
}
scopeTenant();
if (window.MGH_ATT) window.MGH_ATT.setRoster(EMPLOYEES);
// Approved paid leave is counted by the backend when it computes each timesheet's hours
// (timesheets.controller); the UI never adds leave hours on top, so nothing is double counted.
window.addEventListener('mgh-att', () => { window.dispatchEvent(new Event('mgh-wf')); });
window.addEventListener('mgh-rbac', () => { scopeTenant(); if (window.MGH_ATT) window.MGH_ATT.setRoster(EMPLOYEES); });
const PERIOD = getCurrentPeriod().code;
const recOf = id => {
  if (!WF) return null;
  const curP = getCurrentPeriod().code;
  return WF.get(id, curP) || WF.ensure(id, (EMPLOYEES.find(x => x.id === id) || {}).name || id, curP, 'Draft');
};
const liveStatus = e => { const r = recOf(e.id); return r ? r.status : (e.status || 'Draft'); };
// Jira match is null until real reconciliation data exists — never treat "not measured" as a mismatch.
const hasMatch = e => typeof e.match === 'number';
const lowMatch = e => hasMatch(e) && e.match < 95;
const matchTxt = e => hasMatch(e) ? e.match + '%' : '—';
function WFPill({ status, size }) { const c = WF ? WF.statusColor(status) : ['#EAEDFF', '#43474D']; return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: size === 'sm' ? '2px 8px' : '3px 10px', borderRadius: 9999, font: (size === 'sm' ? '700 11px/16px' : '700 12px/16px') + ' var(--font-sans)', background: c[0], color: c[1], whiteSpace: 'nowrap' }}>{status}</span>; }
function useWF() { const [, f] = React.useState(0); React.useEffect(() => { const h = () => f(x => x + 1); window.addEventListener('mgh-wf', h); return () => window.removeEventListener('mgh-wf', h); }, []); }
const fmtAt = iso => { const t = new Date(iso); return isNaN(t) ? iso : t.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
window.__mghPrevPeriods = (cur, n) => { const out = []; let c = cur; for (let i = 0; i < n; i++) { const d = new Date(c.startDate + 'T12:00:00'); d.setDate(d.getDate() - 1); c = getQuincenaForDate(d); out.push({ code: c.code, label: c.code + ' (' + c.rangeShort + ', ' + c.year + ')', phase: 'Histórico', start: c.startDate, end: c.endDate, startDate: c.startDate, endDate: c.endDate, daysRemaining: 0 }); } return out; };
window.__MGH_DATA = { LOC, ALL_EMP, EMPLOYEES, DEDUCT, STATUS_TONE, NAV, buildDays, fmt$, fmtH, useTable, AVATARS: A, WF, WFPill, useWF, recOf, liveStatus, fmtAt, PERIOD, hasMatch, lowMatch, matchTxt };
Object.assign(window, window.__MGH_DATA);

})();

// ---- Shell.jsx ----
(function(){
const DS = window.MyGlobalHubDesignSystem_2a603d;
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, MetricTile, DataTable, TableToolbar, Pagination, ActivityFeed, Tabs, PageHeader, Select, ProgressBar, KeyValue, Toggle, Stepper, Checkbox, TextField, SearchField } = DS;
const v = x => typeof x === 'string' ? x : x && x.target ? x.target.value : x; // DS inputs pass a value or an event

// What happened to the login of a just-created employee/contractor (backend `account.status`); null when all is normal
window.__mghAccountNotice = (a) => !a || a.status === 'created' ? null
  : a.status === 'linked' ? 'Este correo ya tenía una cuenta (por ejemplo, de Google). Quedó vinculada a este colaborador: no se creó contraseña nueva y entra como antes.'
  : a.status === 'conflict' ? 'Este correo ya pertenece a la cuenta de otro colaborador (' + (a.linkedEmployeeId || 'desconocido') + '). No se creó acceso: usa otro correo o corrige el otro registro.'
  : a.status === 'failed' ? 'El colaborador se guardó, pero no se pudo crear su acceso' + (a.error ? ' (' + a.error + ')' : '') + '. Todavía no puede iniciar sesión.'
  : 'Sin correo no se crea acceso. Agrega un correo para que pueda iniciar sesión.';
window.__mghEmpty = (title, crumbs, desc) => <div style={{ padding: 28 }}><DS.PageHeader breadcrumbs={crumbs || [title]} title={title} description={desc || 'No data available in your scope for this organization yet.'} /></div>;
function Page({ children, style }) { return <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600, ...style }}>{children}</div>; }
function Grid({ cols = 4, min = 220, gap = 14, children, style }) { return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap, ...style }}>{children}</div>; }

// Simple CSS column chart — kit helper (no chart component in source)
function BarChart({ data, height = 180, color = 'var(--mgh-primary)', color2, format = v => v, legend }) {
  const max = Math.max(...data.map(d => (d.a || 0) + (d.b || 0))) * 1.1;
  return <div>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height, padding: '0 4px', borderBottom: '1px solid var(--mgh-surface-3)', backgroundImage: 'linear-gradient(var(--mgh-surface-2) 1px, transparent 1px)', backgroundSize: `100% ${height / 4}px` }}>
      {data.map((d, i) => <div key={i} title={`${d.label}: ${format(d.a + (d.b || 0))}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', gap: 2 }}>
        {d.b != null && <div style={{ height: `${(d.b / max) * 100}%`, background: color2 || 'var(--mgh-accent)', borderRadius: '4px 4px 0 0' }} />}
        <div style={{ height: `${(d.a / max) * 100}%`, background: d.hi ? 'var(--mgh-navy)' : color, borderRadius: d.b != null ? '0 0 0 0' : '4px 4px 0 0' }} />
      </div>)}
    </div>
    <div style={{ display: 'flex', gap: 10, padding: '6px 4px 0' }}>{data.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center', font: '600 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{d.label}</span>)}</div>
    {legend && <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>{legend.map(([c, l]) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 11px var(--font-sans)', color: 'var(--mgh-ink-2)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}</span>)}</div>}
  </div>;
}

function Modal({ open, title, onClose, children, actions, width = 480 }) {
  if (!open) return null;
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(19,27,46,.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={e => e.stopPropagation()} style={{ width, maxWidth: '100%', background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 className="mgh-h3" style={{ margin: 0 }}>{title}</h3><DS.IconButton icon="close" title="Close" onClick={onClose} /></div>
      {children}
      {actions && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{actions}</div>}
    </div>
  </div>;
}
window.Modal = Modal;

function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 120, background: 'var(--mgh-navy)', color: '#fff', padding: '10px 16px', borderRadius: 12, boxShadow: 'var(--shadow-lg)', display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font-sans)' }}><DS.Icon name="check_circle" size={16} color="var(--mgh-success-300)" />{msg}</div>;
}

function EmployeeCell({ e, sub }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><DS.Avatar src={e.avatar} name={e.name} size={32} />
    <div style={{ minWidth: 0 }}><div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{e.name}</div><div style={{ font: '400 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{sub || e.role}</div></div></div>;
}

const PERIOD = getCurrentPeriod();

function QueueCard({ e, active, checked, onCheck, onClick }) {
  const tone = STATUS_TONE[e.status];
  return <div onClick={onClick} style={{ cursor: 'pointer', borderRadius: 12, padding: 14, background: active ? 'var(--mgh-primary-50)' : '#fff', boxShadow: active ? 'inset 3px 0 0 var(--mgh-primary), var(--shadow-md)' : 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow 120ms' }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Checkbox checked={checked} onChange={onCheck} style={{ marginTop: 12 }} />
      <Avatar src={e.avatar} name={e.name} size={40} status={e.avatar ? 'online' : undefined} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ font: '600 14px/20px var(--font-sans)', color: 'var(--mgh-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span><Badge mono size="sm" tone="neutral">{e.id}</Badge></div>
        <div style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.role} • {e.dept}</div>
      </div>
      <Badge size="sm" dot tone={!hasMatch(e) ? 'neutral' : e.match >= 98 ? 'success' : 'warning'}>{matchTxt(e)}</Badge>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: active ? '#fff' : 'var(--mgh-surface-1)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
      {[['Reg', e.reg], ['OT', e.ot, e.ot > 8 ? 'var(--mgh-danger)' : e.ot ? 'var(--mgh-warning)' : null], ['PTO', e.pto, e.pto ? 'var(--mgh-success)' : null], ['Total', e.total]].map(([l, v, c]) => <div key={l}><div style={{ font: '500 11px/14px var(--font-sans)', color: c || 'var(--mgh-ink-3)' }}>{l}</div><div style={{ font: '700 13px/18px var(--font-sans)', color: c || 'var(--mgh-ink)' }}>{fmtH(v)}</div></div>)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Badge size="sm" tone={tone} icon={tone === 'danger' ? 'warning' : tone === 'success' ? 'task_alt' : 'hourglass_top'}>{e.status}</Badge><span style={{ font: '700 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>{fmt$(e.gross)} Est.</span></div>
  </div>;
}

function SectionHead({ icon, title, sub, right }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
    <div style={{ display: 'flex', gap: 8 }}>{icon && <Icon name={icon} size={18} color="var(--mgh-primary)" style={{ marginTop: 3 }} />}<div><div className="mgh-h3">{title}</div>{sub && <div style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{sub}</div>}</div></div>{right}</div>;
}

function ApprovalWorkspace(props) {
  const canAccess = MGH_RBAC.canAny(['timesheets.view', 'timesheets.approve', 'payroll.generate']);
  return canAccess ? <ApprovalWorkspaceInner {...props} /> : window.__mghEmpty('Approval Workspace', ['Approvals', 'Approval Workspace'], 'No timesheets in your scope for this organization.');
}

function ApprovalWorkspaceInner({ notify, empId, currentUser }) {
  const activeQuincena = getCurrentPeriod();
  const availablePeriods = React.useMemo(() => [
    { code: activeQuincena.code, label: `${activeQuincena.code} (${activeQuincena.rangeShort || activeQuincena.range || ''})`, phase: activeQuincena.phase || 'Periodo Actual • En Curso', start: activeQuincena.startDate, end: activeQuincena.endDate, startDate: activeQuincena.startDate, endDate: activeQuincena.endDate, daysRemaining: activeQuincena.daysRemaining },
    ...window.__mghPrevPeriods(activeQuincena, 2),
  ], [activeQuincena.code]);
  const [periodCode, setPeriodCode] = React.useState(activeQuincena.code);
  const curPeriod = availablePeriods.find(p => p.code === periodCode) || activeQuincena;

  const [backendTimesheets, setBackendTimesheets] = React.useState([]);
  const [backendPunches, setBackendPunches] = React.useState([]);
  const [empActivities, setEmpActivities] = React.useState([]);
  const [reconcil, setReconcil] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load period timesheets and punches from backend API
  React.useEffect(() => {
    let active = true;
    async function loadPeriodData() {
      setIsLoading(true);
      try {
        if (window.api) {
          const [tsList, punchesList] = await Promise.all([
            window.api.timesheets({ periodId: periodCode }).catch(() => []),
            window.api.punches({ dateFrom: curPeriod.start || curPeriod.startDate, dateTo: curPeriod.end || curPeriod.endDate }).catch(() => [])
          ]);
          if (active) {
            setBackendTimesheets(tsList || []);
            setBackendPunches(punchesList || []);
            if (window.MGH_WF && window.MGH_WF.syncFromBackend && Array.isArray(tsList)) {
              window.MGH_WF.syncFromBackend(tsList);
            }
            if (window.MGH_ATT && Array.isArray(punchesList)) {
              window.MGH_ATT.loadBackendPunches(punchesList);
            }
          }
        }
      } catch (err) {
        console.warn('[ApprovalWorkspace] Error loading period data:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadPeriodData();
    return () => { active = false; };
  }, [periodCode, curPeriod.start, curPeriod.end]);

  const [filter, setFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState([]);
  const [week, setWeek] = React.useState('all');
  const [sign, setSign] = React.useState(true);
  const [ret, setRet] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [detailsTick, setDetailsTick] = React.useState(0); // bump to reload reconciliation + activities
  const [revAct, setRevAct] = React.useState(null); // { act, hours, comment } — per-activity review dialog
  const [mode, setMode] = React.useState('return');
  useWF();

  // Merge scoped employees with timesheet from DB & #attDaily punch calculations
  const list = React.useMemo(() => {
    const curUser = currentUser || window.__mghCurrentUser || (window.MGH_AUTH && window.MGH_AUTH.user);
    const empSource = (window.EMPLOYEES && window.EMPLOYEES.length > 0) ? window.EMPLOYEES : EMPLOYEES;
    const base = empSource.filter(emp => MGH_RBAC.canAny(['timesheets.view', 'timesheets.approve', 'payroll.generate'], emp));
    return base.map(emp => {
      const isCur = curUser && (
        curUser.employeeId === emp.id ||
        curUser.employee_id === emp.id ||
        curUser.id === emp.id ||
        (curUser.email && emp.email && curUser.email.toLowerCase() === emp.email.toLowerCase()) ||
        (emp.name && curUser.name && curUser.name.toLowerCase() === emp.name.toLowerCase())
      );
      let resolvedAvatar = (isCur && curUser.avatar) ? curUser.avatar : emp.avatar;
      if (resolvedAvatar && typeof resolvedAvatar === 'string' && (resolvedAvatar.includes('assets/avatars/') || resolvedAvatar.includes('person-') || resolvedAvatar.includes('carlos-mendez'))) {
        resolvedAvatar = null;
      }
      const ts = backendTimesheets.find(t => t.emp === emp.id && (t.period === periodCode || t.period === periodCode.replace('PP-', '')));
      const empPunches = backendPunches.filter(p => (p.emp || p.employee_id) === emp.id);
      let punchHours = 0, punchOt = 0;
      if (empPunches.length > 0) {
        punchHours = empPunches.reduce((s, p) => s + (Number(p.hours) || 0), 0);
        punchOt = empPunches.reduce((s, p) => s + (Number(p.overtime) || 0), 0);
      } else if (window.MGH_ATT) {
        const daysRange = window.MGH_ATT.range(curPeriod.start || curPeriod.startDate, curPeriod.end || curPeriod.endDate);
        daysRange.forEach(d => {
          const dData = window.MGH_ATT.day(emp.id, d);
          punchHours += dData.hours || 0;
          if (dData.hours > 8) punchOt += (dData.hours - 8);
        });
      }
      const punchReg = Math.max(0, punchHours - punchOt);
      const reg = ts ? Number(ts.reg) : punchReg;
      const ot = ts ? Number(ts.ot) : punchOt;
      const pto = ts ? Number(ts.pto) : 0.0;
      const total = ts ? Number(ts.total) : (reg + ot + pto);
      const status = ts ? ts.status : (emp.status || 'Draft');
      const rate = Number(emp.rate) || 0;
      const gross = +(reg * rate + ot * rate * 1.5 + pto * rate).toFixed(2);
      // Only the backend reconciliation (activities vs punches) gives a match %; otherwise it is not measured
      const mp = reconcil && reconcil.reconciliation && reconcil.reconciliation.matchPercentage;
      const match = ts && total > 0 && empActivities.length > 0 && emp.id === empId && typeof mp === 'number' ? mp : null;

      return {
        ...emp,
        avatar: resolvedAvatar,
        reg,
        ot,
        pto,
        total,
        gross,
        status,
        match,
        punchHours,
        punchOt,
        punchReg,
        history: ts ? ts.history : []
      };
    });
  }, [backendTimesheets, backendPunches, periodCode, curPeriod, empActivities.length, reconcil, empId, currentUser]);

  const [cur, setCur] = React.useState(() => {
    if (empId && list.some(x => x.id === empId)) return empId;
    return list[0] ? list[0].id : null;
  });

  const e = list.find(x => x.id === cur) || list[0];

  // Load employee reconciliation & activities when selected employee or period changes
  React.useEffect(() => {
    let active = true;
    async function loadEmployeeDetails() {
      if (!e) return;
      try {
        if (window.api) {
          const [recRes, actsRes] = await Promise.all([
            window.api.timesheetReconciliation(`TS-${periodCode}-${e.id}`).catch(() => null),
            window.api.activities({ empId: e.id, dateFrom: curPeriod.start || curPeriod.startDate, dateTo: curPeriod.end || curPeriod.endDate }).catch(() => [])
          ]);
          if (active) {
            setReconcil(recRes); // null when this employee has no sheet yet (never keep the previous employee's)
            setEmpActivities(actsRes || []);
          }
        }
      } catch (err) {
        console.warn('[ApprovalWorkspace] Error loading employee details:', err);
      }
    }
    loadEmployeeDetails();
    return () => { active = false; };
  }, [e && e.id, periodCode, curPeriod.start, curPeriod.end, detailsTick]);

  // (hooks must run before the early return below)
  const days = React.useMemo(() => buildDays(e, curPeriod, reconcil), [e && e.id, curPeriod, reconcil]);

  if (!e) return <div style={{ padding: 28 }}><PageHeader breadcrumbs={['Approvals', 'Approval Workspace']} title="Approval Workspace" description="No timesheets in your scope for this organization." /></div>;

  const rec = recOf(e.id), can = WF.canAct(rec), canPay = WF.canPay(rec), why = WF.whyNot(rec);
  const shown = days.filter(d => week === 'all' || d.week === +week);
  const filtered = list.filter(x => (filter === 'all' || (filter === 'ot' && x.ot > 0) || (filter === 'jira' && lowMatch(x)) || (filter === 'ready' && ['Ready', 'Approved'].includes(x.status))) && (!q || (x.name + x.id + x.project).toLowerCase().includes(q.toLowerCase())));
  const jiraTotal = days.reduce((s, d) => s + (Number(d.jira) || 0), 0);
  const clockTotal = days.reduce((s, d) => s + (Number(d.hrs) || 0), 0);

  const setStatus = (id, s) => {
    setBackendTimesheets(prev => prev.map(t => t.emp === id ? { ...t, status: s } : t));
  };

  const next = () => {
    const i = filtered.findIndex(x => x.id === e.id);
    const n = filtered[(i + 1) % filtered.length];
    if (n) setCur(n.id);
  };

  const approve = async adv => {
    // Local permission check first (no mutation), then the backend decides; the local engine mirrors only on success
    if (!WF.canAct(rec)) { notify(WF.whyNot(rec) || 'No puedes aprobar este paso'); return; }
    let saved = null;
    try {
      if (window.api) {
        await window.api.ensureTimesheet(e.id, periodCode, e.name);
        saved = await window.api.approveTimesheet(`TS-${periodCode}-${e.id}`, {
          comment: '', // the approval itself is recorded in the history; comments are only what a reviewer types
          role: WF.role
        });
      }
    } catch (err) {
      notify('No se pudo aprobar • ' + err.message);
      return;
    }
    const r = WF.approve(rec, '');
    notify(`${e.name} aprobado • ${r.next ? 'Enviado a aprobación del Dueño' : 'Listo para pago y dispersión bancaria'}`);
    // The backend recomputes hours from the per-activity decisions: show what was actually approved
    if (saved && saved.id) setBackendTimesheets(prev => prev.some(t => t.id === saved.id) ? prev.map(t => t.id === saved.id ? saved : t) : [...prev, saved]);
    else setStatus(e.id, r.next ? 'Aprobación Dueño' : 'Approved');
    setDetailsTick(n => n + 1);
    if (adv) next();
  };

  const steps = WF.timeline(rec).map(t => ({ label: t.label, state: t.done ? 'done' : t.current ? 'current' : 'pending', status: t.meta ? fmtAt(t.meta) : t.current ? 'Current step' : '', meta: t.who || '' }));
  const otPay = e.ot * e.rate * 1.5, regPay = e.reg * e.rate, ptoPay = e.pto * e.rate;
  const calc = DEDUCT(e), ded = calc.exempt ? [['Tax deductions — Exempt', 0]] : calc.lines;
  const net = calc.net;

  // Real attachments extracted from activities and reconciliation
  const files = (() => { // plain computation: this runs after an early return, so it must not be a hook
    const fromActs = (empActivities || []).flatMap(a => a.files || []);
    const fromRec = (reconcil?.reconciliation?.days || []).flatMap(d => (d.activities || []).flatMap(a => a.files || []));
    const all = [...fromActs, ...fromRec];
    const unique = [];
    const seen = new Set();
    for (const f of all) {
      if (f && f.name && !seen.has(f.name)) {
        seen.add(f.name);
        const sizeStr = f.size || '—';
        const ic = f.name.endsWith('.pdf') ? 'picture_as_pdf' : f.name.endsWith('.csv') ? 'table_view' : 'description';
        unique.push([f.name, sizeStr, ic, f.url || '#']);
      }
    }
    return unique;
  })();

  // Dynamic header metrics (no placeholders)
  const isUnderReview = s => ['Submitted', 'Supervisión PM', 'Aprobación Dueño', 'In Review', 'Under Review', 'Ready'].includes(s);
  const pendingCount = list.filter(x => isUnderReview(x.status)).length;
  const approvedCount = list.filter(x => x.status === 'Approved' || x.status === 'Paid').length;
  const onTrackPct = list.length > 0 ? Math.round((approvedCount / list.length) * 100) : 0;

  const totalHoursUnderReview = list.filter(x => isUnderReview(x.status)).reduce((s, x) => s + (Number(x.total) || 0), 0);
  const totalRegUnderReview = list.filter(x => isUnderReview(x.status)).reduce((s, x) => s + (Number(x.reg) || 0), 0);
  const totalOtUnderReview = list.filter(x => isUnderReview(x.status)).reduce((s, x) => s + (Number(x.ot) || 0), 0);

  const totalGrossObligation = list.reduce((s, x) => s + (Number(x.gross) || 0), 0);
  const totalNetObligation = list.reduce((s, x) => {
    const c = DEDUCT(x);
    return s + (Number(c.net ?? x.gross) || 0);
  }, 0);
  const avgRate = list.length > 0 ? (list.reduce((s, x) => s + (Number(x.rate) || 0), 0) / list.length).toFixed(1) : '0';

  const discrepanciesCount = list.filter(x => lowMatch(x) || (x.ot > 8)).length;

  // Comments feed from real timesheet history
  const historyComments = (reconcil?.timesheet?.history || rec?.history || [])
    .filter(h => h.comment && String(h.comment).trim())
    .map(h => ({
      person: h.actor || 'Approver',
      title: `${h.actor || 'Approver'} • ${h.role || 'Reviewer'}`,
      time: h.at ? fmtAt(h.at) : 'Reciente',
      body: `"${h.comment}"`
    }));

  const commentsList = [...historyComments].reverse();

  const sheetId = `TS-${periodCode}-${e.id}`;
  // Comments are stored in the sheet history, so the employee and the next reviewer see them
  const postComment = async () => {
    if (!comment.trim()) return;
    try {
      await window.api.addTimesheetComment(sheetId, comment.trim());
      setComment('');
      setDetailsTick(n => n + 1);
      notify('Comentario añadido a la hoja');
    } catch (err) { notify('No se pudo guardar el comentario • ' + err.message); }
  };

  // Per-activity decision (PM step only): all hours, part of them (reason required) or none
  const reviewOpen = /Review|Revisión|Supervisión/i.test(String(reconcil?.timesheet?.status || e.status)) && (rec.stepIdx || 0) === 0 && can;
  const saveActivityReview = async (act, approvedHours, note) => {
    try {
      await window.api.reviewActivity(sheetId, act.id, { approvedHours, comment: note || '', role: WF.role });
      setRevAct(null);
      setDetailsTick(n => n + 1);
      notify(approvedHours >= act.hours ? 'Actividad aprobada' : approvedHours > 0 ? 'Aprobación parcial registrada' : 'Horas de la actividad rechazadas');
    } catch (err) { notify('No se pudo guardar la revisión • ' + err.message); }
  };
  const REVIEW_TONE = { approved: 'success', partial: 'warning', rejected: 'danger' };
  const REVIEW_LABEL = { approved: 'Aprobada', partial: 'Parcial', rejected: 'Rechazada' };
  const reviewedActs = empActivities.filter(a => a.reviewStatus);
  const approvedActHours = empActivities.reduce((s, a) => s + (a.reviewStatus ? Number(a.approvedHours) || 0 : Number(a.hours) || 0), 0);

  return <Page>
    <PageHeader
      breadcrumbs={['Workforce', 'Approvals', `Pay Period ${periodCode}`]}
      title="Bi-Weekly Approval Workspace"
      status={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Select
            size="sm"
            value={periodCode}
            onChange={x => setPeriodCode(v(x))}
            options={availablePeriods.map(p => ({ value: p.code, label: p.code }))}
          />
          <Badge tone="success" dot>{`${curPeriod.label || curPeriod.phase || periodCode}`}</Badge>
        </div>
      }
      actions={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 12, background: '#fff', boxShadow: 'var(--shadow-xs)' }}>
            <Icon name="cloud_sync" size={18} color="var(--mgh-accent)" />
            <div>
              <div className="mgh-label" style={{ color: 'var(--mgh-ink-2)' }}>Sincronización de Jornada</div>
              <div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>Hojas de tiempo • {periodCode}</div>
            </div>
          </div>
          <Button variant="secondary" icon="schedule" onClick={() => window.__mghGo('attDaily')}>Registro de Jornada (#attDaily)</Button>
        </>
      }
    />

    <Grid min={220}>
      <StatCard
        label="Pending Approvals"
        value={pendingCount}
        unit={`/ ${list.length} Employees`}
        icon="how_to_reg"
        progress={onTrackPct}
        footer={<><span style={{ color: 'var(--mgh-primary)' }}>{onTrackPct}% On-Track</span><span>{approvedCount} Processed</span></>}
      />
      <StatCard
        label="Total Hours Under Review"
        value={fmtH(totalHoursUnderReview).replace('h', '')}
        unit="hrs"
        icon="schedule"
        tone="accent"
        footer={<><span>Reg: {fmtH(totalRegUnderReview)}</span><span style={{ color: 'var(--mgh-warning)' }}>OT: {fmtH(totalOtUnderReview)}</span></>}
      />
      <StatCard
        label="Estimated Payroll Obligation"
        value={fmt$(totalGrossObligation)}
        unit="USD"
        icon="payments"
        tone="success"
        footer={<><span style={{ color: 'var(--mgh-success)' }}>Net Est: {fmt$(totalNetObligation)}</span><span>Avg: ${avgRate}/h</span></>}
      />
      <StatCard
        label="Workday & Task Discrepancies"
        value={discrepanciesCount}
        unit="Flagged"
        icon="warning"
        tone={discrepanciesCount > 0 ? 'danger' : 'success'}
        footer={discrepanciesCount === 0 ? <span style={{ color: 'var(--mgh-ink-3)' }}>{list.some(hasMatch) ? 'Sin discrepancias detectadas' : 'Sin datos de conciliación'}</span> : <span style={{ color: 'var(--mgh-danger)' }}>Requiere revisión de supervisor</span>}
      />
    </Grid>

    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Queue */}
      <div style={{ width: 340, flexShrink: 0, position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--mgh-surface-page)', borderRadius: 16, padding: 14, maxHeight: 'calc(100vh - 104px)' }}>
        <SearchField value={q} onChange={setQ} placeholder="Buscar por empleado, ID, o proyecto..." style={{ background: '#fff' }} />
        <FilterChips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All', count: list.length }, { value: 'ot', label: 'Overtime', count: list.filter(x => x.ot).length, tone: 'warning' }, { value: 'jira', label: 'Jira Mismatch', count: list.filter(lowMatch).length, tone: 'danger' }, { value: 'ready', label: 'Ready' }]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#fff', borderRadius: 8 }}>
          <Checkbox checked={sel.length === filtered.length && sel.length > 0} indeterminate={sel.length > 0 && sel.length < filtered.length} onChange={() => setSel(sel.length === filtered.length ? [] : filtered.map(x => x.id))} label={`Select All (${filtered.length})`} />
          {MGH_RBAC.can('timesheets.approve') && <Button size="sm" variant="ghost" icon="done_all" disabled={!sel.length} onClick={async () => {
            // Count an approval only when the backend accepted it; the local workflow mirrors it afterwards
            let ok = 0; const failed = [];
            for (const id of sel) {
              const empObj = list.find(x => x.id === id);
              try {
                await window.api.ensureTimesheet(id, periodCode, empObj ? empObj.name : id);
                await window.api.approveTimesheet(`TS-${periodCode}-${id}`, { comment: '', role: WF.role });
                WF.approve(recOf(id), '');
                ok++;
              } catch (err) { failed.push(id + ': ' + err.message); }
            }
            notify(failed.length ? `${ok} de ${sel.length} aprobados • ${failed.length} fallaron (${failed[0]})` : `${ok} de ${sel.length} aprobados correctamente.`);
            setSel([]);
          }}>Bulk Approve</Button>}
        </div>
        <div className="mgh-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: 2, margin: -2 }}>
          {filtered.map(x => <QueueCard key={x.id} e={{ ...x, status: liveStatus(x) }} active={x.id === e.id} checked={sel.includes(x.id)} onCheck={() => setSel(s => s.includes(x.id) ? s.filter(i => i !== x.id) : [...s, x.id])} onClick={() => setCur(x.id)} />)}
          {!filtered.length && <div style={{ padding: 28, textAlign: 'center', font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>No hay empleados en este filtro.</div>}
        </div>
        <div style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink-2)', padding: '0 4px' }}>Mostrando {filtered.length} de {list.length} empleados</div>
      </div>

      {/* Review pane */}
      <div style={{ flex: 1, minWidth: 0, background: 'var(--mgh-surface-page)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ background: '#fff', padding: 24, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar src={e.avatar} name={e.name} size={72} />
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span className="mgh-h2">{e.name}</span><Badge tone="dark" mono>{e.id}</Badge><Badge tone={STATUS_TONE[e.status]} dot>{e.status}</Badge></div>
            <div style={{ font: '400 16px/22px var(--font-sans)', color: 'var(--mgh-ink-2)', marginTop: 2 }}>{e.role || '—'} • Departamento: {e.dept || '—'}</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Icon name="location_on" size={16} />{e.loc || '—'}</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Icon name="supervisor_account" size={16} />Manager: <b style={{ color: 'var(--mgh-ink)' }}>{e.mgr || '—'}</b></span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Icon name="work" size={16} />{e.type || '—'}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mgh-overline">Tarifa por hora</div>
            <div style={{ font: '800 28px/36px var(--font-sans)', letterSpacing: '-0.56px', color: 'var(--mgh-ink)' }}>{fmt$(e.rate)}<span style={{ font: '500 14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}> / hr</span></div>
            {hasMatch(e) ? <Badge tone={e.match >= 95 ? 'success' : 'danger'} icon={e.match >= 95 ? 'verified' : 'sync_problem'}>{e.match >= 95 ? 'Conciliación Ponches vs Tareas OK' : 'Discrepancia ' + (100 - e.match).toFixed(1) + '%'}</Badge> : <Badge tone="neutral" icon="help">Sin conciliación</Badge>}
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card padding={20} title={<span className="mgh-overline">Protocolo de Doble Verificación Quincenal • 1. Supervisión PM → 2. Aprobación Dueño & Pago</span>}>
            <Stepper steps={steps} />
            <div style={{ display: 'flex', gap: 12, marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--mgh-surface-1)', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge tone={rec.stepIdx >= 1 || rec.status === 'Approved' ? 'success' : 'warning'} icon={rec.stepIdx >= 1 || rec.status === 'Approved' ? 'verified' : 'pending'}>
                Paso 1: Supervisión PM ({rec.stepIdx >= 1 || rec.status === 'Approved' ? 'Aprobado • Horas Validadas' : 'Awaiting PM Review'})
              </Badge>
              <Icon name="arrow_forward" size={16} color="var(--mgh-ink-3)" />
              <Badge tone={rec.status === 'Approved' ? 'success' : (rec.stepIdx === 1 ? 'warning' : 'neutral')} icon={rec.status === 'Approved' ? 'paid' : 'schedule'}>
                Paso 2: Aprobación Dueño & Pago ({rec.status === 'Approved' ? 'Aprobado • Listo para Dispersión' : (rec.stepIdx === 1 ? 'Awaiting Owner Approval' : 'Pendiente de Paso 1')})
              </Badge>
              {reconcil && reconcil.reconciliation && (
                <span style={{ marginLeft: 'auto', font: '600 12px var(--font-sans)', color: reconcil.reconciliation.isCompliant ? 'var(--mgh-success)' : 'var(--mgh-warning)' }}>
                  Auditoría de Entregables: {reconcil.reconciliation.matchPercentage}% Cobertura ({reconcil.reconciliation.totalActivityHours}h en actividades registradas)
                </span>
              )}
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
            <MetricTile tone="white" label="Regular (Ponches)" value={fmtH(e.reg)} />
            <MetricTile tone={e.ot ? 'warning' : 'white'} label="Overtime (Ponches)" value={fmtH(e.ot)} />
            <MetricTile tone="white" label="PTO / Leave" value={fmtH(e.pto)} />
            <MetricTile tone="white" label="Feriados" value={fmtH((() => { const A = window.MGH_ATT; if (!A || !e || !curPeriod.startDate) return 0; return A.range(curPeriod.startDate, curPeriod.endDate).filter(d => A.dow(d) % 6 && A.holidays(e.entity).some(h => h.date === d && !h.working)).length * A.rulesFor(e.entity).shift; })())} />
            <MetricTile tone="success" label="Horas Tareas" value={fmtH(jiraTotal)} />
            <MetricTile tone="white" label="Tiempo no facturable" value={fmtH(Math.max(0, clockTotal - jiraTotal))} />
            <MetricTile tone="white" label="Total Quincena" value={fmtH(e.total)} />
            <MetricTile tone="dark" label="Est. Gross" value={fmt$(e.gross)} />
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card padding={20} title="Desglose Diario y Conciliación con Registros de Jornada (#attDaily)" icon="calendar_month" actions={<><Tabs value={week} onChange={setWeek} tabs={[{ value: 'all', label: '14 días' }, { value: '1', label: 'Semana 1' }, { value: '2', label: 'Semana 2' }]} style={{ padding: 3 }} /></>} bodyStyle={{ paddingTop: 14 }}>
                <DataTable maxHeight={460} density="compact" rowKey="id" rows={shown} columns={[
                  { key: 'date', label: 'Fecha y Jornada', strong: true, weight: 600, render: d => <div><div style={{ color: d.weekend ? 'var(--mgh-ink-4)' : 'var(--mgh-ink)' }}>{d.date}</div><div style={{ font: '500 11px/14px var(--font-sans)', color: d.ot ? 'var(--mgh-warning)' : 'var(--mgh-ink-3)' }}>{d.note}</div></div> },
                  { key: 'inn', label: 'Entrada / Salida (Ponches #attDaily)', render: d => d.weekend ? <span style={{ color: 'var(--mgh-ink-4)' }}>—</span> : <span style={{ fontFamily: 'var(--font-mono)' }}>{d.inn} – {d.out}</span> },
                  { key: 'hrs', label: 'Horas Jornada', align: 'right', render: d => d.weekend ? '—' : <span><b style={{ color: 'var(--mgh-ink)' }}>{d.hrs.toFixed(1)}h</b>{d.ot > 0 && <span style={{ color: 'var(--mgh-warning)' }}> ({d.ot.toFixed(1)} OT)</span>}</span> },
                  { key: 'key', label: 'Tarea / Ticket Asociado', render: d => d.key ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge mono size="sm" tone="primary">{d.key}</Badge><span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.task}</span></div> : <span style={{ color: 'var(--mgh-ink-4)' }}>{d.weekend ? '—' : 'Sin ticket'}</span> },
                  { key: 'jira', label: 'Horas Tareas', align: 'right', render: d => d.weekend ? '—' : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: d.jira !== d.hrs ? 'var(--mgh-danger)' : 'var(--mgh-ink)' }}>{d.jira.toFixed(1)}h<Icon name={d.jira !== d.hrs ? 'error' : 'check_circle'} size={14} color={d.jira !== d.hrs ? 'var(--mgh-danger)' : 'var(--mgh-success)'} /></span> },
                ]} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, padding: '12px 14px 0', font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500, color: 'var(--mgh-ink-3)' }}>Fuente de horas: Ponches de jornada de #attDaily</span>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <span>Total Ponches: <b>{fmtH(clockTotal)}</b></span>
                    <span style={{ color: 'var(--mgh-success)' }}>Total Tareas: <b>{fmtH(jiraTotal)}</b></span>
                  </div>
                </div>
              </Card>

              <Card padding={20} icon="fact_check" title="Revisión de Actividades" subtitle={reviewOpen ? 'Aprueba, aprueba parcialmente o rechaza las horas de cada actividad. Lo que no revises se aprueba completo al aprobar la hoja.' : 'Decisiones del PM sobre cada actividad reportada'}>
                {!empActivities.length ? (
                  <div style={{ padding: 14, font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-3)', textAlign: 'center' }}>No hay actividades registradas en esta quincena.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {empActivities.map(a => (
                      <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: 'var(--mgh-surface-1)', flexWrap: 'wrap' }}>
                        <div style={{ width: 84, flexShrink: 0, font: '600 12px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>{a.date}</div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            {a.jiraKey && <Badge mono size="sm" tone="primary">{a.jiraKey}</Badge>}
                            <span style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{a.jiraSummary || a.workType || 'Actividad'}</span>
                            {a.reviewStatus && <Badge size="sm" tone={REVIEW_TONE[a.reviewStatus]}>{REVIEW_LABEL[a.reviewStatus]}</Badge>}
                          </div>
                          {a.description && <div style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)', marginTop: 2 }}>{a.description}</div>}
                          {a.reviewComment && <div style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)', marginTop: 4, display: 'flex', gap: 4 }}><Icon name="comment" size={14} />{a.reviewComment}{a.reviewedBy ? ' — ' + a.reviewedBy : ''}</div>}
                        </div>
                        <div style={{ textAlign: 'right', font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)', minWidth: 70 }}>
                          {a.reviewStatus && Number(a.approvedHours) !== Number(a.hours) ? <><s style={{ color: 'var(--mgh-ink-4)', fontWeight: 500 }}>{fmtH(a.hours)}</s> {fmtH(a.approvedHours)}</> : fmtH(a.hours)}
                        </div>
                        {reviewOpen && <div style={{ display: 'flex', gap: 4 }}>
                          <IconButton icon="check" size={28} title="Aprobar todas las horas" onClick={() => saveActivityReview(a, Number(a.hours), '')} />
                          <IconButton icon="rule" size={28} title="Aprobar parcialmente" onClick={() => setRevAct({ act: a, hours: String(a.reviewStatus ? a.approvedHours : a.hours), comment: a.reviewComment || '' })} />
                          <IconButton icon="block" size={28} title="Rechazar las horas" onClick={() => setRevAct({ act: a, hours: '0', comment: a.reviewComment || '' })} />
                        </div>}
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px 0', font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ color: 'var(--mgh-ink-3)', fontWeight: 500 }}>{reviewedActs.length} de {empActivities.length} actividades revisadas</span>
                      <span>Horas a aprobar: <b>{fmtH(approvedActHours)}</b> de {fmtH(empActivities.reduce((s, a) => s + (Number(a.hours) || 0), 0))}</span>
                    </div>
                  </div>
                )}
              </Card>

              <Card padding={20} icon="sync_alt" title="Agile & Jira Worklogs by Task" subtitle="Conciliación de horas contra registros de jornada (#attDaily)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(() => {
                    const taskMap = days.filter(d => d.key).reduce((m, d) => {
                      const k = d.key + '::' + (d.task || 'Tarea');
                      m[k] = (m[k] || 0) + (Number(d.jira) || 0);
                      return m;
                    }, {});
                    const entries = Object.entries(taskMap);
                    if (!entries.length) {
                      return <div style={{ padding: 14, font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-3)', textAlign: 'center' }}>No hay actividades de tickets registradas para este periodo.</div>;
                    }
                    return entries.map(([k, h]) => {
                      const [key, taskSummary] = k.split('::');
                      const pct = jiraTotal > 0 ? Math.min(100, Math.round((h / jiraTotal) * 100)) : 0;
                      return (
                        <div key={k} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 160px 56px', gap: 12, alignItems: 'center' }}>
                          <Badge mono size="sm" tone="primary">{key}</Badge>
                          <span style={{ font: '500 13px var(--font-sans)', color: 'var(--mgh-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskSummary}</span>
                          <ProgressBar value={pct} tone="accent" />
                          <span style={{ font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)', textAlign: 'right' }}>{h.toFixed(1)}h</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Card>
            </div>

            <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card padding={20} icon="payments" title="Resumen de Nómina" subtitle={`Estimado para ${periodCode}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, font: '500 13px/18px var(--font-sans)' }}>
                  {[['Regular ' + fmtH(e.reg) + ' × ' + fmt$(e.rate), regPay], ['Overtime ' + fmtH(e.ot) + ' × 1.5', otPay], ['PTO ' + fmtH(e.pto), ptoPay]].map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l}</span><b style={{ color: 'var(--mgh-ink)' }}>{fmt$(v)}</b></div>)}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--mgh-surface-2)', font: '700 14px var(--font-sans)', color: 'var(--mgh-ink)' }}><span>Salario Bruto (Gross)</span><span>{fmt$(e.gross)}</span></div>
                  {ded.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--mgh-ink-3)' }}><span>{l}</span><span>−{fmt$(v)}</span></div>)}
                  <div style={{ marginTop: 6, padding: 12, borderRadius: 8, background: 'var(--mgh-navy)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="mgh-overline" style={{ color: 'var(--mgh-nav-text)' }}>Neto Estimado</span><span style={{ font: '800 20px var(--font-sans)' }}>{fmt$(net)}</span></div>
                </div>
              </Card>

              <Card padding={20} icon="attach_file" title="Archivos y Entregables" subtitle="Evidencias adjuntas en el registro por actividades">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!files.length ? (
                    <div style={{ padding: 14, font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-3)', textAlign: 'center' }}>No hay archivos adjuntos en esta quincena.</div>
                  ) : (
                    files.map(([n, s, ic, url]) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--mgh-surface-1)' }}>
                        <Icon name={ic} size={18} color="var(--mgh-primary)" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</div>
                          <div style={{ font: '400 11px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{s}</div>
                        </div>
                        <IconButton icon="download" size={28} title="Descargar" disabled={!url} onClick={() => url ? window.open(url, '_blank', 'noopener') : notify('Archivo no disponible')} />
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card padding={20} icon="forum" title="Notas y Comentarios">
                <ActivityFeed connector={false} items={commentsList} />
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <input
                    value={comment}
                    onChange={x => setComment(x.target.value)}
                    placeholder="Añadir comentario o instrucción de revisión…"
                    style={{ flex: 1, minWidth: 0, height: 36, border: 'none', outline: 'none', borderRadius: 8, padding: '0 12px', background: 'var(--mgh-surface-1)', font: '400 13px var(--font-sans)' }}
                  />
                  <Button size="sm" icon="send" disabled={!comment.trim()} onClick={postComment}>Post</Button>
                </div>
              </Card>

              <Card padding={20} icon="history" title="Historial de Transición">
                <ActivityFeed items={[...rec.history].reverse().map(h => ({ icon: /Return|Reject/.test(h.to) ? 'undo' : h.to === 'Paid' ? 'paid' : h.to === 'Submitted' ? 'send' : 'task_alt', tone: /Return|Reject/.test(h.to) ? 'danger' : 'success', title: h.from + ' → ' + h.to + (h.comment ? ' • "' + h.comment + '"' : ''), meta: (h.actor || 'Usuario') + (h.role && h.role !== 'System' ? ' (' + h.role + ')' : '') + ' • ' + fmtAt(h.at) }))} />
              </Card>
            </div>
          </div>
        </div>

        {/* Sticky decision bar */}
        <div style={{ position: 'sticky', bottom: 0, background: 'rgba(226,231,255,.92)', backdropFilter: 'blur(16px)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Checkbox checked={sign} onChange={setSign} label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="signature" size={16} color="var(--mgh-primary)" />Firma Electrónica ({WF.person()}, {WF.role})</span>} />
          <WFPill status={rec.status} />
          {why && <span style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>{why}</span>}
          <span style={{ flex: 1 }} />
          <Button variant="outline" size="sm" icon="picture_as_pdf" onClick={() => window.print()}>Imprimir / PDF</Button>
          {!can && !canPay ? null : canPay ? <Button size="lg" icon="paid" iconRight="arrow_forward" onClick={() => window.__mghGo('processing')}>Pagar desde la corrida de nómina</Button> : <>
          <Button variant="outline" icon="block" onClick={() => { setMode('reject'); setRet(true); }}>Rechazar</Button>
          <Button variant="danger" icon="undo" onClick={() => { setMode('return'); setRet(true); }}>Devolver para Correcciones</Button>
          <Button variant="outline" icon="check" disabled={!sign || !can} onClick={() => approve(false)}>Solo Aprobar</Button>
          <Button size="lg" icon="task_alt" iconRight="arrow_forward" disabled={!sign || !can} onClick={() => approve(true)}>{rec.stepIdx === 0 ? 'Aprobar Actividades y Pasar a Dueño' : 'Aprobación Final de Dueño & Autorizar Nómina'}</Button></>}
        </div>
      </div>
    </div>

    <Modal open={ret} title={`${mode === 'reject' ? 'Rechazar' : 'Devolver'} la jornada de ${e.name}`} onClose={() => setRet(false)} actions={<><Button variant="outline" onClick={() => setRet(false)}>Cancelar</Button><Button variant="danger" icon={mode === 'reject' ? 'block' : 'undo'} disabled={!reason.trim()} onClick={async () => {
      if (!WF.canAct(rec)) { notify(WF.whyNot(rec) || 'No puedes actuar en este paso'); return; }
      // Backend first: only a sheet under review can be returned. Rejection has no backend state yet → returned too.
      try {
        if (window.api) {
          const tsId = `TS-${periodCode}-${e.id}`;
          await window.api.ensureTimesheet(e.id, periodCode, e.name);
          await window.api.returnTimesheet(tsId, { comment: reason });
        }
      } catch (err) {
        notify('No se pudo devolver • ' + err.message);
        return;
      }
      const r = mode === 'reject' ? WF.reject(rec, reason) : WF.returnToEmployee(rec, reason);
      setRet(false);
      setReason('');
      setStatus(e.id, 'Returned');
      notify(r.ok ? (mode === 'reject' ? 'Timesheet rechazada' : 'Devuelta al empleado para correcciones • edición reabierta') : r.msg);
    }}>{mode === 'reject' ? 'Rechazar Jornada' : 'Devolver Jornada'}</Button></>}>
      <p className="mgh-body" style={{ margin: 0 }}>{mode === 'reject' ? 'Las hojas rechazadas quedan cerradas permanentemente.' : <>El empleado recibirá una notificación para ajustar sus horas o actividades de jornada y reenviar para revisión.</>}</p>
      <textarea value={reason} onChange={x => setReason(x.target.value)} placeholder="Motivo de devolución (requerido): qué debe corregir el colaborador." rows={4} style={{ border: 'none', outline: 'none', borderRadius: 8, padding: 12, background: 'var(--mgh-surface-1)', font: '400 13px/18px var(--font-sans)', resize: 'vertical' }} />
    </Modal>

    {revAct && (() => {
      const max = Number(revAct.act.hours) || 0, h = Number(revAct.hours);
      const valid = revAct.hours !== '' && h >= 0 && h <= max && (h >= max || revAct.comment.trim());
      return <Modal open title={`Revisar actividad del ${revAct.act.date}`} onClose={() => setRevAct(null)} actions={<><Button variant="outline" onClick={() => setRevAct(null)}>Cancelar</Button><Button icon="save" disabled={!valid} onClick={() => saveActivityReview(revAct.act, h, revAct.comment.trim())}>{h <= 0 ? 'Rechazar horas' : h < max ? 'Aprobar parcialmente' : 'Aprobar'}</Button></>}>
        <p className="mgh-body" style={{ margin: 0 }}>{revAct.act.jiraKey ? revAct.act.jiraKey + ' • ' : ''}{revAct.act.description || revAct.act.jiraSummary || 'Actividad'} — reportó <b>{fmtH(max)}</b>.</p>
        <TextField label={`Horas aprobadas (0 – ${max})`} type="number" value={revAct.hours} onChange={x => setRevAct(r => ({ ...r, hours: v(x) }))} />
        <textarea value={revAct.comment} onChange={x => setRevAct(r => ({ ...r, comment: x.target.value }))} placeholder="Motivo (requerido si apruebas menos de lo reportado). El empleado lo verá en su historial." rows={3} style={{ border: 'none', outline: 'none', borderRadius: 8, padding: 12, background: 'var(--mgh-surface-1)', font: '400 13px/18px var(--font-sans)', resize: 'vertical' }} />
      </Modal>;
    })()}
  </Page>;
}

function TeamApprovalQueue({ go, notify }) {
  useWF();
  const activeQuincena = getCurrentPeriod();
  const availablePeriods = React.useMemo(() => [
    { code: activeQuincena.code, label: `${activeQuincena.code} (${activeQuincena.rangeShort || activeQuincena.range || ''})`, phase: activeQuincena.phase || 'Periodo Actual • En Curso', start: activeQuincena.startDate, end: activeQuincena.endDate, startDate: activeQuincena.startDate, endDate: activeQuincena.endDate, daysRemaining: activeQuincena.daysRemaining },
    ...window.__mghPrevPeriods(activeQuincena, 2),
  ], [activeQuincena.code]);

  const [periodCode, setPeriodCode] = React.useState(activeQuincena.code);
  const curPeriod = availablePeriods.find(p => p.code === periodCode) || activeQuincena;

  const [backendTimesheets, setBackendTimesheets] = React.useState([]);
  const [backendPunches, setBackendPunches] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    async function loadQueueData() {
      setIsLoading(true);
      try {
        if (window.api) {
          const [tsList, punchesList] = await Promise.all([
            window.api.timesheets({ periodId: periodCode }).catch(() => []),
            window.api.punches({ dateFrom: curPeriod.start || curPeriod.startDate, dateTo: curPeriod.end || curPeriod.endDate }).catch(() => [])
          ]);
          if (active) {
            setBackendTimesheets(tsList || []);
            setBackendPunches(punchesList || []);
            if (window.MGH_WF && window.MGH_WF.syncFromBackend && Array.isArray(tsList)) {
              window.MGH_WF.syncFromBackend(tsList);
            }
          }
        }
      } catch (err) {
        console.warn('[TeamQueue] Error loading timesheets:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadQueueData();
    return () => { active = false; };
  }, [periodCode, curPeriod.start, curPeriod.end]);

  const rows = React.useMemo(() => {
    const base = EMPLOYEES.filter(e => MGH_RBAC.canAny(['timesheets.view', 'timesheets.approve'], e));
    return base.map(emp => {
      const ts = backendTimesheets.find(t => t.emp === emp.id && (t.period === periodCode || t.period === periodCode.replace('PP-', '')));
      const empPunches = backendPunches.filter(p => (p.emp || p.employee_id) === emp.id);
      let punchHours = 0, punchOt = 0;
      if (empPunches.length > 0) {
        punchHours = empPunches.reduce((s, p) => s + (Number(p.hours) || 0), 0);
        punchOt = empPunches.reduce((s, p) => s + (Number(p.overtime) || 0), 0);
      }
      const punchReg = Math.max(0, punchHours - punchOt);
      const reg = ts ? Number(ts.reg) : punchReg;
      const ot = ts ? Number(ts.ot) : punchOt;
      const pto = ts ? Number(ts.pto) : 0.0;
      const total = ts ? Number(ts.total) : (reg + ot + pto);
      const status = ts ? ts.status : (emp.status || 'Draft');
      const rate = Number(emp.rate) || 0;
      const gross = +(reg * rate + ot * rate * 1.5 + pto * rate).toFixed(2);
      const match = hasMatch(emp) ? emp.match : null;
      const rec = WF ? WF.get(emp.id, periodCode) || { emp: emp.id, status, stepIdx: -1 } : { emp: emp.id, status, stepIdx: -1 };

      return {
        ...emp,
        reg,
        ot,
        pto,
        total,
        gross,
        status,
        match,
        rec,
        flagged: ot > 8 || (typeof match === 'number' && match < 95)
      };
    });
  }, [backendTimesheets, backendPunches, periodCode]);

  const isPend = s => /Review|Submitted|Supervisión|Aprobación/.test(s);
  const [chip, setChip] = React.useState('all');
  const [dept, setDept] = React.useState('All departments');

  const filteredBase = rows.filter(r => (chip === 'all' || (chip === 'pending' && isPend(r.status)) || (chip === 'flag' && r.flagged) || (chip === 'done' && (r.status === 'Approved' || r.status === 'Paid'))) && (dept === 'All departments' || r.dept === dept));
  const t = useTable(filteredBase, { search: ['name', 'id', 'project', 'role'], pageSize: 8, initialSort: { key: 'name', dir: 'asc' } });

  const bulk = async s => {
    if (s !== 'Approved') { notify('Returning requires a reason • open each timesheet to return it'); return; }
    // Backend first; only count what the server approved
    let ok = 0; const failed = [];
    for (const id of t.sel) {
      const r = rows.find(x => x.id === id);
      if (!r) continue;
      try {
        await window.api.ensureTimesheet(id, periodCode, r.name);
        await window.api.approveTimesheet(`TS-${periodCode}-${id}`, { comment: '', role: WF ? WF.role : undefined });
        if (WF && r.rec) WF.approve(r.rec, '');
        ok++;
      } catch (err) { failed.push(id + ': ' + err.message); }
    }
    notify(failed.length ? `${ok} de ${t.sel.length} aprobados • ${failed.length} fallaron (${failed[0]})` : `${ok} de ${t.sel.length} aprobados correctamente.`);
    t.setSel([]);
  };

  const awaitingCount = rows.filter(r => isPend(r.status) && WF && WF.canAct(r.rec)).length;
  const flaggedCount = rows.filter(r => r.flagged).length;
  const approvedCount = rows.filter(r => r.status === 'Approved' || r.status === 'Paid').length;
  const daysRem = curPeriod.daysRemaining != null ? (curPeriod.daysRemaining === 1 ? '1 día' : `${curPeriod.daysRemaining} días`) : 'En curso';

  return <Page>
    <PageHeader
      breadcrumbs={['Workforce', 'Approvals', 'Team Queue']}
      title="Team Approval Queue"
      description="Listado centralizado de hojas de tiempo de tu equipo según registros del periodo activo."
      status={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Select
            size="sm"
            value={periodCode}
            onChange={x => setPeriodCode(x && x.value ? x.value : x)}
            options={availablePeriods.map(p => ({ value: p.code, label: p.label || p.code }))}
          />
          <Badge tone="success" dot>{`${curPeriod.phase || 'Periodo Actual • En Curso'}`}</Badge>
        </div>
      }
      actions={
        <>
          <Button icon="assignment_turned_in" onClick={() => go('approvals')}>Open Workspace</Button>
        </>
      }
    />
    <Grid min={200}>
      <StatCard label="Awaiting you" value={awaitingCount} icon="hourglass_top" tone={awaitingCount > 0 ? 'warning' : 'neutral'} style={{ minHeight: 0 }} footer={<span>{awaitingCount === 0 ? 'Sin hojas pendientes de tu revisión' : `${awaitingCount} hojas esperando aprobación`}</span>} />
      <StatCard label="Flagged" value={flaggedCount} icon="flag" tone={flaggedCount > 0 ? 'danger' : 'success'} style={{ minHeight: 0 }} footer={<span>{flaggedCount === 0 ? '0 discrepancias detectadas' : `${flaggedCount} requieren revisión`}</span>} />
      <StatCard label="Approved this period" value={approvedCount} icon="task_alt" tone="success" style={{ minHeight: 0 }} footer={<span>{approvedCount} de {rows.length} procesadas</span>} />
      <StatCard label="SLA: due in" value={daysRem} icon="timer" tone="accent" style={{ minHeight: 0 }} footer={<span>Cierre: {curPeriod.endDate || curPeriod.end}</span>} />
    </Grid>
    <Card padding={20}>
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Buscar empleado, ID, proyecto…" filters={<><Select size="sm" icon="apartment" value={dept} onChange={setDept} options={['All departments', ...new Set(EMPLOYEES.map(e => e.dept).filter(Boolean))]} /></>} actions={<Button size="sm" variant="secondary" icon="download" disabled={!t.all.length} onClick={() => window.__mghNotify(window.__mghExport('csv', 'Team Approval Queue', periodCode, { cols: [['ID'], ['Employee'], ['Project'], ['Hours'], ['Est. gross'], ['Status']], rows: t.all.map(r => [r.id, r.name, r.project || '', (r.total || 0).toFixed(1), (r.gross || 0).toFixed(2), liveStatus(r)]) }))}>Export CSV</Button>}
        chips={<FilterChips value={chip} onChange={setChip} options={[{ value: 'all', label: 'All', count: rows.length }, { value: 'pending', label: 'In review', count: rows.filter(r => isPend(r.status)).length, tone: 'warning' }, { value: 'flag', label: 'Flagged', count: rows.filter(r => r.flagged).length, tone: 'danger' }, { value: 'done', label: 'Approved', count: approvedCount }]} />} />
      <DataTable style={{ marginTop: 14 }} maxHeight={520} selectable selected={t.sel} onSelectedChange={t.setSel} sort={t.sort} onSort={t.setSort} rows={t.rows} onRowClick={r => go('approvals', r.id)}
        bulkBar={<><Button size="sm" variant="primary" icon="done_all" onClick={() => bulk('Approved')}>Approve</Button><Button size="sm" variant="danger" icon="undo" onClick={() => bulk('Returned')}>Return</Button></>}
        columns={[
          { key: 'name', label: 'Employee', sortable: true, render: r => <EmployeeCell e={r} sub={r.id + ' • ' + r.dept} /> },
          { key: 'project', label: 'Project', sortable: true },
          { key: 'reg', label: 'Regular', align: 'right', sortable: true, render: r => fmtH(r.reg) },
          { key: 'ot', label: 'Overtime', align: 'right', sortable: true, render: r => <span style={{ color: r.ot > 8 ? 'var(--mgh-danger)' : r.ot ? 'var(--mgh-warning)' : undefined, fontWeight: r.ot ? 700 : 400 }}>{fmtH(r.ot)}</span> },
          { key: 'total', label: 'Total', align: 'right', sortable: true, strong: true, weight: 700, render: r => fmtH(r.total) },
          { key: 'match', label: 'Jira match', align: 'right', sortable: true, render: r => <Badge size="sm" dot tone={!hasMatch(r) ? 'neutral' : r.match >= 98 ? 'success' : r.match >= 93 ? 'warning' : 'danger'}>{matchTxt(r)}</Badge> },
          { key: 'gross', label: 'Est. gross', align: 'right', sortable: true, strong: true, render: r => fmt$(r.gross) },
          { key: 'status', label: 'Status', sortable: true, render: r => <WFPill size="sm" status={r.status} /> },
          { key: 'x', label: '', align: 'right', render: r => <IconButton icon="chevron_right" size={28} title="Review" /> }]} />
      <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="timesheets" />
    </Card>
  </Page>;
}

// Team view of the period's timesheets as stored in the backend (GET /timesheets?periodId=). Employees log their own
// time in My Time Entry; approvals happen in the Approval Workspace / Queue.
function BiWeeklyTimesheets({ notify, go }) {
  const curPeriod = getCurrentPeriod();
  const periods = React.useMemo(() => [{ code: curPeriod.code, label: curPeriod.code + ' (' + curPeriod.rangeShort + ', ' + curPeriod.year + ')' }, ...window.__mghPrevPeriods(curPeriod, 5)], [curPeriod.code]);
  const [periodCode, setPeriodCode] = React.useState(curPeriod.code);
  const [list, setList] = React.useState(null);
  React.useEffect(() => {
    let cancel = false; setList(null);
    window.api.timesheets({ periodId: periodCode })
      .then(r => { if (!cancel) setList((Array.isArray(r) ? r : []).filter(x => MGH_RBAC.can('timesheets.view', x.emp))); })
      .catch(err => { if (!cancel) { setList([]); notify('Could not load timesheets • ' + err.message); } });
    return () => { cancel = true; };
  }, [periodCode]);
  const rows = list || [];
  const sum = k => rows.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const withHours = rows.filter(x => Number(x.total) > 0).length;
  return <Page>
    <PageHeader breadcrumbs={['Workforce', 'Timesheets', periodCode]} title="Bi-Weekly Timesheets" description={list ? rows.length + ' timesheet' + (rows.length === 1 ? '' : 's') + ' • ' + withHours + ' with hours' : 'Loading…'}
      actions={<><Select size="sm" icon="date_range" value={periodCode} onChange={x => setPeriodCode(typeof x === 'string' ? x : x.target.value)} options={periods.map(p => ({ value: p.code, label: p.label }))} /><Button variant="secondary" icon="download" disabled={!rows.length} onClick={() => notify(window.__mghExport('csv', 'Timesheets', periodCode, { cols: [['ID'], ['Employee'], ['Regular'], ['Overtime'], ['PTO'], ['Total'], ['Status']], rows: rows.map(x => [x.emp, x.name, x.reg, x.ot, x.pto, x.total, x.status]) }))}>Export CSV</Button></>} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}><MetricTile tone="white" label="Regular" value={fmtH(sum('reg'))} /><MetricTile tone="white" label="Overtime" value={fmtH(sum('ot'))} /><MetricTile tone="white" label="PTO" value={fmtH(sum('pto'))} /><MetricTile tone="success" label="Total" value={fmtH(sum('total'))} /></div>
    <Card padding={20}>
      {list && !rows.length ? <div className="mgh-body" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--mgh-ink-3)' }}>No timesheets for {periodCode}.</div> :
      <DataTable density="compact" rows={rows} onRowClick={r => go && go('approvals', r.emp)} columns={[
        { key: 'name', label: 'Employee', render: r => <EmployeeCell e={EMPLOYEES.find(e => e.id === r.emp) || { id: r.emp, name: r.name }} sub={r.emp} /> },
        { key: 'reg', label: 'Regular', align: 'right', render: r => fmtH(r.reg) }, { key: 'ot', label: 'Overtime', align: 'right', render: r => fmtH(r.ot) },
        { key: 'pto', label: 'PTO', align: 'right', render: r => fmtH(r.pto) }, { key: 'total', label: 'Total', align: 'right', strong: true, render: r => fmtH(r.total) },
        { key: 'status', label: 'Status', render: r => <WFPill size="sm" status={r.status} /> }]} />}
    </Card>
  </Page>;
}

window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { approvals: ApprovalWorkspace, queue: TeamApprovalQueue, timesheets: BiWeeklyTimesheets });

})();

// ---- ScreensPeople.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, MetricTile, DataTable, TableToolbar, Pagination, ActivityFeed, Tabs, PageHeader, Select, ProgressBar, KeyValue, Toggle, TextField } = window.MyGlobalHubDesignSystem_2a603d;

function Dashboard({ go }) {
  useWF();
  const R = window.MGH_RBAC, me = R.me(), O = R.orgSettings();
  const E = EMPLOYEES.filter(e => R.can('dashboard.executive.view', e));
  const gross = E.reduce((s, e) => s + (e.gross || 0), 0), gk = gross / 1000;
  const pend = E.filter(e => WF && WF.canAct(recOf(e.id))).length;
  const inReview = E.filter(e => /Review|Submitted/.test(liveStatus(e))).length;
  const alerts = E.filter(e => lowMatch(e) || e.ot > 8).length;
  const measured = E.filter(hasMatch);
  const util = measured.length ? measured.reduce((s, e) => s + e.match, 0) / measured.length : null;
  const pal = ['var(--mgh-primary)', 'var(--mgh-accent)', 'var(--mgh-navy)', 'var(--mgh-success)', 'var(--mgh-ink-4)'];
  const byD = {}; E.forEach(e => { byD[e.dept] = (byD[e.dept] || 0) + (e.gross || 0); });
  let dl = Object.entries(byD).sort((a, b) => b[1] - a[1]); if (dl.length > 5) dl = [...dl.slice(0, 4), ['Other', dl.slice(4).reduce((s, x) => s + x[1], 0)]];
  const depts = dl.map(([l, v], i) => [l, gross ? Math.round(v / gross * 100) : 0, pal[i], v]);
  const first = (me.person || '').split(' ')[0];
  const curPeriod = getCurrentPeriod();
  // Trend = gross of the last 6 saved payroll runs (one bar per period); empty until payroll is actually run.
  const [runs, setRuns] = React.useState([]);
  React.useEffect(() => {
    let cancel = false;
    if (window.api && window.api.payrollRuns) window.api.payrollRuns().then(r => { if (!cancel && Array.isArray(r)) setRuns(r); }).catch(() => {});
    return () => { cancel = true; };
  }, []);
  const byPeriod = {}; runs.forEach(r => { byPeriod[r.period_id] = (byPeriod[r.period_id] || 0) + (Number(r.total_gross) || 0); });
  // Real status of the current quincena (stored period row); unknown until the backend answers
  const [storedPeriod, setStoredPeriod] = React.useState(null);
  React.useEffect(() => {
    let cancel = false;
    if (window.api && window.api.currentPeriod) window.api.currentPeriod().then(p => { if (!cancel && p && typeof p === 'object') setStoredPeriod(p); }).catch(() => {});
    return () => { cancel = true; };
  }, []);
  const trend = Object.keys(byPeriod).sort().slice(-6).map(p => ({ label: p, a: +(byPeriod[p] / 1000).toFixed(1), hi: p === curPeriod.code }));
  const timesheetCount = E.filter(e => e.hasTimesheet).length;
  const attention = EMPLOYEES.filter(e => e.hasTimesheet && liveStatus(e) !== 'Approved' && MGH_RBAC.can('timesheets.view', e)).slice(0, 5);
  const daysRemText = curPeriod.daysRemaining === 1 ? '1 día' : `${curPeriod.daysRemaining} días`;
  const periodDesc = `${curPeriod.code} (${curPeriod.rangeShort}, ${curPeriod.year}) cierra en ${daysRemText} • ${O.id.replace(/\.$/, '')}. ` + (pend ? pend + ' timesheet' + (pend === 1 ? ' still needs' : 's still need') + ' your approval before Finance Run.' : inReview + ' timesheet' + (inReview === 1 ? '' : 's') + ' in review • none waiting on you.');
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches';
  const PERIOD_STATUS_ES = { Draft: 'Borrador', Open: 'Abierto', Processing: 'En procesamiento', Approved: 'Aprobado', Paid: 'Pagado', Closed: 'Cerrado', Archived: 'Archivado' };
  const periodStatus = storedPeriod && storedPeriod.status ? (PERIOD_STATUS_ES[storedPeriod.status] || storedPeriod.status) : null;
  const reviewMeta = (periodStatus ? 'Estado del período: ' + periodStatus : 'Estado del período no disponible') + ' • ' + inReview + ' en revisión';
  return <Page>
    <PageHeader breadcrumbs={['Overview']} title={greet + (first ? ', ' + first : '')} description={periodDesc} actions={<><Button variant="secondary" icon="calendar_month" onClick={() => (window.__mghGo ? window.__mghGo('periods') : go('periods'))}>{curPeriod.rangeShort}</Button>{R.canRoute('approvals') && <Button icon="assignment_turned_in" onClick={() => go('approvals')}>{pend ? 'Review ' + pend + ' Approval' + (pend === 1 ? '' : 's') : 'Open Approvals'}</Button>}</>} />
    <Grid min={220}>
      <StatCard label="Active workforce" value={String(E.length)} unit="employees" icon="groups" footer={O.short + ' • ' + R.SCOPE_LABEL[R.scopeOf('dashboard.executive.view')] + ' scope'} />
      <StatCard label="Period payroll" value={'$' + gk.toFixed(1) + 'k'} unit="USD" icon="payments" tone="accent" footer={timesheetCount + ' timesheet' + (timesheetCount === 1 ? '' : 's') + ' this period • Local currency ' + O.currency} />
      <StatCard label="Jira match (avg)" value={util == null ? '—' : util.toFixed(1) + '%'} icon="data_usage" tone="success" progress={util == null ? undefined : util} footer={util == null ? 'No reconciliation data yet' : undefined} />
      <StatCard label="Compliance alerts" value={String(alerts)} icon="gpp_maybe" tone="danger" footer={<span style={{ color: 'var(--mgh-danger)' }}>{E.filter(lowMatch).length} Jira • {E.filter(e => e.ot > 8).length} overtime</span>} />
    </Grid>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 20 }}>
      <Card title="Gross payroll trend" subtitle="Saved payroll runs, last 6 periods (thousands USD)" icon="monitoring">{trend.length ? <BarChart data={trend} height={200} format={v => '$' + v + 'k'} /> : <div className="mgh-body" style={{ padding: '48px 0', textAlign: 'center', color: 'var(--mgh-ink-3)' }}>No payroll runs yet.</div>}</Card>
      <Card title="Cost by department" icon="donut_small">
        {gross > 0 ? <>
          <ProgressBar height={14} segments={depts.map(([l, v, c]) => ({ value: v, color: c, label: v + '%' }))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>{depts.map(([l, v, c]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', font: '500 13px var(--font-sans)' }}><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}</span><b style={{ color: 'var(--mgh-ink)' }}>{fmt$(depts.find(d => d[0] === l)[3])}</b></div>)}</div>
        </> : <div className="mgh-body" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--mgh-ink-3)' }}>No hours logged this period.</div>}
      </Card>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 20 }}>
      <Card title="Needs your attention" icon="priority_high" actions={<Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={() => go('queue')}>View queue</Button>} bodyStyle={{ paddingTop: 14 }}>
        {attention.length ? <DataTable density="compact" onRowClick={r => go('approvals', r.id)} rows={attention} columns={[
          { key: 'name', label: 'Employee', render: r => <EmployeeCell e={r} /> }, { key: 'total', label: 'Hours', align: 'right', render: r => fmtH(r.total) },
          { key: 'status', label: 'Status', render: r => <WFPill size="sm" status={liveStatus(r)} /> }, { key: 'gross', label: 'Est. gross', align: 'right', strong: true, render: r => fmt$(r.gross) }]} /> : <div className="mgh-body" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--mgh-ink-3)' }}>No timesheets pending this period.</div>}
      </Card>
      <Card title="Period timeline" icon="event_upcoming">
        <ActivityFeed items={[
          { icon: 'edit_calendar', tone: 'primary', title: 'Registro de actividades y jornada', meta: `${curPeriod.rangeShort} • Cierre: ${curPeriod.endDay} ${curPeriod.monthShort}, 23:59` },
          { icon: 'how_to_reg', tone: 'warning', title: 'Aprobación de Supervisor y PM', meta: reviewMeta },
          { icon: 'badge', tone: 'neutral', title: 'Revisión HR & Compliance', meta: `${curPeriod.endDay} ${curPeriod.monthShort}` },
          { icon: 'account_balance', tone: 'success', title: 'Desembolso y Pago', meta: `Fecha de pago: ${curPeriod.payDate}` }
        ]} />
      </Card>
    </div>
  </Page>;
}

function Employees({ go }) {
  const [dept, setDept] = React.useState('All departments'); const [type, setType] = React.useState('All types');
  const base = EMPLOYEES.filter(e => MGH_RBAC.can('employees.view', e) && (dept === 'All departments' || e.dept === dept) && (type === 'All types' || e.type === type));
  const t = useTable(base, { search: ['name', 'id', 'role', 'dept', 'loc'], pageSize: 10, initialSort: { key: 'name', dir: 'asc' } });
  const exportRows = list => window.__mghNotify(window.__mghExport('csv', 'Employees', '', { cols: [['ID'], ['Name'], ['Email'], ['Role'], ['Department'], ['Location'], ['Type'], ['Rate']], rows: list.map(r => [r.id, r.name, r.email || '', r.role || '', r.dept || '', r.loc || '', r.type || '', r.rate]) }));
  return <Page>
    <PageHeader breadcrumbs={['Workforce', 'Employee Directory']} title="Employees" description={EMPLOYEES.length + ' colaborador' + (EMPLOYEES.length === 1 ? '' : 'es') + ' en My Global Hub (Dominicana SRL). Los contratistas son colaboradores y se pagan en la misma nómina.'} actions={<>{MGH_RBAC.can('contractors.view') && <Button variant="secondary" icon="handshake" onClick={() => go('contractors')}>View Contractors</Button>}{MGH_RBAC.can('employees.create') && <><Button icon="person_add" onClick={() => go('addEmployee')}>Add Employee</Button></>}</>} />
    <Card padding={20}>
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search name, ID, role, location…"
        filters={<><Select size="sm" icon="apartment" value={dept} onChange={setDept} options={['All departments', ...new Set(EMPLOYEES.map(e => e.dept).filter(Boolean))]} /><Select size="sm" icon="work" value={type} onChange={setType} options={['All types', ...new Set(EMPLOYEES.map(e => e.type).filter(Boolean))]} /></>}
        actions={<Button size="sm" variant="secondary" icon="download" disabled={!t.all.length} onClick={() => exportRows(t.all)}>Export</Button>} />
      <DataTable style={{ marginTop: 14 }} maxHeight={560} selectable selected={t.sel} onSelectedChange={t.setSel} sort={t.sort} onSort={t.setSort} rows={t.rows} onRowClick={r => go('profile', r.id)}
        bulkBar={<Button size="sm" variant="secondary" icon="download" onClick={() => exportRows(t.all.filter(r => t.sel.includes(r.id)))}>Export selected</Button>}
        columns={[
          { key: 'name', label: 'Employee', sortable: true, render: r => <EmployeeCell e={r} /> },
          { key: 'id', label: 'ID', sortable: true, render: r => <Badge mono size="sm">{r.id}</Badge> },
          { key: 'project', label: 'Proyecto', sortable: true, render: r => <Badge size="sm" tone="primary" mono>{r.project || '—'}</Badge> },
          { key: 'dept', label: 'Department', sortable: true, render: r => r.dept || '—' }, { key: 'loc', label: 'Location', sortable: true, render: r => r.loc || '—' },
          { key: 'type', label: 'Type', sortable: true, render: r => <Badge size="sm" tone={r.type === 'Exempt' ? 'primary' : 'neutral'}>{r.type || '—'}</Badge> },
          { key: 'rate', label: 'Rate', align: 'right', sortable: true, strong: true, render: r => fmt$(r.rate) + '/hr' },
          { key: 'x', label: '', align: 'right', render: r => <IconButton icon="edit" size={28} title="View / Edit Profile & Project" onClick={(ev) => { ev.stopPropagation(); go('profile', r.id); }} /> }]} />
      <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="employees" />
    </Card>
  </Page>;
}

function EmployeeProfile(props) {
  if (!EMPLOYEES.length) return window.__mghEmpty('Employee Profile', ['Workforce', 'Employees']);
  // Never fall back to another person's record: an unknown id shows an empty state
  const R = window.MGH_RBAC;
  const isSelf = R && R.scopeOf('employees.view') === 'self';
  const myEmpId = (R && R.me() && R.me().emp) || null;
  const targetId = isSelf ? (myEmpId || props.empId) : (props.empId || (EMPLOYEES[0] && EMPLOYEES[0].id));
  const found = EMPLOYEES.some(x => x.id === targetId) || !!(window.__MGH_DATA && window.__MGH_DATA.ALL_EMP && window.__MGH_DATA.ALL_EMP.some(x => x.id === targetId));
  if (!found) return window.__mghEmpty('Empleado no encontrado', ['Workforce', 'Employees'], 'No existe un colaborador con el ID ' + (targetId || '—') + ' en tu alcance.');
  return <EmployeeProfileInner {...props} />;
}
function EmployeeProfileInner({ empId, go, notify }) {
  useWF();
  const R = window.MGH_RBAC;
  const isSelf = R && R.scopeOf('employees.view') === 'self';
  const myEmpId = (R && R.me() && R.me().emp) || null;
  const targetId = isSelf ? (myEmpId || empId) : (empId || (EMPLOYEES[0] && EMPLOYEES[0].id));
  const e = EMPLOYEES.find(x => x.id === targetId) || (window.__MGH_DATA && window.__MGH_DATA.ALL_EMP && window.__MGH_DATA.ALL_EMP.find(x => x.id === targetId)) || {};
  const [tab, setTab] = React.useState('overview');
  const [editOpen, setEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const canEdit = MGH_RBAC.can('employees.edit', e);
  const selfEdit = !canEdit && MGH_RBAC.can('profile.edit', e);
  // Password reset for someone who forgot it: HR/admin/PM, never on your own profile (use Change password).
  // The backend decides per target account (a PM only resets employees, contractors and supervisors).
  const me = MGH_RBAC.user;
  const canReset = !!me && ['hr', 'admin', 'pm'].includes(me.role) && !!e.id && me.employeeId !== e.id;
  const [reset, setReset] = React.useState(null); // null | { step: 'confirm' | 'busy' | 'done', email, pw, error }
  const doReset = async () => {
    setReset({ step: 'busy' });
    try {
      const r = await window.api.resetEmployeePassword(e.id);
      setReset({ step: 'done', email: r.email, pw: r.temporaryPassword });
    } catch (err) { setReset({ step: 'confirm', error: err.message }); }
  };
  // Remove an employee (PM/admin, not yourself): delete in cascade when there is no payroll history, else deactivate
  const canRemove = !!me && ['pm', 'admin'].includes(me.role) && !!e.id && me.employeeId !== e.id;
  const [removal, setRemoval] = React.useState(null); // null | { loading } | preview + { busy, error, confirmText }
  const openRemoval = async () => {
    setRemoval({ loading: true });
    try { setRemoval({ ...(await window.api.employeeRemoval(e.id)), confirmText: '' }); }
    catch (err) { setRemoval({ error: err.message, blockers: [] }); }
  };
  const forget = () => {
    for (const list of [EMPLOYEES, window.EMPLOYEES, window.ALL_EMP].filter(Array.isArray)) { const i = list.findIndex(x => x.id === e.id); if (i >= 0) list.splice(i, 1); }
  };
  const doDelete = async () => {
    setRemoval(r => ({ ...r, busy: true, error: '' }));
    try {
      await window.api.deleteEmployee(e.id);
      const name = e.name; forget(); setRemoval(null);
      notify(name + ' eliminado junto con sus datos');
      window.dispatchEvent(new Event('mgh-wf')); go('employees');
    } catch (err) { setRemoval(r => ({ ...r, busy: false, error: err.message })); }
  };
  const doDeactivate = async () => {
    setRemoval(r => ({ ...r, busy: true, error: '' }));
    try {
      await window.api.deactivateEmployee(e.id);
      e.status = 'Terminated'; setRemoval(null);
      notify(e.name + ' desactivado • ya no puede iniciar sesión y su historial se conserva');
      window.dispatchEvent(new Event('mgh-wf'));
    } catch (err) { setRemoval(r => ({ ...r, busy: false, error: err.message })); }
  };
  const REMOVAL_LABELS = { timesheets: 'Hojas de tiempo', activities: 'Actividades', punches: 'Ponches', exceptions: 'Excepciones de asistencia', leaveRequests: 'Solicitudes de permiso', worklogs: 'Worklogs', projectMemberships: 'Membresías de proyecto', tasksUnassigned: 'Tareas (quedan sin asignar)', pendingAdjustments: 'Ajustes pendientes', contractorRecords: 'Registro de contratista', contractorPayments: 'Pagos de contratista' };
  // Login of this employee: PM/HR/admin see it; only an admin changes the role (never their own)
  const canSeeAccount = !!me && ['pm', 'hr', 'admin'].includes(me.role);
  const canSetRole = !!me && me.role === 'admin' && me.employeeId !== e.id;
  const [account, setAccount] = React.useState(null);
  const [roleDraft, setRoleDraft] = React.useState('');
  const [roleBusy, setRoleBusy] = React.useState(false);
  React.useEffect(() => {
    let cancel = false;
    setAccount(null);
    if (canSeeAccount && e.id && window.api && window.api.employeeAccount) {
      window.api.employeeAccount(e.id).then(a => { if (!cancel) { setAccount(a); setRoleDraft(a.role || ''); } }).catch(() => { if (!cancel) setAccount({ hasAccount: false, error: true }); });
    }
    return () => { cancel = true; };
  }, [e.id, canSeeAccount]);
  const ROLE_LABELS = { employee: 'Empleado', contractor: 'Contratista', supervisor: 'Supervisor', pm: 'Project Manager', hr: 'Recursos Humanos', finance: 'Finanzas', admin: 'Administrador (acceso total)' };
  const saveRole = async () => {
    if (roleDraft === 'admin' && !window.confirm('¿Dar acceso total de administrador a ' + e.name + '? Podrá aprobar nóminas, ejecutar pagos y cambiar roles.')) return;
    setRoleBusy(true);
    try {
      const r = await window.api.setEmployeeRole(e.id, roleDraft);
      setAccount(a => ({ ...a, role: r.role }));
      notify(r.changed ? `Rol de ${e.name}: ${ROLE_LABELS[r.previousRole] || r.previousRole} → ${ROLE_LABELS[r.role] || r.role}. Se aplica en su próxima acción.` : 'Sin cambios');
    } catch (err) { notify('No se pudo cambiar el rol • ' + err.message); }
    finally { setRoleBusy(false); }
  };
  // Form starts from the stored values only (no sample cédula / bank / rate)
  const initialForm = () => ({ name: e.name || '', phone: e.phone || '', role: e.role || '', dept: e.dept || '', type: e.type || 'Full-time', entity: e.entity || '', loc: e.loc || '', mgr: e.mgr || '', project: e.project || '', rate: e.rate || '', bank: e.bank || '', nid: e.nid || '' });
  const [form, setForm] = React.useState(initialForm);

  React.useEffect(() => {
    setForm(initialForm());
  }, [e.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Send only fields that changed, so untouched values (e.g. the masked cédula) are never rewritten
      const init = initialForm();
      const changed = Object.fromEntries(Object.entries(form).filter(([k, val]) => String(val) !== String(init[k])));
      const payload = selfEdit ? Object.fromEntries(Object.entries(changed).filter(([k]) => ['name', 'phone', 'loc'].includes(k))) : changed;
      if (!Object.keys(payload).length) { notify('No changes to save'); setEditOpen(false); return; }
      if (window.api && window.api.updateEmployee) {
        await window.api.updateEmployee(e.id, payload);
      }
      if (selfEdit) {
        Object.assign(e, payload);
        notify('Profile updated');
        setEditOpen(false);
        window.dispatchEvent(new Event('mgh-wf'));
        return;
      }
      Object.assign(e, payload, payload.rate != null ? { rate: Number(payload.rate) || e.rate } : {});
      e.total = e.reg + e.ot + e.pto;
      e.gross = +(e.reg * e.rate + e.ot * e.rate * 1.5 + e.pto * e.rate).toFixed(2);
      const allMatch = (window.ALL_EMP || []).find(x => x.id === e.id);
      if (allMatch) Object.assign(allMatch, payload, payload.rate != null ? { rate: Number(payload.rate) || e.rate } : {});
      notify(`Employee ${e.name} updated successfully`);
      setEditOpen(false);
      window.dispatchEvent(new Event('mgh-wf'));
    } catch (err) {
      notify('Error updating employee: ' + (err.message || 'Server error'));
    } finally {
      setSaving(false);
    }
  };

  return <Page>
    <nav style={{ display: 'flex', gap: 6, alignItems: 'center', font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}><a onClick={() => go('employees')} style={{ cursor: 'pointer', color: 'var(--mgh-ink-2)', fontWeight: 500 }}>Workforce</a><Icon name="chevron_right" size={14} /><a onClick={() => go('employees')} style={{ cursor: 'pointer', color: 'var(--mgh-ink-2)', fontWeight: 500 }}>Employee Directory</a><Icon name="chevron_right" size={14} /><b style={{ color: 'var(--mgh-ink)' }}>{e.name} ({e.id})</b></nav>
    <Card padding={24}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ width: 120, height: 120, borderRadius: 12, background: e.avatar ? `url(${e.avatar}) center/cover` : 'var(--mgh-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 40px var(--font-sans)', color: 'var(--mgh-primary)', flexShrink: 0 }}>{!e.avatar && String(e.name || '?').split(' ').map(s => s[0]).join('')}</div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className="mgh-title">{e.name}</span><Badge tone={e.status === 'Active' ? 'success' : 'neutral'}>{e.status || '—'}</Badge></div>
          <Badge mono size="sm" style={{ marginTop: 4 }}>{e.id}</Badge>
          <div className="mgh-lg" style={{ fontWeight: 500, marginTop: 6 }}>{e.role || '—'}</div>
          <div style={{ font: '400 14px/20px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>{e.dept || '—'} • {e.project || '—'}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}><span style={{ display: 'flex', gap: 4 }}><Icon name="work" size={16} />{e.type || '—'}</span><span style={{ display: 'flex', gap: 4 }}><Icon name="calendar_today" size={16} />Joined {e.joined || '—'}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{canEdit && <Button variant="secondary" icon="edit" onClick={() => setEditOpen(true)}>Edit Employee</Button>}{selfEdit && <Button variant="secondary" icon="edit" onClick={() => setEditOpen(true)}>Edit My Profile</Button>}{MGH_RBAC.can('payslips.view', e) && <Button variant="secondary" icon="receipt_long" onClick={() => go('paystub', e.id)}>Generate Pay Statement</Button>}{canReset && <Button variant="secondary" icon="lock_reset" onClick={() => setReset({ step: 'confirm' })}>Restablecer contraseña</Button>}{canRemove && <Button variant="danger" icon="person_remove" onClick={openRemoval}>Eliminar empleado</Button>}</div>
      </div>
      <Tabs style={{ marginTop: 20 }} value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview & Profile' }, { value: 'bank', label: 'Multi-Bank Allocations' }, { value: 'comp', label: 'Compensation & Tax' }, { value: 'jira', label: 'Jira Integration' }, { value: 'pto', label: 'Time Off & PTO' }, { value: 'docs', label: 'Documents' }]} />
    </Card>
    <Modal open={!!removal} title={'Eliminar a ' + e.name} onClose={() => removal && !removal.busy && setRemoval(null)} width={540}
      actions={removal && !removal.loading ? <>
        <Button variant="outline" disabled={removal.busy} onClick={() => setRemoval(null)}>Cancelar</Button>
        {e.status !== 'Terminated' && <Button variant="secondary" icon="person_off" disabled={removal.busy} onClick={doDeactivate}>Desactivar</Button>}
        {removal.canDelete && <Button variant="danger" icon="delete_forever" disabled={removal.busy || removal.confirmText !== e.id} onClick={doDelete}>{removal.busy ? 'Eliminando…' : 'Eliminar definitivamente'}</Button>}
      </> : null}>
      {!removal || removal.loading ? <div className="mgh-body">Calculando qué se eliminaría…</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {removal.canDelete ? <>
          <div className="mgh-body">Se eliminará el empleado y, en cascada, todo lo siguiente. <b>No se puede deshacer.</b></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px', padding: 12, borderRadius: 8, background: 'var(--mgh-surface-1)', font: '500 13px/18px var(--font-sans)' }}>
            {Object.entries(REMOVAL_LABELS).filter(([k]) => removal.willDelete && removal.willDelete[k]).map(([k, l]) => <React.Fragment key={k}><span>{l}</span><b>{removal.willDelete[k]}</b></React.Fragment>)}
            <span>Cuenta de acceso</span><b>{removal.willDelete && removal.willDelete.login ? removal.willDelete.login : 'Sin cuenta'}</b>
          </div>
          <TextField label={'Escribe ' + e.id + ' para confirmar'} value={removal.confirmText || ''} onChange={x => { const val = typeof x === 'string' ? x : x.target.value; setRemoval(r => ({ ...r, confirmText: val })); }} />
          <div style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>Si prefieres conservar su información, usa Desactivar: no podrá entrar y su historial se mantiene.</div>
        </> : removal.blockers && removal.blockers.length ? <>
          <div className="mgh-body"><b>{e.name}</b> ya tiene historial de nómina ({removal.blockers.join(', ')}). Esos registros deben conservarse, por eso no se puede eliminar.</div>
          <div className="mgh-body">Puedes <b>desactivarlo</b>: no podrá iniciar sesión, sale de sus proyectos y deja de aparecer como activo, pero su historial se mantiene.</div>
        </> : null}
        {removal.error ? <div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-danger)' }}>{removal.error}</div> : null}
      </div>}
    </Modal>
    <Modal open={!!reset} title={reset && reset.step === 'done' ? 'Contraseña restablecida' : 'Restablecer contraseña de ' + e.name} onClose={() => reset && reset.step !== 'busy' && setReset(null)} width={500}
      actions={reset && reset.step === 'done'
        ? <><Button variant="secondary" icon="content_copy" onClick={() => { try { navigator.clipboard.writeText(reset.pw); notify('Contraseña copiada'); } catch (_) { notify('No se pudo copiar • selecciónala manualmente'); } }}>Copiar</Button><Button onClick={() => setReset(null)}>Listo</Button></>
        : <><Button variant="outline" disabled={reset && reset.step === 'busy'} onClick={() => setReset(null)}>Cancelar</Button><Button variant="danger" icon="lock_reset" disabled={reset && reset.step === 'busy'} onClick={doReset}>{reset && reset.step === 'busy' ? 'Restableciendo…' : 'Restablecer'}</Button></>}>
      {reset && reset.step === 'done' ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="mgh-body">Contraseña temporal para <b>{reset.email}</b>. Se muestra una sola vez: compártela en privado. Al entrar tendrá que cambiarla por una propia.</div>
        <div style={{ padding: 12, borderRadius: 8, background: 'var(--mgh-surface-1)', font: '700 16px/22px var(--font-mono)', color: 'var(--mgh-ink)', letterSpacing: 0.5 }}>{reset.pw}</div>
      </div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="mgh-body">Se generará una contraseña temporal nueva para <b>{e.email || e.name}</b>. Su contraseña actual dejará de funcionar, se cerrarán sus sesiones abiertas y deberá elegir una nueva al entrar. Si usa Google para iniciar sesión, puede seguir haciéndolo.</div>
        {reset && reset.error ? <div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-danger)' }}>{reset.error}</div> : null}
      </div>}
    </Modal>
    {tab === 'overview' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {canSeeAccount && <Card icon="admin_panel_settings" title="Acceso al sistema" subtitle="Cuenta con la que esta persona inicia sesión">
          {!account ? <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>Cargando…</div>
            : !account.hasAccount ? <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>{account.error ? 'No se pudo consultar la cuenta.' : 'Sin cuenta de acceso. Agrega un correo al empleado para crearla.'}</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <KeyValue label="Correo de acceso" value={account.email} />
                <KeyValue label="Rol en el sistema" value={ROLE_LABELS[account.role] || account.role} aside={!account.isActive ? <Badge size="sm" tone="danger">Desactivada</Badge> : account.mustChangePassword ? <Badge size="sm" tone="warning">Contraseña temporal</Badge> : null} />
                <KeyValue label="Último acceso" value={account.lastLoginAt ? fmtAt(account.lastLoginAt) : 'Nunca'} />
                <KeyValue label="Contraseña propia" value={account.hasPassword ? 'Sí' : 'No (solo Google)'} />
              </div>
              {canSetRole && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Select size="sm" value={roleDraft} onChange={x => setRoleDraft(typeof x === 'string' ? x : x.target.value)} options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
                <Button size="sm" icon="save" disabled={roleBusy || roleDraft === account.role} onClick={saveRole}>{roleBusy ? 'Guardando…' : 'Cambiar rol'}</Button>
              </div>}
            </div>}
        </Card>}
        <Card icon="badge" title="Employment details">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><KeyValue label="Email" value={e.email || '—'} /><KeyValue label="Manager" value={e.mgr || '—'} /><KeyValue label="Work location" value={e.loc || '—'} /><KeyValue label="Pay frequency" value={e.freq || '—'} /><KeyValue label="Tax profile" value={String(e.tax || '—').split(' — ')[0]} aside={<Badge tone={/^Exempt/.test(e.tax) ? 'success' : 'info'} size="sm">{/^Exempt/.test(e.tax) ? 'No withholdings' : 'Withholding'}</Badge>} /><KeyValue label="Primary bank" value={e.bank || '—'} /><KeyValue label="RNC / Cédula Personal" value={e.nid || '—'} mono /><KeyValue label="Payment method" value={e.pmethod || '—'} /></div>
        </Card>
        <Card icon="payments" title="Compensation & Overtime Rules" actions={canEdit && <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>Edit Tariff</Button>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}><MetricTile label="Base hourly" value={fmt$(e.rate)} sub="USD / hr" align="center" /><MetricTile tone="success" label="Overtime 1.5×" value={fmt$(e.rate * 1.5)} sub={WF ? WF.otLabel() : ''} align="center" /></div>
        </Card>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card icon="hub" title="Jira account" actions={<Badge tone={e.jira ? 'info' : 'neutral'} dot>{e.jira ? 'Bound' : 'Not bound'}</Badge>}>
          <KeyValue label="Atlassian account" value={e.jira || '—'} />
          <KeyValue label="Assigned project" value={e.project || '—'} />
        </Card>
      </div>
    </div>}
    {tab === 'bank' && (() => {
      // Split from the stored allocation (bank % + Coinbase %); account numbers are the masked values from the backend
      const segs = [];
      if (e.alloc > 0) segs.push({ value: e.alloc, color: 'var(--mgh-primary)', label: (e.bank || 'Bank') + ' ' + e.alloc + '%', acct: e.acct || '—' });
      if (e.cryptoAlloc > 0) segs.push({ value: e.cryptoAlloc, color: 'var(--mgh-accent)', label: 'Coinbase ' + (e.cryptoAsset || '') + ' ' + e.cryptoAlloc + '%', acct: e.cryptoWallet ? e.cryptoWallet.slice(0, 6) + '…' + e.cryptoWallet.slice(-4) : '—' });
      return <Card icon="account_balance" title="Multi-Bank Allocations" subtitle="Net pay split • must total 100%">
        {segs.length ? <>
          <ProgressBar height={16} segments={segs} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8, marginTop: 14 }}>{segs.map(s => <KeyValue key={s.label} label={s.label} value={s.acct} mono />)}</div>
        </> : <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>No payout allocation saved.</div>}
      </Card>;
    })()}
    {tab === 'comp' && (() => { const c = DEDUCT(e); return <Card icon="payments" title="Compensation & Tax" subtitle={e.tax}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}><KeyValue label="Base hourly" value={fmt$(e.rate)} /><KeyValue label="Overtime rule" value={WF ? WF.otLabel() : 'Weekly > 44h'} /><KeyValue label="Overtime rate" value={'1.5× • ' + fmt$(e.rate * 1.5)} /><KeyValue label="Gross / period" value={fmt$(e.gross || 0)} />{c.lines.map(([l, v]) => <KeyValue key={l} label={l} value={fmt$(v)} />)}<KeyValue label="Net / period" value={fmt$(c.net || 0)} /></div>
    </Card>; })()}
    {tab === 'jira' && <Card icon="hub" title="Jira Integration" actions={<Badge tone={e.jira ? 'info' : 'neutral'} dot>{e.jira ? 'Bound' : 'Not bound'}</Badge>}>
      <KeyValue label="Atlassian account" value={e.jira || '—'} />
      <KeyValue label="Assigned project" value={e.project || '—'} />
      <KeyValue label="Jira match this period" value={matchTxt(e)} />
    </Card>}
    {tab === 'pto' && (() => {
      // Days taken = approved leave this year (weekdays); holidays = the org's calendar loaded from the backend
      const A = window.MGH_ATT, yr = A ? A.TODAY.slice(0, 4) : String(new Date().getFullYear());
      const mine = A ? A.leave().filter(l => l.emp === e.id && l.status === 'Approved' && String(l.from).startsWith(yr)) : [];
      const days = l => A.range(l.from, l.to).filter(d => A.dow(d) % 6).length;
      const used = t => mine.filter(l => t(l.type)).reduce((s, l) => s + days(l), 0);
      const hol = A ? A.holidays(e.entity).filter(h => String(h.date).startsWith(yr)).length : 0;
      const pend = A ? A.leave().filter(l => l.emp === e.id && /Pending/.test(l.status)).length : 0;
      return <Card icon="beach_access" title="Time Off & PTO" subtitle={'Approved leave in ' + yr}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}><KeyValue label="Vacation taken" value={used(t => t === 'Vacation') + ' days'} /><KeyValue label="Sick leave taken" value={used(t => t === 'Sick') + ' days'} /><KeyValue label="Other leave taken" value={used(t => t !== 'Vacation' && t !== 'Sick') + ' days'} /><KeyValue label="Pending requests" value={String(pend)} /><KeyValue label={'Holidays (' + yr + ')'} value={hol + ' days'} /></div>
      </Card>;
    })()}
    {tab === 'docs' && <Card icon="folder" title="Documents">
      <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>No documents uploaded for this employee.</div>
    </Card>}
    <Card icon="schedule" title={`Timesheet • ${getCurrentPeriod().code}`} actions={<Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={() => go('approvals', e.id)}>Open timesheet</Button>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><WFPill status={liveStatus(e)} /><span className="mgh-body">{fmtH(e.reg)} regular • {fmtH(e.ot)} overtime • {fmtH(e.pto)} PTO</span></div>
    </Card>

    <Modal open={editOpen} title={`${selfEdit ? 'Edit My Profile' : 'Edit Employee'} • ${e.name} (${e.id})`} onClose={() => setEditOpen(false)} width={620}
      actions={<>
        <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
        <Button variant="primary" icon="save" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
      </>}
    >
      {selfEdit ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 14 }}>
        <TextField label="Full Name" value={form.name} onChange={x => setForm(f => ({ ...f, name: typeof x === 'string' ? x : x.target.value }))} />
        <TextField label="Phone" value={form.phone} onChange={x => setForm(f => ({ ...f, phone: typeof x === 'string' ? x : x.target.value }))} />
        <TextField label="Work Location" value={form.loc} onChange={x => setForm(f => ({ ...f, loc: typeof x === 'string' ? x : x.target.value }))} />
        <div style={{ gridColumn: '1 / -1', font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>Role, compensation, bank and organization details are managed by HR.</div>
      </div> : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <TextField label="Full Name" value={form.name} onChange={x => setForm(f => ({ ...f, name: typeof x === 'string' ? x : x.target.value }))} />
        <TextField label="Job Title / Role" value={form.role} onChange={x => setForm(f => ({ ...f, role: typeof x === 'string' ? x : x.target.value }))} />
        <Select label="Department" value={form.dept} onChange={x => setForm(f => ({ ...f, dept: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={['Executive', 'Engineering', 'Product', 'Design', 'Operations', 'Finance', 'Human Resources']} />
        <TextField label="Base Rate (USD/hr)" type="number" value={String(form.rate)} onChange={x => setForm(f => ({ ...f, rate: typeof x === 'string' ? x : x.target.value }))} />
        <Select label="Empresa" value={form.entity} onChange={x => setForm(f => ({ ...f, entity: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={['MGH Dominicana SRL']} />
        <TextField label="Direct Manager" value={form.mgr} onChange={x => setForm(f => ({ ...f, mgr: typeof x === 'string' ? x : x.target.value }))} />
        <TextField label="Primary Bank" value={form.bank} onChange={x => setForm(f => ({ ...f, bank: typeof x === 'string' ? x : x.target.value }))} />
        <TextField label="RNC / Cédula Personal" value={form.nid} mono onChange={x => setForm(f => ({ ...f, nid: typeof x === 'string' ? x : x.target.value }))} />
        <TextField label="Work Location" value={form.loc} onChange={x => setForm(f => ({ ...f, loc: typeof x === 'string' ? x : x.target.value }))} />
        <TextField label="Assigned Project" value={form.project} onChange={x => setForm(f => ({ ...f, project: typeof x === 'string' ? x : x.target.value }))} />
      </div>}
    </Modal>
  </Page>;
}

window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { dashboard: Dashboard, employees: Employees, profile: EmployeeProfile });

})();

// ---- ScreensPayroll.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, MetricTile, DataTable, TableToolbar, Pagination, ActivityFeed, Tabs, PageHeader, Select, ProgressBar, KeyValue, Stepper, Checkbox, TextField } = window.MyGlobalHubDesignSystem_2a603d;

// Current-period figures are estimates from the employees' timesheet hours; history comes from saved payroll runs.
function PayrollDashboard({ go }) {
  const curPeriod = getCurrentPeriod();
  const E = EMPLOYEES;
  const gross = E.reduce((s, e) => s + (e.gross || 0), 0);
  const ded = E.reduce((s, e) => s + (e.gross ? DEDUCT(e).total : 0), 0);
  const withHours = E.filter(e => e.hasTimesheet).length;
  const [runs, setRuns] = React.useState([]);
  const [openEx, setOpenEx] = React.useState(null);
  React.useEffect(() => {
    let cancel = false;
    if (window.api && window.api.payrollRuns) window.api.payrollRuns().then(r => { if (!cancel && Array.isArray(r)) setRuns(r); }).catch(() => {});
    if (window.api && window.api.exceptions) window.api.exceptions().then(r => { if (!cancel && Array.isArray(r)) setOpenEx(r.filter(x => !/resolved|closed/i.test(x.status || '')).length); }).catch(() => {});
    return () => { cancel = true; };
  }, []);
  const byPeriod = {}; runs.forEach(r => { byPeriod[r.period_id] = (byPeriod[r.period_id] || 0) + (Number(r.total_gross) || 0); });
  const hist = Object.keys(byPeriod).sort().slice(-6).map(p => ({ label: p, a: +(byPeriod[p] / 1000).toFixed(1) }));
  // Estimated gross by department (one company; projects/departments, not legal entities)
  const byDept = {}; E.forEach(e => { const k = e.dept || '—'; byDept[k] = (byDept[k] || 0) + (e.gross || 0); });
  const deptRows = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
  // Next quincenas: step one day past the end of the previous one (no month arithmetic)
  const after = p => { const d = new Date(p.endDate + 'T12:00:00'); d.setDate(d.getDate() + 1); return getQuincenaForDate(d); };
  const nextP = after(curPeriod);
  const nextP2 = after(nextP);
  const upcomingRows = [curPeriod, nextP, nextP2].map(p => ({ id: p.code, range: p.rangeShort, pay: p.payDate }));
  const empty = txt => <div className="mgh-body" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--mgh-ink-3)' }}>{txt}</div>;
  return <Page>
    <PageHeader breadcrumbs={['Payroll & Finance', 'Overview']} title="Payroll Dashboard" status={<Badge tone="neutral" dot>{`Cycle ${curPeriod.code} • closes in ${curPeriod.daysRemaining}d`}</Badge>} actions={<><Button variant="secondary" icon="calendar_month" onClick={() => window.__mghGo ? window.__mghGo('periods') : go('periods')}>Pay calendar</Button><Button icon="play_arrow" onClick={() => go('processing')}>Start Payroll Run</Button></>} />
    <Grid min={220}>
      <StatCard label="Estimated gross" value={fmt$(gross)} unit="USD" icon="payments" footer={withHours + ' of ' + E.length + ' with timesheet hours'} />
      <StatCard label="Estimated deductions" value={fmt$(ded)} unit="USD" icon="account_balance_wallet" tone="accent" footer="Employee withholdings" />
      <StatCard label="Estimated net" value={fmt$(gross - ded)} unit="USD" icon="send_money" tone="success" footer="Before payroll run" />
      <StatCard label="Open exceptions" value={openEx == null ? '—' : String(openEx)} icon="report" tone="danger" footer="Attendance exceptions" />
    </Grid>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 20 }}>
      <Card icon="stacked_bar_chart" title="Gross by period" subtitle="Saved payroll runs • thousands USD">{hist.length ? <BarChart data={hist} height={200} format={v => '$' + v + 'k'} /> : empty('No payroll runs yet.')}</Card>
      <Card icon="donut_small" title="By department" subtitle="Current period estimate">
        {gross > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{deptRows.map(([n, v]) => <div key={n}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{n}</span><b style={{ font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{fmt$(v)}</b></div><ProgressBar value={v / gross * 100} /></div>)}</div> : empty('No hours logged this period.')}
      </Card>
    </div>
    <Card icon="event_repeat" title="Upcoming pay periods" bodyStyle={{ paddingTop: 14 }}>
      <DataTable density="compact" rows={upcomingRows} columns={[
        { key: 'id', label: 'Cycle', mono: true, strong: true }, { key: 'range', label: 'Work period' }, { key: 'pay', label: 'Pay date' }]} />
    </Card>
  </Page>;
}

function PayrollProcessing({ notify }) {
  // The quincena being paid: usually the one that just closed (its sheets were reviewed by the PM and the owner)
  const periodOpts = React.useMemo(() => { const c = getCurrentPeriod(); return [{ code: c.code, label: c.code + ' (' + c.rangeShort + ', en curso)' }, ...window.__mghPrevPeriods(c, 3)]; }, []);
  const [periodCode, setPeriodCode] = React.useState(() => periodOpts[1] ? periodOpts[1].code : periodOpts[0].code);
  const curPeriod = { ...getCurrentPeriod(), code: periodCode };
  const [run, setRun] = React.useState(null);
  const [sheets, setSheets] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [runTick, setRunTick] = React.useState(0);
  React.useEffect(() => {
    let cancel = false;
    Promise.all([
      window.api.payrollRuns().catch(() => []),
      window.api.timesheets({ periodId: periodCode }).catch(() => []),
    ]).then(([runs, ts]) => {
      if (cancel) return;
      setRun((Array.isArray(runs) ? runs : []).find(r => r.period_id === periodCode) || null);
      setSheets(Array.isArray(ts) ? ts : []);
    });
    return () => { cancel = true; };
  }, [periodCode, runTick]);
  const runStatus = run ? run.status : 'Sin corrida';
  const runLocked = run && /^(Approved|Paid)$/.test(run.status);
  const approvedSheets = sheets.filter(s => /^(Approved|Paid)$/.test(s.status));
  const pendingSheets = sheets.filter(s => !/^(Approved|Paid)$/.test(s.status));
  const runAction = async (fn, ok) => {
    setBusy(true);
    try { const r = await fn(); notify(typeof ok === 'function' ? ok(r) : ok); setRunTick(n => n + 1); }
    catch (err) { notify('No se pudo completar • ' + err.message); }
    finally { setBusy(false); }
  };
  const calculateRun = () => runAction(() => window.api.calculatePayroll({ periodId: periodCode, saveAsRun: true }), r => `Corrida calculada • ${r.totalEmployees} pagados${r.notIncluded && r.notIncluded.length ? ' • ' + r.notIncluded.length + ' sin hoja aprobada (no incluidos)' : ''}`);
  const approveRun = () => runAction(() => window.api.approvePayrollRun(run.id), 'Corrida aprobada • ya puedes generar los archivos de pago');
  const markPaid = () => { if (window.confirm('¿Confirmas que el pago de ' + periodCode + ' ya fue ejecutado? La corrida, las hojas y el periodo quedarán como Pagados y no se podrán modificar.')) runAction(() => window.api.markPayrollRunPaid(run.id), r => `${periodCode} marcado como pagado • ${r.timesheetsPaid || 0} hojas pagadas`); };
  const [step, setStep] = React.useState(0);
  const [sel, setSel] = React.useState([]);
  const [disbursedModal, setDisbursedModal] = React.useState(false);
  const [disbursing, setDisbursing] = React.useState(false);
  const names = ['Pre-checks', 'Import Hours', 'Review Exceptions', 'Calculate', 'Approve & Lock', 'Disburse'];
  const steps = names.map((l, i) => ({ label: l, state: i < step ? 'done' : i === step ? 'current' : 'pending', icon: ['rule', 'download', 'report', 'calculate', 'lock', 'send_money'][i], status: i < step ? 'Visto' : i === step ? 'Paso actual' : 'Pendiente' }));
  // Open attendance exceptions from the backend (no invented issues)
  const [rawEx, setRawEx] = React.useState([]);
  const loadEx = React.useCallback(() => {
    if (window.api && window.api.exceptions) window.api.exceptions({ resolved: false }).then(r => setRawEx(Array.isArray(r) ? r : [])).catch(() => setRawEx([]));
  }, []);
  React.useEffect(loadEx, [loadEx]);
  const ex = rawEx.map(x => ({ id: x.id, emp: EMPLOYEES.find(e => e.id === x.emp) || { id: x.emp, name: x.emp }, issue: x.type + (x.date ? ' • ' + x.date : ''), sev: x.severity || '—', act: x.suggestedAction || '' }));
  const totals = EMPLOYEES.reduce((t, e) => ({ hrs: t.hrs + (e.total || 0), gross: t.gross + (e.gross || 0), ded: t.ded + (e.gross ? DEDUCT(e).total : 0) }), { hrs: 0, gross: 0, ded: 0 });
  const resolveSelected = async () => {
    const ids = sel.slice();
    const results = await Promise.allSettled(ids.map(id => window.api.resolveException(id, { status: 'resolved' })));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    notify(ok === ids.length ? `${ok} exception${ok === 1 ? '' : 's'} resolved` : `${ok} of ${ids.length} resolved • ${ids.length - ok} failed`);
    setSel([]); loadEx();
  };

  const handleNext = async () => {
    if (step < 5) {
      setStep(s => s + 1);
      return;
    }
    // Release = approve the saved payroll run for this period. Only report success if the backend confirms it.
    setDisbursing(true);
    try {
      if (!run) { notify(`Primero calcula la corrida de ${periodCode}`); return; }
      if (!runLocked) await window.api.approvePayrollRun(run.id);
      setRunTick(n => n + 1);
      setDisbursedModal(true);
    } catch (err) {
      notify('Could not approve the payroll run • ' + err.message);
    } finally {
      setDisbursing(false);
    }
  };

  return <Page>
    <PageHeader breadcrumbs={['Payroll & Finance', 'Pay Periods', curPeriod.code]} title="Payroll Processing" status={<Badge tone="warning" dot>{`${curPeriod.code} • Step ${step + 1} of 6`}</Badge>}
      actions={<><Button variant="secondary" icon="arrow_back" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Back</Button><Button icon={step === 5 ? 'send_money' : 'arrow_forward'} disabled={disbursing} onClick={handleNext}>{disbursing ? 'Releasing...' : step === 5 ? 'Release Funds' : 'Continue to ' + names[step + 1]}</Button></>} />
    <Card padding={24}><Stepper steps={steps} /></Card>
    <Card icon="account_balance" title={`Corrida de nómina • ${periodCode}`} subtitle="Solo se pagan hojas aprobadas por el PM y por el dueño. Los archivos bancarios salen de la corrida aprobada."
      actions={<Select size="sm" value={periodCode} onChange={x => setPeriodCode(typeof x === 'string' ? x : x.target.value)} options={periodOpts.map(p => ({ value: p.code, label: p.label }))} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge tone={!run ? 'neutral' : run.status === 'Paid' ? 'success' : run.status === 'Approved' ? 'primary' : 'warning'} dot>{runStatus}</Badge>
          {run && <span style={{ font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>{run.total_employees || 0} empleados • Bruto {fmt$(Number(run.total_gross) || 0)} • Neto {fmt$(Number(run.total_net) || 0)}</span>}
          <span style={{ flex: 1 }} />
          {!runLocked && <Button size="sm" variant="secondary" icon="calculate" disabled={busy || !approvedSheets.length} onClick={calculateRun}>{run ? 'Recalcular' : 'Calcular corrida'}</Button>}
          {run && /^(Calculated|PM_Approved)$/.test(run.status) && <Button size="sm" icon="verified" disabled={busy} onClick={approveRun}>Aprobar corrida</Button>}
          {run && run.status === 'Approved' && <Button size="sm" icon="paid" disabled={busy} onClick={markPaid}>Marcar pagada</Button>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['nacha', 'NACHA (.ach)'], ['bhd', 'Banco BHD (.txt)'], ['usdc', 'USDC Base (.json)']].map(([k, l]) => <Button key={k} size="sm" variant="outline" icon="download" disabled={!runLocked} onClick={() => window.open(`/api/payroll/export/${k}?periodId=${periodCode}&download=true`, '_blank')}>{l}</Button>)}
          {!runLocked && <span style={{ font: '500 12px var(--font-sans)', color: 'var(--mgh-ink-3)', alignSelf: 'center' }}>Los archivos se habilitan al aprobar la corrida.</span>}
        </div>
        <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{approvedSheets.length} hojas aprobadas para pago{pendingSheets.length ? ` • ${pendingSheets.length} todavía en revisión (no se pagan en esta corrida)` : ''}</div>
        {pendingSheets.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pendingSheets.map(s => <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'var(--mgh-surface-1)', font: '500 13px var(--font-sans)' }}>
            <Badge mono size="sm" tone="dark">{s.emp}</Badge><span style={{ flex: 1 }}>{s.name || s.emp}</span><WFPill size="sm" status={s.status} /><span>{fmtH(Number(s.total) || 0)}</span>
          </div>)}
        </div>}
        {!sheets.length && <div style={{ font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>No hay hojas de tiempo en esta quincena.</div>}
      </div>
    </Card>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
      {run ? <>
        <MetricTile tone="white" label="Empleados en la corrida" value={String(Number(run.total_employees) || 0)} /><MetricTile tone="white" label="Horas" value={run.total_hours != null ? fmtH(Number(run.total_hours)) : '—'} /><MetricTile tone="white" label="Bruto" value={fmt$(Number(run.total_gross) || 0)} /><MetricTile tone="white" label="Deducciones" value={run.total_deductions != null ? fmt$(Number(run.total_deductions)) : fmt$((Number(run.total_gross) || 0) - (Number(run.total_net) || 0))} /><MetricTile tone="success" label="Neto" value={fmt$(Number(run.total_net) || 0)} />
      </> : periodCode === getCurrentPeriod().code ? <>
        <MetricTile tone="white" label="Empleados (estimación)" value={String(EMPLOYEES.length)} /><MetricTile tone="white" label="Horas (estimación)" value={fmtH(totals.hrs)} /><MetricTile tone="white" label="Bruto estimado" value={fmt$(totals.gross)} /><MetricTile tone="white" label="Deducciones estimadas" value={fmt$(totals.ded)} /><MetricTile tone="success" label="Neto estimado" value={fmt$(totals.gross - totals.ded)} />
      </> : <MetricTile tone="white" label={'Totales de ' + periodCode} value="—" sub="Sin corrida calculada" />}
      <MetricTile tone="danger" label="Excepciones abiertas" value={String(ex.length)} />
    </div>
    <div style={{ font: '500 12px var(--font-sans)', color: 'var(--mgh-ink-3)', marginTop: -12 }}>{run ? 'Totales de la corrida guardada de ' + periodCode + '.' : periodCode === getCurrentPeriod().code ? 'Estimación del período actual a partir de las hojas de tiempo; la corrida calcula los montos definitivos.' : 'Esta quincena aún no tiene corrida calculada.'}</div>

    {step === 5 ? (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 20 }}>
        <Card icon="send_money" title="Ready to Release Funds • Banking Rails" subtitle="Generate NACHA ACH and Banco BHD direct deposit dispersal files.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--mgh-surface-2)', background: 'var(--mgh-surface-1)' }}>
                <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>Banco BHD León (DR ACH)</div>
                
                
                <div style={{ marginTop: 12 }}>
                  <Button size="sm" variant="secondary" icon="download" disabled={!runLocked} onClick={() => window.open(`/api/payroll/export/bhd?periodId=${curPeriod.code}&download=true`, '_blank')}>Download BHD File</Button>
                </div>
              </div>
              <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--mgh-surface-2)', background: 'var(--mgh-surface-1)' }}>
                <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>NACHA US FedWire / ACH</div>
                
                
                <div style={{ marginTop: 12 }}>
                  <Button size="sm" variant="secondary" icon="download" disabled={!runLocked} onClick={() => window.open(`/api/payroll/export/nacha?periodId=${curPeriod.code}&download=true`, '_blank')}>Download NACHA (.ach)</Button>
                </div>
              </div>
              <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--mgh-surface-2)', background: 'var(--mgh-surface-1)' }}>
                <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>Crypto USDC (Base)</div>
                
                
                <div style={{ marginTop: 12 }}>
                  <Button size="sm" variant="secondary" icon="download" disabled={!runLocked} onClick={() => window.open(`/api/payroll/export/usdc?periodId=${curPeriod.code}&download=true`, '_blank')}>Download USDC Batch</Button>
                </div>
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 8, background: 'var(--mgh-success-50)', border: '1px solid var(--mgh-success-200)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <Icon name="verified" size={24} color="var(--mgh-success)" />
              <div style={{ font: '500 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                {runLocked ? 'La corrida está aprobada: descarga los archivos de pago.' : <>Pulsa <b>Release Funds</b> para aprobar la corrida guardada de esta quincena. Los archivos de pago se habilitan solo desde la corrida aprobada.</>}
              </div>
            </div>
          </div>
        </Card>
        <Card icon="checklist" title="Disbursement verification">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Dual-control authorization confirmed', 'Sufficient liquidity in Treasury', 'BHD & NACHA batches reviewed', 'Exchange rate confirmed'].map((t) => <Checkbox key={t} label={t} />)}
          </div>
        </Card>
      </div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 20 }}>
        <Card icon="report" title="Exceptions to resolve" subtitle="Revisa y resuelve las excepciones abiertas antes de aprobar la corrida (el sistema no lo bloquea automáticamente)." bodyStyle={{ paddingTop: 14 }}>
          <DataTable selectable selected={sel} onSelectedChange={setSel} bulkBar={<Button size="sm" icon="done" onClick={resolveSelected}>Mark resolved</Button>} rows={ex} columns={[
            { key: 'emp', label: 'Employee', render: r => <EmployeeCell e={r.emp} sub={r.emp.id} /> }, { key: 'issue', label: 'Issue', wrap: true },
            { key: 'sev', label: 'Severity', render: r => <Badge size="sm" tone={r.sev === 'High' ? 'danger' : r.sev === '—' ? 'neutral' : 'warning'}>{r.sev}</Badge> }, { key: 'act', label: 'Suggested action', wrap: true }]} />
        </Card>
        <Card icon="checklist" title="Pre-run checklist">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{['Exchange rates confirmed', 'TSS & ISR tables up to date', 'Jira worklogs synced', 'Bank cut-off times confirmed', 'Dual control approver assigned'].map((t) => <Checkbox key={t} label={t} />)}</div>
        </Card>
      </div>
    )}

    <Modal open={disbursedModal} title="Payroll run approved" onClose={() => setDisbursedModal(false)} width={540}
      actions={<Button variant="primary" onClick={() => setDisbursedModal(false)}>Close</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 8, background: 'var(--mgh-success-50)', border: '1px solid var(--mgh-success-200)' }}>
          <Icon name="check_circle" size={32} color="var(--mgh-success)" />
          <div>
            <div style={{ font: '700 15px var(--font-sans)', color: 'var(--mgh-ink)' }}>{`${curPeriod.code} approved`}</div>
            <div style={{ font: '400 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>Download the dispersal files below and submit them to each bank.</div>
          </div>
        </div>
        <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>Generated Dispersal Files:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--mgh-surface-1)', borderRadius: 8 }}>
            <span>NACHA FedWire ACH (US)</span>
            <Button size="sm" variant="secondary" icon="download" onClick={() => window.open(`/api/payroll/export/nacha?periodId=${curPeriod.code}&download=true`, '_blank')}>Download .ach</Button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--mgh-surface-1)', borderRadius: 8 }}>
            <span>Banco BHD León Format (DR)</span>
            <Button size="sm" variant="secondary" icon="download" onClick={() => window.open(`/api/payroll/export/bhd?periodId=${curPeriod.code}&download=true`, '_blank')}>Download .txt</Button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--mgh-surface-1)', borderRadius: 8 }}>
            <span>Crypto USDC Batch (Base)</span>
            <Button size="sm" variant="secondary" icon="download" onClick={() => window.open(`/api/payroll/export/usdc?periodId=${curPeriod.code}&download=true`, '_blank')}>Download .json</Button>
          </div>
        </div>
      </div>
    </Modal>
  </Page>;
}

// Pay stubs come only from saved payroll runs (GET /payroll/paystubs); nothing is shown until a run includes the employee.
function PayStubPreview({ notify, empId }) {
  const self = MGH_RBAC.scopeOf('payslips.view') === 'self';
  const PE = self ? [] : MGH_RBAC.visible(EMPLOYEES, 'payslips.view'); const empOpts = PE.map(x => x.id + ' • ' + x.name);
  const [who, setWho] = React.useState(() => empOpts.find(o => empId && o.startsWith(empId)) || empOpts[0] || '');
  const target = self ? MGH_RBAC.me().emp : (who.split(' • ')[0] || null);
  const [stubs, setStubs] = React.useState(null);
  const [stubId, setStubId] = React.useState(null);
  React.useEffect(() => {
    let cancel = false; setStubs(null);
    if (!target || !window.api) { setStubs([]); return; }
    window.api.paystubs(self ? undefined : target)
      .then(r => { if (cancel) return; const L = Array.isArray(r) ? r : []; setStubs(L); setStubId(L[0] ? L[0].id : null); })
      .catch(err => { if (!cancel) { setStubs([]); notify('Could not load pay stubs • ' + err.message); } });
    return () => { cancel = true; };
  }, [target]);
  const s = stubs && (stubs.find(x => x.id === stubId) || stubs[0]);
  React.useEffect(() => { window.__mghStub = s ? { id: s.employeeId, name: s.employeeName, period: s.periodId, net: s.netPay } : null; window.dispatchEvent(new Event('mgh-stub')); }, [s && s.id]);
  React.useEffect(() => () => { window.__mghStub = null; window.dispatchEvent(new Event('mgh-stub')); }, []);

  const crumbs = ['Payroll & Finance', 'Pay Stubs'];
  const picker = empOpts.length > 1 ? <Select size="sm" icon="person" value={who} onChange={setWho} options={empOpts} /> : null;
  if (!target) return window.__mghEmpty('Pay Stubs', crumbs, self ? 'Your account is not linked to an employee record yet.' : undefined);
  if (!stubs) return window.__mghEmpty('Pay Stubs', crumbs, 'Loading pay stubs…');
  if (!s) return <Page><PageHeader breadcrumbs={crumbs} title="Pay Stubs" description={self ? 'You have no pay stubs yet. They appear here once a payroll run that includes you is approved.' : 'No payroll run includes this employee yet.'} actions={picker} /></Page>;

  const row = (l, a, b, c, bold) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 110px', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--mgh-surface-2)', font: `${bold ? 700 : 500} 13px var(--font-sans)`, color: bold ? 'var(--mgh-ink)' : 'var(--mgh-ink-2)' }}><span>{l}</span><span style={{ textAlign: 'right' }}>{a}</span><span style={{ textAlign: 'right' }}>{b}</span><span style={{ textAlign: 'right', color: 'var(--mgh-ink)' }}>{c}</span></div>;
  const dateStr = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString(LOC(), { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—';
  const adjAdd = (s.adjustments || []).reduce((sum, a) => sum + (a.amount > 0 ? a.amount : 0), 0);
  const ytd = stubs.filter(x => x.year === s.year && x.periodNumber <= s.periodNumber);
  const ytdGross = ytd.reduce((sum, x) => sum + (Number(x.grossPay) || 0), 0), ytdDed = ytd.reduce((sum, x) => sum + (Number(x.totalDeductions) || 0), 0);
  const issued = ['Approved', 'Paid', 'Closed', 'Archived'].includes(s.status);
  const COLORS = ['var(--mgh-primary)', 'var(--mgh-navy)', 'var(--mgh-accent)'];

  const handleDownloadPdf = () => {
    const w = window.open(`/api/payroll/paystub/${s.employeeId}/${s.periodId}/html`, '_blank');
    if (w) notify(`Opening official statement for ${s.employeeName} (${s.periodId})`);
    else window.print();
  };

  return <Page>
    <PageHeader breadcrumbs={[...crumbs, s.employeeId]} title="Pay Stub Preview" actions={<>{picker}<Select size="sm" value={s.periodId} onChange={p => { const m = stubs.find(x => x.periodId === p); if (m) setStubId(m.id); }} options={stubs.map(x => x.periodId)} /><Button variant="secondary" icon="print" onClick={() => window.print()}>Print</Button><Button variant="dark" icon="picture_as_pdf" onClick={handleDownloadPdf}>Download PDF</Button></>} />
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>
      <div style={{ background: 'var(--mgh-surface-1)', borderRadius: 16, padding: 28, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 4, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          <div style={{ height: 6, background: 'var(--mgh-navy)' }} />
          <div style={{ padding: 36, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><img src="assets/logo-mgh.png" alt="My Global Hub" style={{ height: 52 }} /><div style={{ textAlign: 'right' }}><div className="mgh-overline">Earnings statement</div><div className="mgh-h3">{s.periodId}</div><div className="mgh-body">Pay date {dateStr(s.payDate)}</div></div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 14, borderRadius: 8, background: 'var(--mgh-surface-page)' }}>
              <div><div className="mgh-overline">Employee</div><div className="mgh-lg">{s.employeeName}</div><div className="mgh-body">{s.employeeId}{s.employeeRole ? ' • ' + s.employeeRole : ''}</div></div>
              <div><div className="mgh-overline">Employer</div><div className="mgh-lg">{s.entity || 'My Global Hub (Dominicana SRL)'}</div>{(!s.entity || /dominicana|my global hub|mgh/i.test(s.entity)) && <div className="mgh-body">RNC 133-474018 • Punta Cana</div>}</div>
            </div>
            <div><div className="mgh-overline" style={{ marginBottom: 4 }}>Earnings</div>{row('Description', 'Hours', 'Rate', 'Amount', true)}{row('Regular', (Number(s.regHours) || 0).toFixed(1), fmt$(s.rate), fmt$((Number(s.regHours) || 0) * (Number(s.rate) || 0)))}{s.otHours > 0 && row('Overtime 1.5×', Number(s.otHours).toFixed(1), fmt$(s.rate * 1.5), fmt$(s.otHours * s.rate * 1.5))}{s.ptoHours > 0 && row('PTO', Number(s.ptoHours).toFixed(1), fmt$(s.rate), fmt$(s.ptoHours * s.rate))}{adjAdd > 0 && row('Adjustments', '', '', fmt$(adjAdd))}{row('Gross pay', '', '', fmt$(s.grossPay), true)}</div>
            <div><div className="mgh-overline" style={{ marginBottom: 4 }}>Deductions</div>{(s.deductions || []).length ? s.deductions.map(d => row(d.label, '', '', '−' + fmt$(d.amount))) : row('Sin deducciones', '', '', '—')}{row('Total deductions', '', '', '−' + fmt$(s.totalDeductions), true)}</div>
            {(s.payoutDistribution || []).length > 0 && <div><div className="mgh-overline" style={{ marginBottom: 8 }}>Direct deposit allocation</div><ProgressBar height={16} segments={s.payoutDistribution.map((p, i) => ({ value: p.percentage, color: COLORS[i % COLORS.length], label: `${p.target} ${p.percentage}%` }))} /></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 8, background: 'var(--mgh-navy)', color: '#fff' }}><span className="mgh-overline" style={{ color: 'var(--mgh-nav-text)' }}>Net pay</span><span style={{ font: '800 28px var(--font-sans)', letterSpacing: '-0.56px' }}>{fmt$(s.netPay)}</span></div>
            <div style={{ font: '400 11px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>Document ID PS-{s.periodId}-{s.employeeId} • Payroll run {s.runId}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card title="Summary" padding={20}><div style={{ display: 'grid', gap: 8 }}><KeyValue label="Gross" value={fmt$(s.grossPay)} /><KeyValue label="Deductions" value={(s.deductions || []).length ? '−' + fmt$(s.totalDeductions) : 'Sin deducciones'} /><KeyValue label="Net" value={fmt$(s.netPay)} aside={<Badge tone={issued ? 'success' : 'warning'}>{s.status}</Badge>} /></div></Card>
        <Card title="Year to date" padding={20}><div style={{ display: 'grid', gap: 8 }}><KeyValue label="YTD gross" value={fmt$(ytdGross)} /><KeyValue label="YTD withholding" value={fmt$(ytdDed)} /></div></Card>
      </div>
    </div>
  </Page>;
}

function Banking({ notify }) {
  // Funding accounts are entered by the user (kept in this browser; no backend table yet). No sample accounts,
  // and sample rows that older versions saved to localStorage are dropped.
  const SAMPLE_ACCTS = ['•••• 8491', '•••• 2910', '•••• 7712', '•••• 0045'];
  const defaultAccounts = [];

  const [accounts, setAccounts] = React.useState(() => {
    try {
      const saved = localStorage.getItem('mgh-disbursement-accounts');
      return saved ? JSON.parse(saved).filter(a => !SAMPLE_ACCTS.includes(a.acct)) : defaultAccounts;
    } catch {
      return defaultAccounts;
    }
  });

  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    bank: '',
    code: '',
    country: 'Dominican Republic',
    type: 'Primary ACH',
    acct: '•••• ',
    routing: '',
    cur: 'DOP / USD',
  });

  const t = useTable(accounts, { search: ['bank', 'country', 'type'], pageSize: 10 });

  const exportCsv = () => {
    const headers = ['Institution', 'Code', 'Country', 'Rail', 'Account', 'Routing', 'Currency', 'Status'];
    const rows = accounts.map(a => [a.bank, a.code, a.country, a.type, a.acct, a.routing, a.cur, a.st].map(x => x == null ? '' : x));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'disbursement_accounts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Disbursement accounts exported to CSV');
  };

  const handleAddAccount = () => {
    if (!form.bank.trim() || !form.routing.trim()) {
      notify('Please specify Bank Name and BIC/Routing');
      return;
    }
    const newAccount = {
      id: Date.now(),
      bank: form.bank,
      code: (form.code || form.bank.slice(0, 4)).toUpperCase(),
      country: form.country,
      type: form.type,
      acct: form.acct,
      routing: form.routing.toUpperCase(),
      cur: form.cur,
      st: 'Pending verification',
    };
    const next = [...accounts, newAccount];
    setAccounts(next);
    try { localStorage.setItem('mgh-disbursement-accounts', JSON.stringify(next)); } catch {}
    notify(`Account ${newAccount.bank} added successfully`);
    setAddOpen(false);
    setForm({ bank: '', code: '', country: 'Dominican Republic', type: 'Primary ACH', acct: '•••• ', routing: '', cur: 'DOP / USD' });
  };

  return <Page>
    <PageHeader breadcrumbs={['Payroll & Finance', 'Banking & Allocations']} title="Central Banking & Treasury" description="Cuentas de fondeo y rieles de pago de My Global Hub (Dominicana SRL). Estas cuentas se guardan solo en este navegador." actions={<><Button variant="secondary" icon="history" onClick={() => window.__mghGo('audit')}>Audit History</Button><Button icon="add_circle" onClick={() => setAddOpen(true)}>Add Bank Account</Button></>} />
    <Grid min={220}>
      <StatCard label="Accounts" value={String(accounts.length)} icon="account_balance" style={{ minHeight: 0 }} footer="Solo en este navegador" />
      <StatCard label="Pending verification" value={String(accounts.filter(a => a.st !== 'Verified').length)} icon="lock_clock" tone="warning" style={{ minHeight: 0 }} />
    </Grid>
    <Card padding={20} icon="account_balance" title="Disbursement accounts">
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search bank, country, rail…" actions={<Button size="sm" variant="secondary" icon="download" onClick={exportCsv}>Export CSV</Button>} />
      <DataTable style={{ marginTop: 14 }} sort={t.sort} onSort={t.setSort} rows={t.rows} columns={[
        { key: 'bank', label: 'Institution', sortable: true, render: r => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 36, height: 36, borderRadius: 8, background: r.id === 2 ? 'var(--mgh-navy)' : 'var(--mgh-primary-50)', color: r.id === 2 ? '#fff' : 'var(--mgh-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 11px var(--font-sans)' }}>{r.code}</span><div><div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{r.bank}</div><div style={{ font: '400 11px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{r.country}</div></div></div> },
        { key: 'type', label: 'Rail', sortable: true, render: r => <Badge size="sm" tone="primary" uppercase>{r.type}</Badge> }, { key: 'acct', label: 'Account', mono: true }, { key: 'routing', label: 'BIC / Routing', mono: true }, { key: 'cur', label: 'Currency' },
        { key: 'st', label: 'Status', render: r => <Badge size="sm" dot tone={r.st === 'Verified' ? 'success' : 'warning'}>{r.st || '—'}</Badge> }]} emptyText="No hay cuentas de fondeo registradas en este navegador." />
    </Card>
    <Card icon="call_split" title="Payout splits" subtitle="Configured per employee in their profile (bank / Coinbase allocation must total 100%)" />

    <Modal open={addOpen} title="Add Disbursement Bank Account" onClose={() => setAddOpen(false)} width={520}
      actions={<>
        <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
        <Button variant="primary" icon="add" onClick={handleAddAccount}>Save Account</Button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <TextField label="Bank Institution" value={form.bank} onChange={x => setForm(f => ({ ...f, bank: typeof x === 'string' ? x : x.target.value }))} placeholder="e.g. Banco Popular" />
        <TextField label="Bank Code" value={form.code} onChange={x => setForm(f => ({ ...f, code: typeof x === 'string' ? x : x.target.value }))} placeholder="e.g. BPD" />
        <TextField label="Country" value={form.country} onChange={x => setForm(f => ({ ...f, country: typeof x === 'string' ? x : x.target.value }))} placeholder="e.g. Dominican Republic" />
        <Select label="Payout Rail" value={form.type} onChange={x => setForm(f => ({ ...f, type: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={['Primary ACH', 'ACH (US)']} />
        <TextField label="Account Number / Masked" value={form.acct} mono onChange={x => setForm(f => ({ ...f, acct: typeof x === 'string' ? x : x.target.value }))} placeholder="•••• 1234" />
        <TextField label="BIC / Routing Number" value={form.routing} mono onChange={x => setForm(f => ({ ...f, routing: typeof x === 'string' ? x : x.target.value }))} placeholder="e.g. BPDODO22" />
        <Select label="Currency" value={form.cur} onChange={x => setForm(f => ({ ...f, cur: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={['DOP / USD', 'DOP', 'USD']} />
      </div>
    </Modal>
  </Page>;
}

window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { payroll: PayrollDashboard, processing: PayrollProcessing, paystub: PayStubPreview, banking: Banking });

})();

// ---- ScreensOps.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, MetricTile, DataTable, TableToolbar, Pagination, ActivityFeed, Tabs, PageHeader, Select, ProgressBar, KeyValue, Toggle, TextField, Checkbox } = window.MyGlobalHubDesignSystem_2a603d;

const PT = { 'On track': 'success', 'At risk': 'warning', 'Over budget': 'danger', 'Non-billable': 'neutral' };

function JiraIntegration({ notify }) {
  const [status, setStatus] = React.useState(null);
  const [issues, setIssues] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState(null);

  const loadData = React.useCallback(async () => {
    if (!window.api) return;
    setLoading(true);
    try {
      const [st, iss] = await Promise.all([
        window.api.jiraStatus ? window.api.jiraStatus().catch(() => null) : null,
        window.api.jiraIssues ? window.api.jiraIssues({ limit: 50 }).catch(() => []) : [],
      ]);
      if (st) {
        setStatus(st);
        if (st.connection && !st.connection.ok) {
          setErrorMsg(st.connection.message);
        } else {
          setErrorMsg(null);
        }
      }
      if (Array.isArray(iss)) {
        setIssues(iss);
      }
    } catch (e) {
      setErrorMsg('No se ha podido conectar con Jira');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncNow = async () => {
    if (!window.api || !window.api.syncJiraIssues) {
      if (notify) notify('API de sincronización no disponible');
      return;
    }
    setSyncing(true);
    setErrorMsg(null);
    try {
      const res = await window.api.syncJiraIssues(status?.projectKey ? { projectKey: status.projectKey } : {});
      if (res && res.ok) {
        if (notify) notify(`Sincronización completada: ${res.syncedCount || 0} tareas actualizadas desde Jira Cloud`);
        loadData();
      } else {
        const err = (res && res.error) || 'No se ha podido conectar con Jira';
        setErrorMsg(err);
        if (notify) notify(err);
      }
    } catch (err) {
      const msg = 'No se ha podido conectar con Jira: ' + (err.message || 'Error de red');
      setErrorMsg(msg);
      if (notify) notify(msg);
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = status?.connection?.ok;
  const lastSyncStr = status?.sync?.last_sync_at ? new Date(status.sync.last_sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pendiente';
  const totalCached = issues.length || (status?.cachedCount || 0);

  return <Page>
    <PageHeader
      breadcrumbs={['Integraciones', 'Sincronización Jira Cloud']}
      title="Integración Jira Cloud"
      status={
        isConnected ? (
          <Badge tone="success" dot>Conectado • {status?.host ? status.host.replace('https://', '') : 'Jira'} • Sincronizado {lastSyncStr}</Badge>
        ) : (
          <Badge tone="danger" dot>Desconectado • {status?.connection?.code ? `HTTP ${status.connection.code}` : 'Sin conexión'}</Badge>
        )
      }
      actions={
        <>
          <Button variant="secondary" icon="refresh" onClick={loadData} disabled={loading || syncing}>
            Refrescar
          </Button>
          <Button
            icon={syncing ? 'sync' : 'sync'}
            onClick={handleSyncNow}
            disabled={syncing}
          >
            {syncing ? 'Sincronizando...' : 'Sync Now'}
          </Button>
        </>
      }
    />

    {/* Alerta de conexión / Diagnóstico en vivo */}
    {errorMsg && (
      <div style={{
        background: '#FEF2F2',
        border: '1px solid #FCA5A5',
        borderRadius: 10,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: '#991B1B',
        marginBottom: 8
      }}>
        <Icon name="cloud_off" size={24} color="#DC2626" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{errorMsg}</div>
          <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
            La aplicación sigue usando las tareas ya guardadas en la base de datos ({totalCached} en total). Puedes registrar actividades mientras se restablece la conexión.
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={handleSyncNow} disabled={syncing}>
          Reintentar Conexión
        </Button>
      </div>
    )}

    <Grid min={220}>
      <StatCard label="Tareas guardadas" value={String(totalCached)} icon="inventory_2" tone="accent" />
      <StatCard label="Estado de sincronización" value={isConnected ? 'Conectado' : 'Sin conexión'} icon={isConnected ? 'check_circle' : 'database'} tone={isConnected ? 'success' : 'warning'} />
      <StatCard label="Proyecto configurado" value={status?.projectKey || '—'} icon="folder_open" tone="primary" />
      <StatCard label="Última sincronización" value={lastSyncStr} icon="history" delta={status?.sync?.status === 'SUCCESS' ? 'Completado' : (status?.sync?.status || undefined)} deltaTone={isConnected ? 'success' : 'neutral'} />
    </Grid>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(300px,1fr)', gap: 20 }}>
      <Card icon="hub" title="Arquitectura de Datos" subtitle="Jira es la fuente; la aplicación guarda una copia de las tareas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--mgh-surface-2)', padding: 8, borderRadius: 8 }}><Icon name="verified" size={20} color="var(--mgh-primary)" /></div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mgh-ink)' }}>Jira — Fuente Oficial</div>
              <div style={{ fontSize: 12, color: 'var(--mgh-ink-2)' }}>Jira conserva la autoridad sobre tickets, estados y flujos. El sistema local no los altera, solo los proyecta de forma segura.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--mgh-surface-2)', padding: 8, borderRadius: 8 }}><Icon name="bolt" size={20} color="#10B981" /></div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mgh-ink)' }}>Copia en la base de datos de la aplicación</div>
              <div style={{ fontSize: 12, color: 'var(--mgh-ink-2)' }}>Las tareas sincronizadas se guardan para el selector de actividades diarias y los reportes de conciliación.</div>
            </div>
          </div>
        </div>
      </Card>

      <Card icon="settings_ethernet" title="Conexión Jira Cloud">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <KeyValue label="Sitio Atlassian" value={status?.host ? status.host.replace('https://', '') : 'No configurado'} mono aside={<Badge tone={isConnected ? 'success' : 'warning'} size="sm">{status?.mode || (isConnected ? 'Conectado' : 'Sin conexión')}</Badge>} />
          <KeyValue label="Proyecto" value={status?.projectKey || '—'} mono />
          <KeyValue label="Cuenta / Correo" value={status?.email || 'No configurado'} mono />
        </div>
      </Card>
    </div>

    <Card icon="list_alt" title={`Tareas de Jira guardadas (${totalCached})`} bodyStyle={{ paddingTop: 14 }}>
      <DataTable
        density="compact"
        rows={issues.map((iss, idx) => ({ id: iss.key || idx, ...iss }))}
        columns={[
          { key: 'key', label: 'Clave', render: r => <Badge mono size="sm" tone="primary">{r.key}</Badge> },
          { key: 'summary', label: 'Título / Resumen', render: r => <span style={{ fontWeight: 600, color: 'var(--mgh-ink)' }}>{r.summary}</span> },
          { key: 'type', label: 'Tipo', render: r => <Badge size="xs">{r.type || 'Task'}</Badge> },
          { key: 'status', label: 'Estado', render: r => <Badge size="xs" tone={r.status === 'Done' ? 'success' : 'primary'}>{r.status}</Badge> },
          { key: 'assignee', label: 'Responsable', render: r => r.assignee || 'Sin asignar' },
          { key: 'estimate', label: 'Estimado', align: 'right', render: r => (r.estimate ? `${r.estimate}h` : '—') },
          { key: 'url', label: 'Jira Cloud', align: 'right', render: r => r.url ? <a href={r.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'var(--mgh-primary)', fontWeight: 600, fontSize: 12 }}>Abrir ↗</a> : '—' },
        ]}
      />
    </Card>
  </Page>;
}

// Employees, contractors and supervisors see only their projects (members-only); PM/admin get the full workspace
function Projects(props) {
  const role = window.MGH_RBAC ? window.MGH_RBAC.role : '';
  return ['Employee', 'Contractor', 'Supervisor'].includes(role) ? <MyProjects {...props} /> : <ProjectsWorkspace {...props} />;
}
function ProjectsWorkspace({ go, notify, currentUser }) {
  const ModalComp = window.Modal || (window.MyGlobalHubDesignSystem_2a603d && window.MyGlobalHubDesignSystem_2a603d.Modal);
  const [mainTab, setMainTab] = React.useState('agile');
  const [activeAgileProjectKey, setActiveAgileProjectKey] = React.useState(null);
  const [chip, setChip] = React.useState('all');
  const [projectsList, setProjectsList] = React.useState([]);
  const [loadingProjects, setLoadingProjects] = React.useState(false);

  // Equipo y Colaboradores
  const [employeesList, setEmployeesList] = React.useState(EMPLOYEES || []);
  const [loadingEmployees, setLoadingEmployees] = React.useState(false);
  const [teamSearch, setTeamSearch] = React.useState('');
  const [teamProjectFilter, setTeamProjectFilter] = React.useState('all');
  const [teamTypeFilter, setTeamTypeFilter] = React.useState('all');

  // Empty numeric inputs are sent as null: never invent a budget or a billable %
  const numOrNull = x => { if (x == null || String(x).trim() === '') return null; const n = Number(x); return Number.isFinite(n) ? n : null; };
  // Modal para Crear Nuevo Proyecto
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false);
  const [creatingProject, setCreatingProject] = React.useState(false);
  const [projectForm, setProjectForm] = React.useState({
    name: '',
    key: '',
    lead: (currentUser && (currentUser.name || currentUser.userName)) || '',
    budget: '',
    bill: '',
    st: 'On track'
  });

  // Modal para Editar Proyecto
  const [editProjectOpen, setEditProjectOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState(false);
  const [projectToEdit, setProjectToEdit] = React.useState(null);
  const [editProjectForm, setEditProjectForm] = React.useState({
    key: '',
    name: '',
    lead: '',
    budget: '',
    bill: '',
    st: 'On track'
  });

  // Modal para Crear Nuevo Trabajador
  const [createWorkerOpen, setCreateWorkerOpen] = React.useState(false);
  const [creatingWorker, setCreatingWorker] = React.useState(false);
  const [createdSummary, setCreatedSummary] = React.useState(null);
  // Empty form: password is optional (the server generates a one-time one); no sample role/project/rate
  const emptyWorker = () => ({
    first: '',
    last: '',
    email: '',
    password: '',
    role: '',
    systemRole: 'employee',
    type: 'Full-time',
    project: '',
    rate: '',
    entity: 'MGH Dominicana SRL',
    mgr: (currentUser && (currentUser.name || currentUser.userName)) || ''
  });
  const [workerForm, setWorkerForm] = React.useState(emptyWorker);

  // Modal para Multi-Asignación de Proyectos a Trabajadores
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [reassigning, setReassigning] = React.useState(false);
  const [selectedWorker, setSelectedWorker] = React.useState(null);
  const [selectedProjects, setSelectedProjects] = React.useState([]);
  const [projectSearchModal, setProjectSearchModal] = React.useState('');

  // Modal para Vincular Proyecto Jira
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [projectKeyInput, setProjectKeyInput] = React.useState('');
  const [linking, setLinking] = React.useState(false);
  const [linkError, setLinkError] = React.useState(null);
  const [linkedResult, setLinkedResult] = React.useState(null);
  const [syncingNewTasks, setSyncingNewTasks] = React.useState(false);

  // Modal para Ver Tareas de un Proyecto
  const [tasksModalOpen, setTasksModalOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState(null);
  const [projectTasks, setProjectTasks] = React.useState([]);
  const [loadingTasks, setLoadingTasks] = React.useState(false);
  const [syncingTasks, setSyncingTasks] = React.useState(false);
  const [tasksError, setTasksError] = React.useState(null);
  const [tasksLastSyncAt, setTasksLastSyncAt] = React.useState(null);
  const [isOfflineTasks, setIsOfflineTasks] = React.useState(false);
  const [taskQuery, setTaskQuery] = React.useState('');
  const [taskStatusFilter, setTaskStatusFilter] = React.useState('all');

  // Cargar proyectos desde el backend
  const fetchProjects = React.useCallback(async () => {
    try {
      setLoadingProjects(true);
      const fn = (window.api && window.api.jiraProjects) || (typeof api !== 'undefined' && api.jiraProjects);
      if (fn) {
        const res = await fn();
        if (Array.isArray(res)) {
          setProjectsList(res);
        }
      }
    } catch (err) {
      console.warn('Error cargando proyectos desde API:', err.message);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  // Cargar empleados desde el backend
  const fetchEmployees = React.useCallback(async () => {
    try {
      setLoadingEmployees(true);
      const fn = (window.api && window.api.employees) || (typeof api !== 'undefined' && api.employees);
      if (fn) {
        const res = await fn();
        if (Array.isArray(res) && res.length > 0) {
          setEmployeesList(res);
          res.forEach(item => {
            const found = EMPLOYEES.find(e => e.id === item.id);
            if (found) {
              const prevHours = {
                reg: typeof found.reg === 'number' ? found.reg : 0,
                ot: typeof found.ot === 'number' ? found.ot : 0,
                pto: typeof found.pto === 'number' ? found.pto : 0,
                total: typeof found.total === 'number' ? found.total : 0,
                gross: typeof found.gross === 'number' ? found.gross : 0,
                match: hasMatch(found) ? found.match : null
              };
              Object.assign(found, Object.fromEntries(Object.entries(item).filter(([, v]) => v != null && v !== '')));
              found.ot_eligible = Boolean(item.ot);
              found.ot = prevHours.ot;
              found.reg = prevHours.reg;
              found.pto = prevHours.pto;
              found.total = prevHours.total;
              found.gross = prevHours.gross;
              found.match = prevHours.match;
            } else {
              // New employee: no timesheet yet, so no hours or pay
              const fullEmp = {
                reg: 0,
                ot: 0,
                pto: 0,
                total: 0,
                gross: 0,
                match: null,
                rate: Number(item.rate) || 0,
                ot_eligible: Boolean(item.ot),
                ...item
              };
              fullEmp.ot = 0;
              EMPLOYEES.push(fullEmp);
            }
          });
        }
      }
    } catch (err) {
      console.warn('Error cargando empleados:', err.message);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProjects();
    fetchEmployees();
  }, [fetchProjects, fetchEmployees]);

  const allProjectNames = Array.from(new Set(projectsList.map(p => p.name || p.id)));

  // Crear nuevo trabajador y usuario
  const handleCreateWorker = async () => {
    if (!workerForm.first.trim()) {
      if (notify) notify('El nombre del trabajador es obligatorio.');
      return;
    }
    if (!workerForm.email.trim() || !workerForm.email.includes('@')) {
      if (notify) notify('Ingresa un correo electrónico corporativo válido.');
      return;
    }
    if (workerForm.password && (workerForm.password.length < 10 || !/[a-z]/.test(workerForm.password) || !/[A-Z]/.test(workerForm.password) || !/\d/.test(workerForm.password))) {
      if (notify) notify('La contraseña debe tener al menos 10 caracteres con mayúscula, minúscula y número (o déjala vacía para generar una segura).');
      return;
    }
    if (!(Number(workerForm.rate) > 0)) {
      if (notify) notify('Ingresa la tarifa por hora del trabajador.');
      return;
    }
    if (!workerForm.project) {
      if (notify) notify('Selecciona el proyecto inicial del trabajador.');
      return;
    }

    setCreatingWorker(true);
    try {
      const fn = (window.api && window.api.createEmployee) || (typeof api !== 'undefined' && api.createEmployee);
      if (!fn) throw new Error('API createEmployee no disponible');

      const fullName = `${workerForm.first.trim()} ${workerForm.last.trim()}`.trim();
      const payload = {
        ...workerForm,
        name: fullName,
        title: workerForm.role,
        etype: workerForm.type,
        projects: workerForm.project,
        password: workerForm.password || undefined,
        rate: Number(workerForm.rate),
        mgr: workerForm.mgr || ''
      };

      const res = await fn(payload);
      const createdId = res && res.id;
      if (!createdId) throw new Error('el servidor no devolvió el ID del empleado');

      setCreatedSummary({
        id: createdId,
        name: fullName,
        email: workerForm.email,
        // The password typed by the admin, or the one-time password generated by the server
        password: workerForm.password || (res && res.initialPassword) || '',
        account: (res && res.account) || null,
        role: workerForm.role,
        project: workerForm.project,
        rate: workerForm.rate
      });

      if (notify) {
        notify(`Trabajador ${fullName} (${createdId}) creado y asignado a ${workerForm.project}`);
      }

      setWorkerForm(emptyWorker());
      fetchEmployees();
    } catch (err) {
      if (notify) notify('Error al crear trabajador: ' + (err.message || 'Error del servidor'));
    } finally {
      setCreatingWorker(false);
    }
  };

  // Helper para extraer y parsear los proyectos asignados a un colaborador
  const parseWorkerProjects = React.useCallback((worker) => {
    if (!worker) return [];
    const raw = (worker.project || worker.projects || '');
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }, []);

  // CRUD de Proyectos: Crear
  const handleCreateProject = async () => {
    if (!projectForm.name.trim()) {
      if (notify) notify('El nombre del proyecto es obligatorio.');
      return;
    }
    setCreatingProject(true);
    try {
      const fn = (window.api && window.api.createProject) || (typeof api !== 'undefined' && api.createProject);
      if (!fn) throw new Error('API createProject no disponible');
      const res = await fn({
        name: projectForm.name.trim(),
        key: projectForm.key ? projectForm.key.trim().toUpperCase() : undefined,
        lead: projectForm.lead || '',
        budget: numOrNull(projectForm.budget),
        bill: numOrNull(projectForm.bill),
        st: projectForm.st || 'On track'
      });
      if (notify) notify(`Proyecto '${res.name}' (${res.key}) creado exitosamente`);
      setCreateProjectOpen(false);
      setProjectForm({
        name: '',
        key: '',
        lead: (currentUser && (currentUser.name || currentUser.userName)) || '',
        budget: '',
        bill: '',
        st: 'On track'
      });
      fetchProjects();
    } catch (err) {
      if (notify) notify('Error al crear proyecto: ' + (err.message || 'Error del servidor'));
    } finally {
      setCreatingProject(false);
    }
  };

  // CRUD de Proyectos: Abrir Edición
  const handleOpenEditProject = (proj) => {
    setProjectToEdit(proj);
    setEditProjectForm({
      key: proj.key || proj.id,
      name: proj.name || '',
      lead: proj.lead || '',
      budget: proj.budget != null && proj.budget !== '' ? String(proj.budget) : '',
      bill: proj.bill != null && proj.bill !== '' ? String(proj.bill) : '',
      st: proj.st || 'On track'
    });
    setEditProjectOpen(true);
  };

  // CRUD de Proyectos: Guardar Edición
  const handleSaveEditProject = async () => {
    if (!projectToEdit) return;
    if (!editProjectForm.name.trim()) {
      if (notify) notify('El nombre del proyecto es obligatorio.');
      return;
    }
    setEditingProject(true);
    try {
      const fn = (window.api && window.api.updateProject) || (typeof api !== 'undefined' && api.updateProject);
      if (!fn) throw new Error('API updateProject no disponible');
      await fn(projectToEdit.key || projectToEdit.id, {
        name: editProjectForm.name.trim(),
        lead: editProjectForm.lead,
        budget: numOrNull(editProjectForm.budget),
        bill: numOrNull(editProjectForm.bill),
        st: editProjectForm.st
      });
      if (notify) notify(`Proyecto '${editProjectForm.name}' actualizado exitosamente`);
      setEditProjectOpen(false);
      setProjectToEdit(null);
      fetchProjects();
    } catch (err) {
      if (notify) notify('Error al actualizar proyecto: ' + (err.message || 'Error del servidor'));
    } finally {
      setEditingProject(false);
    }
  };

  // CRUD de Proyectos: Eliminar
  const handleDeleteProject = async (proj) => {
    const key = proj.key || proj.id;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el proyecto "${proj.name}" (${key})?`)) {
      return;
    }
    try {
      const fn = (window.api && window.api.deleteProject) || (typeof api !== 'undefined' && api.deleteProject);
      if (!fn) throw new Error('API deleteProject no disponible');
      await fn(key);
      if (notify) notify(`Proyecto '${proj.name}' eliminado.`);
      fetchProjects();
    } catch (err) {
      if (notify) notify('Error al eliminar proyecto: ' + (err.message || 'Error del servidor'));
    }
  };

  // Abrir modal de asignación múltiple de proyectos
  const handleOpenReassign = (worker) => {
    setSelectedWorker(worker);
    const currentProjs = parseWorkerProjects(worker);
    setSelectedProjects(currentProjs);
    setProjectSearchModal('');
    setReassignOpen(true);
  };

  // Alternar selección de proyecto para el trabajador
  const handleToggleProject = (projName) => {
    setSelectedProjects(prev => {
      if (prev.includes(projName)) {
        return prev.filter(p => p !== projName);
      } else {
        return [...prev, projName];
      }
    });
  };

  // Confirmar asignaciones múltiples de proyecto
  const handleConfirmReassign = async () => {
    if (!selectedWorker) return;
    setReassigning(true);
    try {
      const fn = (window.api && window.api.updateEmployee) || (typeof api !== 'undefined' && api.updateEmployee);
      if (!fn) throw new Error('API updateEmployee no disponible');

      const projectsJoined = selectedProjects.join(', ');
      await fn(selectedWorker.id, { projects: selectedProjects, project: projectsJoined });

      setEmployeesList(prev => prev.map(w => w.id === selectedWorker.id ? { ...w, project: projectsJoined, projects: projectsJoined } : w));
      const foundGlobal = EMPLOYEES.find(e => e.id === selectedWorker.id);
      if (foundGlobal) {
        foundGlobal.project = projectsJoined;
        foundGlobal.projects = projectsJoined;
      }

      if (notify) notify(`Proyectos actualizados para ${selectedWorker.name}: ${projectsJoined || 'Sin proyectos'}`);
      setReassignOpen(false);
      setSelectedWorker(null);
      fetchProjects();
    } catch (err) {
      if (notify) notify('Error al asignar proyectos: ' + (err.message || 'Error del servidor'));
    } finally {
      setReassigning(false);
    }
  };

  // Abrir modal de tareas para un proyecto
  const handleOpenTasks = async (p) => {
    const projKey = (p.key || p.id).toUpperCase();
    setSelectedProject(p);
    setTasksModalOpen(true);
    setTaskQuery('');
    setTaskStatusFilter('all');
    setTasksError(null);
    setLoadingTasks(true);

    try {
      const fn = api.jiraProjectIssues || (window.api && window.api.jiraProjectIssues);
      if (fn) {
        const res = await fn(projKey);
        if (res && res.ok) {
          setProjectTasks(res.issues || []);
          setTasksLastSyncAt(res.lastSyncAt || p.last_sync_at || null);
          setIsOfflineTasks(Boolean(res.isOfflineFallback || !res.isConfigured));
        } else {
          setProjectTasks(res?.issues || []);
          setTasksLastSyncAt(res?.lastSyncAt || p.last_sync_at || null);
        }
      }
    } catch (err) {
      setTasksError('No se ha podido conectar con Jira. Mostrando las tareas ya guardadas.');
      setIsOfflineTasks(true);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Sincronizar tareas del proyecto actualmente seleccionado en el modal
  const handleSyncCurrentProject = async () => {
    if (!selectedProject) return;
    const projKey = (selectedProject.key || selectedProject.id).toUpperCase();
    setSyncingTasks(true);
    setTasksError(null);

    try {
      const fn = api.syncProjectIssues || (window.api && window.api.syncProjectIssues);
      if (!fn) throw new Error('API de sincronización no disponible');

      const res = await fn(projKey, { limit: 100 });
      if (res && res.ok) {
        setTasksLastSyncAt(res.lastSyncAt);
        setIsOfflineTasks(false);
        if (notify) notify(`Sincronización exitosa: ${res.syncedCount} incidencias de ${projKey}`);
        const issuesRes = await api.jiraProjectIssues(projKey);
        if (issuesRes && issuesRes.ok) {
          setProjectTasks(issuesRes.issues || []);
        }
        fetchProjects();
      } else {
        const errDetail = res?.error || 'Error al sincronizar con Jira';
        setTasksError(errDetail);
        setIsOfflineTasks(true);
        if (notify) notify(errDetail);
      }
    } catch (err) {
      const msg = err.message || 'No se ha podido conectar con Jira Cloud';
      setTasksError(msg);
      setIsOfflineTasks(true);
      if (notify) notify(msg);
    } finally {
      setSyncingTasks(false);
    }
  };

  // Validar y vincular proyecto manualmente desde el popup
  const handleValidateAndLink = async () => {
    const rawKey = projectKeyInput.trim();
    if (!rawKey) {
      setLinkError('La clave del proyecto Jira es obligatoria.');
      return;
    }
    setLinking(true);
    setLinkError(null);

    try {
      const fn = api.linkJiraProject || (window.api && window.api.linkJiraProject);
      if (!fn) throw new Error('API para vincular proyecto no disponible');

      const res = await fn({ key: rawKey.toUpperCase() });
      if (res && res.ok) {
        setLinkedResult(res.project);
        setProjectsList(prev => {
          const exists = prev.some(p => (p.key || p.id).toUpperCase() === res.project.key.toUpperCase());
          if (exists) {
            return prev.map(p => (p.key || p.id).toUpperCase() === res.project.key.toUpperCase() ? { ...p, ...res.project } : p);
          }
          return [res.project, ...prev];
        });
        if (notify) notify(res.message || `Proyecto ${res.project.name} vinculado correctamente.`);
      } else {
        setLinkError(res?.error || 'No se ha podido vincular el proyecto.');
      }
    } catch (err) {
      setLinkError(err.message || 'Error al validar proyecto en Jira.');
    } finally {
      setLinking(false);
    }
  };

  // Sincronizar tareas del proyecto recién vinculado
  const handleSyncNewlyLinked = async () => {
    if (!linkedResult) return;
    setSyncingNewTasks(true);
    try {
      const fn = api.syncProjectIssues || (window.api && window.api.syncProjectIssues);
      const res = await fn(linkedResult.key, { limit: 100 });
      if (res && res.ok) {
        if (notify) notify(`Sincronizadas ${res.syncedCount} tareas para ${linkedResult.key}`);
        fetchProjects();
        const linkedCopy = linkedResult;
        setLinkModalOpen(false);
        setLinkedResult(null);
        setProjectKeyInput('');
        handleOpenTasks(linkedCopy);
      } else {
        if (notify) notify(res?.error || 'Error al sincronizar tareas');
      }
    } catch (err) {
      if (notify) notify(err.message || 'Error al sincronizar');
    } finally {
      setSyncingNewTasks(false);
    }
  };

  const closeLinkModal = () => {
    setLinkModalOpen(false);
    setProjectKeyInput('');
    setLinkError(null);
    setLinkedResult(null);
  };

  const filteredProjects = projectsList.filter(p => chip === 'all' || p.st === chip);
  const t = useTable(filteredProjects, { search: ['name', 'id', 'key', 'lead'], pageSize: 10, initialSort: { key: 'spent', dir: 'desc' } });

  const filteredTasks = projectTasks.filter(item => {
    const matchesQuery = !taskQuery || 
      item.key.toLowerCase().includes(taskQuery.toLowerCase()) || 
      (item.summary && item.summary.toLowerCase().includes(taskQuery.toLowerCase())) ||
      (item.assignee && item.assignee.toLowerCase().includes(taskQuery.toLowerCase()));
    const matchesStatus = taskStatusFilter === 'all' || (item.status && item.status.toLowerCase() === taskStatusFilter.toLowerCase());
    return matchesQuery && matchesStatus;
  });

  const availableTaskStatuses = Array.from(new Set(projectTasks.map(x => x.status).filter(Boolean)));

  const formatSyncDate = (dStr) => {
    if (!dStr) return 'Pendiente de sincronizar';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleString('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (_) {
      return dStr;
    }
  };

  const formatTaskUpdated = (dStr) => {
    if (!dStr) return '—';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return dStr;
    }
  };

  const getStatusTone = (st) => {
    if (!st) return 'neutral';
    const s = st.toLowerCase();
    if (s.includes('done') || s.includes('finaliz') || s.includes('listo') || s.includes('complet')) return 'success';
    if (s.includes('in progress') || s.includes('curso') || s.includes('desarroll') || s.includes('review')) return 'primary';
    if (s.includes('block') || s.includes('impedimento') || s.includes('cancel')) return 'danger';
    return 'warning';
  };

  const filteredTeam = employeesList.filter(e => {
    const fullName = (e.name || `${e.first || ''} ${e.last || ''}`).toLowerCase();
    const id = (e.id || '').toLowerCase();
    const email = (e.email || '').toLowerCase();
    const role = (e.role || e.title || '').toLowerCase();
    const projs = parseWorkerProjects(e);
    const projsStr = projs.join(' ').toLowerCase();
    const q = teamSearch.toLowerCase().trim();

    const matchesSearch = !q || fullName.includes(q) || id.includes(q) || email.includes(q) || role.includes(q) || projsStr.includes(q);
    const matchesProject = teamProjectFilter === 'all' || projs.includes(teamProjectFilter);
    const matchesType = teamTypeFilter === 'all' || (e.etype || e.type) === teamTypeFilter;
    return matchesSearch && matchesProject && matchesType;
  });

  return <Page>
    <PageHeader
      breadcrumbs={['Gestión Operativa', mainTab === 'projects' ? 'Cartera de Proyectos' : 'Asignación de Trabajadores']}
      title="Gestión de Proyectos & Asignación de Equipo"
      description="Crea y administra proyectos, presupuestos de labor y asigna uno o más proyectos a cada colaborador de la organización."
      actions={
        mainTab === 'projects' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="primary"
              icon="add"
              onClick={() => setCreateProjectOpen(true)}
            >
              + Nuevo Proyecto
            </Button>
            <Button
              variant="secondary"
              icon="cloud_sync"
              onClick={() => { setLinkError(null); setLinkedResult(null); setLinkModalOpen(true); }}
            >
              Vincular Jira Cloud
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="primary"
              icon="person_add"
              onClick={() => { setCreatedSummary(null); setCreateWorkerOpen(true); }}
            >
              + Crear Cuenta Trabajador
            </Button>
            <Button
              variant="secondary"
              icon="open_in_new"
              onClick={() => go && go('addEmployee')}
            >
              Onboarding Guiado
            </Button>
          </div>
        )
      }
    />

    {/* Selector de Pestaña Principal: Tableros Ágiles vs Cartera vs Asignación de Equipo */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <Button
        variant={mainTab === 'agile' ? 'primary' : 'secondary'}
        icon="view_kanban"
        onClick={() => setMainTab('agile')}
      >
        Gestión Ágil & Tableros
      </Button>
      <Button
        variant={mainTab === 'projects' ? 'primary' : 'secondary'}
        icon="folder_special"
        onClick={() => setMainTab('projects')}
      >
        Cartera & Presupuestos ({projectsList.length})
      </Button>
      <Button
        variant={mainTab === 'team' ? 'primary' : 'secondary'}
        icon="group"
        onClick={() => setMainTab('team')}
      >
        Asignación de Trabajadores ({employeesList.length})
      </Button>
    </div>

    {mainTab === 'agile' ? (
      <AgileWorkspace
        currentProjectKey={activeAgileProjectKey}
        projects={projectsList}
        onSelectProject={key => setActiveAgileProjectKey(key)}
        currentUser={currentUser}
        notify={notify}
        go={go}
      />
    ) : mainTab === 'projects' ? (
      <>
        {/* Métricas Globales de Proyectos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
          <StatCard
            label="Total Proyectos Activos"
            value={String(projectsList.length)}
            icon="folder_special"
            style={{ minHeight: 0 }}
          />
          <StatCard
            label="Presupuesto Asignado"
            value={(() => { const withBudget = projectsList.filter(p => Number(p.budget) > 0); return withBudget.length ? `$${Math.round(withBudget.reduce((s, p) => s + Number(p.budget), 0) / 1000)}k` : '—'; })()}
            unit="USD"
            icon="account_balance_wallet"
            tone="accent"
            style={{ minHeight: 0 }}
          />
          <StatCard
            label="Presupuesto Consumido"
            value={`$${Math.round(projectsList.reduce((s, p) => s + (p.spent || 0), 0) / 1000)}k`}
            unit="USD"
            icon="payments"
            tone="primary"
            style={{ minHeight: 0 }}
          />
          <StatCard
            label="Salud de Cartera"
            value={`${projectsList.filter(p => p.st === 'On track').length} en orden`}
            footer={<span style={{ color: projectsList.filter(p => p.st !== 'On track').length > 0 ? 'var(--mgh-danger)' : 'var(--mgh-success)' }}>{projectsList.filter(p => p.st !== 'On track').length} en riesgo / excedidos</span>}
            icon="health_and_safety"
            tone={projectsList.filter(p => p.st !== 'On track').length > 0 ? 'warning' : 'success'}
            style={{ minHeight: 0 }}
          />
        </div>

        {/* Tabla CRUD de Proyectos */}
        <Card padding={20}>
          <TableToolbar
            search={t.q}
            onSearch={t.setQ}
            placeholder="Buscar proyecto por nombre, clave, responsable…"
            actions={
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" variant="primary" icon="add" onClick={() => setCreateProjectOpen(true)}>
                  + Crear Proyecto
                </Button>
                <Button size="sm" variant="secondary" icon="cloud_sync" onClick={() => { setLinkError(null); setLinkedResult(null); setLinkModalOpen(true); }}>
                  Vincular Jira
                </Button>
                <Button size="sm" variant="secondary" icon="download" disabled={!projectsList.length} onClick={() => window.__mghNotify(window.__mghExport('csv', 'Projects', '', { cols: [['Key'], ['Name'], ['Lead'], ['People'], ['Budget'], ['Spent'], ['Hours'], ['Status']], rows: projectsList.map(p => [p.key || p.id, p.name, p.lead || '', p.people || 0, p.budget != null ? p.budget : '', p.spent != null ? p.spent : '', p.hrs || 0, p.st || '']) }))}>
                  Exportar
                </Button>
              </div>
            }
            chips={
              <FilterChips
                value={chip}
                onChange={setChip}
                options={[
                  { value: 'all', label: 'Todos', count: projectsList.length },
                  { value: 'On track', label: 'En orden' },
                  { value: 'At risk', label: 'En riesgo', tone: 'warning' },
                  { value: 'Over budget', label: 'Excedido', tone: 'danger' }
                ]}
              />
            }
          />
          <DataTable
            style={{ marginTop: 14 }}
            sort={t.sort}
            onSort={t.setSort}
            rows={t.rows}
            columns={[
              {
                key: 'name',
                label: 'Proyecto',
                sortable: true,
                render: r => (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Badge mono tone="dark">{r.key || r.id}</Badge>
                    <div>
                      <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{r.name}</div>
                      {r.last_sync_at && (
                        <div style={{ font: '400 11px var(--font-sans)', color: 'var(--mgh-ink-3)', marginTop: 2 }}>
                          Sincronizado: {formatSyncDate(r.last_sync_at)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              },
              { key: 'lead', label: 'Líder / Lead', sortable: true },
              {
                key: 'people',
                label: 'Personas',
                align: 'right',
                sortable: true,
                render: r => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                    <Icon name="group" size={14} color="var(--mgh-ink-3)" />
                    {r.people || 0}
                  </span>
                )
              },
              { key: 'hrs', label: 'Horas', align: 'right', sortable: true, render: r => (r.hrs != null ? r.hrs.toLocaleString() + 'h' : '0h') },
              {
                key: 'spent',
                label: 'Presupuesto usado',
                sortable: true,
                width: 200,
                render: r => {
                  const budget = Number(r.budget), spent = Number(r.spent) || 0;
                  if (!(budget > 0)) return <span style={{ color: 'var(--mgh-ink-3)' }}>—</span>;
                  const pct = Math.round((spent / budget) * 100);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ProgressBar
                        style={{ flex: 1 }}
                        value={pct}
                        tone={spent > budget ? 'danger' : pct > 85 ? 'warning' : 'primary'}
                      />
                      <span style={{ font: '600 12px var(--font-sans)', width: 40, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  );
                }
              },
              { key: 'bill', label: 'Facturable', align: 'right', sortable: true, render: r => r.bill != null && r.bill !== '' ? r.bill + '%' : '—' },
              { key: 'st', label: 'Estado', render: r => <Badge size="sm" dot tone={PT[r.st] || 'neutral'}>{r.st}</Badge> },
              {
                key: 'actions',
                label: 'Acciones',
                align: 'right',
                render: r => (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button
                      size="sm"
                      variant="primary"
                      icon="view_kanban"
                      onClick={() => {
                        setActiveAgileProjectKey(r.key || r.id);
                        setMainTab('agile');
                      }}
                      title="Abrir Tablero Ágil y Sprints"
                    >
                      Tablero Ágil
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="edit"
                      onClick={() => handleOpenEditProject(r)}
                      title="Editar proyecto"
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="visibility"
                      onClick={() => handleOpenTasks(r)}
                      title="Ver tareas Jira"
                    >
                      Tareas
                    </Button>
                    <IconButton
                      icon="delete"
                      size="sm"
                      tone="danger"
                      onClick={() => handleDeleteProject(r)}
                      title="Eliminar proyecto"
                    />
                  </div>
                )
              }
            ]}
          />
        </Card>
      </>
    ) : (
      <>
        {/* Métricas del Equipo para PM */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
          <StatCard
            label="Total Colaboradores"
            value={String(employeesList.length)}
            icon="group"
            style={{ minHeight: 0 }}
          />
          <StatCard
            label="Con Proyectos Asignados"
            value={String(employeesList.filter(e => parseWorkerProjects(e).length > 0).length)}
            unit={`/ ${employeesList.length}`}
            icon="task_alt"
            tone="success"
            style={{ minHeight: 0 }}
          />
          <StatCard
            label="Con Múltiples Proyectos"
            value={String(employeesList.filter(e => parseWorkerProjects(e).length > 1).length)}
            icon="account_tree"
            tone="primary"
            style={{ minHeight: 0 }}
          />
          <StatCard
            label="Sin Proyecto Asignado"
            value={String(employeesList.filter(e => parseWorkerProjects(e).length === 0).length)}
            icon="warning"
            tone="warning"
            style={{ minHeight: 0 }}
          />
        </div>

        {/* Tabla de Asignación de Proyectos a Trabajadores */}
        <Card padding={20}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#fff',
                border: '1px solid var(--mgh-surface-3, #CBD5E1)',
                borderRadius: 8,
                padding: '0 10px',
                height: 36,
                minWidth: 260
              }}>
                <Icon name="search" size={18} color="var(--mgh-ink-3)" />
                <input
                  type="text"
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  placeholder="Buscar por colaborador, cargo, correo, ID o proyecto..."
                  style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 13 }}
                />
                {teamSearch && (
                  <button
                    onClick={() => setTeamSearch('')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mgh-ink-3)', padding: 0 }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--mgh-ink-3)', fontWeight: 600 }}>Proyecto:</span>
                <select
                  value={teamProjectFilter}
                  onChange={e => setTeamProjectFilter(e.target.value)}
                  style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', background: '#fff', fontSize: 12, fontWeight: 500 }}
                >
                  <option value="all">Todos los proyectos ({allProjectNames.length})</option>
                  {allProjectNames.map(pn => (
                    <option key={pn} value={pn}>{pn}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--mgh-ink-3)', fontWeight: 600 }}>Tipo:</span>
                <select
                  value={teamTypeFilter}
                  onChange={e => setTeamTypeFilter(e.target.value)}
                  style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', background: '#fff', fontSize: 12, fontWeight: 500 }}
                >
                  <option value="all">Todos los contratos</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Part-time">Part-time</option>
                </select>
              </div>
            </div>

            <Button
              variant="primary"
              icon="person_add"
              onClick={() => { setCreatedSummary(null); setCreateWorkerOpen(true); }}
            >
              + Nuevo Trabajador
            </Button>
          </div>

          <DataTable
            density="regular"
            rows={filteredTeam}
            columns={[
              {
                key: 'name',
                label: 'Colaborador',
                render: r => (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar name={r.name || `${r.first || ''} ${r.last || ''}`} size={34} />
                    <div>
                      <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                        {r.name || `${r.first || ''} ${r.last || ''}`}
                      </div>
                      <div style={{ font: '400 11px var(--font-sans)', color: 'var(--mgh-ink-3)', marginTop: 2 }}>
                        {r.email || '—'}
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: 'id',
                label: 'ID',
                render: r => <Badge mono size="sm">{r.id}</Badge>
              },
              {
                key: 'role',
                label: 'Cargo / Especialidad',
                render: r => (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mgh-ink)' }}>{r.role || r.title || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--mgh-ink-3)' }}>{r.dept || '—'}</div>
                  </div>
                )
              },
              {
                key: 'type',
                label: 'Tipo',
                render: r => {
                  const tp = r.etype || r.type || '—';
                  return <Badge size="xs" tone={tp === 'Contractor' ? 'accent' : 'neutral'}>{tp}</Badge>;
                }
              },
              {
                key: 'projects',
                label: 'Proyectos Asignados',
                render: r => {
                  const projs = parseWorkerProjects(r);
                  if (projs.length === 0) {
                    return <Badge tone="warning" size="xs">Sin proyectos</Badge>;
                  }
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 300 }}>
                      {projs.map(p => (
                        <Badge key={p} mono tone="primary" size="xs">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  );
                }
              },
              {
                key: 'mgr',
                label: 'Supervisor / PM',
                render: r => <span style={{ fontSize: 12, color: 'var(--mgh-ink-2)' }}>{r.mgr || '—'}</span>
              },
              {
                key: 'rate',
                label: 'Tarifa',
                align: 'right',
                render: r => (
                  <span style={{ font: '600 13px var(--font-mono, monospace)', color: 'var(--mgh-ink)' }}>
                    {r.rate != null && r.rate !== '' && Number.isFinite(Number(r.rate)) ? '$' + Number(r.rate).toFixed(2) + '/h' : '—'}
                  </span>
                )
              },
              {
                key: 'actions',
                label: 'Acciones',
                align: 'right',
                render: r => (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button
                      size="sm"
                      variant="primary"
                      icon="assignment"
                      onClick={() => handleOpenReassign(r)}
                    >
                      Asignar Proyectos
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="visibility"
                      onClick={() => go && go('profile', r.id)}
                      title="Ver perfil"
                    >
                      Perfil
                    </Button>
                  </div>
                )
              }
            ]}
          />
        </Card>
      </>
    )}

    {/* POPUP / MODAL: Vincular proyecto Jira */}
    {ModalComp && (
      <ModalComp
        open={linkModalOpen}
        title="Vincular Proyecto Jira"
        onClose={closeLinkModal}
        width={520}
        actions={
          !linkedResult ? (
            <>
              <Button variant="secondary" onClick={closeLinkModal} disabled={linking}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                icon="check_circle"
                disabled={!projectKeyInput.trim() || linking}
                onClick={handleValidateAndLink}
              >
                {linking ? 'Validando con Jira...' : 'Validar y vincular'}
              </Button>
            </>
          ) : null
        }
      >
        {!linkedResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ font: '400 13px var(--font-sans)', color: 'var(--mgh-ink-2)', lineHeight: '18px' }}>
              Ingresa la clave oficial del proyecto en Jira Cloud. El backend verificará la existencia en vivo del proyecto y los permisos de la cuenta antes de registrarlo.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Clave del proyecto Jira <span style={{ color: 'var(--mgh-danger)' }}>*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={projectKeyInput}
                onChange={e => setProjectKeyInput(e.target.value.toUpperCase())}
                placeholder="ej. MSHP, ARW, TR3"
                disabled={linking}
                style={{
                  height: 40,
                  padding: '0 12px',
                  borderRadius: 'var(--radius-8, 8px)',
                  border: linkError ? '1px solid var(--mgh-danger)' : '1px solid var(--mgh-surface-3, #CBD5E1)',
                  font: '600 14px var(--font-mono, monospace)',
                  color: 'var(--mgh-ink)',
                  background: '#fff',
                  outline: 'none',
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && projectKeyInput.trim() && !linking) {
                    handleValidateAndLink();
                  }
                }}
              />
              <div style={{ font: '400 11px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>
                Puedes ingresar claves como <strong>MSHP</strong> (Wokokai), <strong>ARW</strong> (Arawaki) o <strong>TR3</strong> (Tr3slog).
              </div>
            </div>

            {linkError && (
              <div style={{
                background: 'var(--mgh-danger-bg, #FEE2E2)',
                border: '1px solid #FCA5A5',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                color: 'var(--mgh-danger-700, #991B1B)',
                fontSize: 13,
              }}>
                <Icon name="error" size={20} color="var(--mgh-danger, #DC2626)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, lineHeight: '18px' }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Error al validar proyecto</div>
                  <div>{linkError}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--mgh-success-bg, #D1FAE5)',
              border: '1px solid #6EE7B7',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="check_circle" size={22} color="var(--mgh-success, #059669)" />
                <div style={{ font: '700 15px var(--font-sans)', color: 'var(--mgh-success-700, #065F46)' }}>
                  ¡Proyecto vinculado exitosamente!
                </div>
              </div>
              <div style={{ font: '500 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                <strong>{linkedResult.name}</strong> (<span style={{ fontFamily: 'var(--font-mono)' }}>{linkedResult.key}</span>)
              </div>
              <div style={{ font: '400 12px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>
                ID oficial Jira: <code>{linkedResult.jira_id || linkedResult.id}</code> • Líder: {linkedResult.lead}
              </div>
              <div style={{ font: '400 12px var(--font-sans)', color: 'var(--mgh-ink-3)', borderTop: '1px solid #A7F3D0', paddingTop: 8 }}>
                Guardado sin duplicados y añadido a la tabla de proyectos.
              </div>
            </div>

            <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>
              ¿Deseas sincronizar sus tareas de Jira ahora?
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={closeLinkModal} disabled={syncingNewTasks}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                icon="sync"
                disabled={syncingNewTasks}
                onClick={handleSyncNewlyLinked}
              >
                {syncingNewTasks ? 'Sincronizando tareas...' : 'Sincronizar tareas ahora'}
              </Button>
            </div>
          </div>
        )}
      </ModalComp>
    )}

    {/* MODAL / PANEL LATERAL: Incidencias de Jira por proyecto */}
    {ModalComp && (
      <ModalComp
        open={tasksModalOpen}
        title={`Incidencias Jira • ${selectedProject ? (selectedProject.name + ' (' + (selectedProject.key || selectedProject.id) + ')') : ''}`}
        onClose={() => setTasksModalOpen(false)}
        width={940}
        actions={
          <Button variant="secondary" onClick={() => setTasksModalOpen(false)}>
            Cerrar
          </Button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Cabecera de estado y sincronización */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--mgh-surface-1, #F8FAFC)',
            borderRadius: 10,
            border: '1px solid var(--mgh-surface-2, #E2E8F0)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge mono tone="dark">{selectedProject?.key || selectedProject?.id}</Badge>
              <div>
                <div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                  {projectTasks.length} incidencias registradas
                </div>
                <div style={{ font: '400 12px var(--font-sans)', color: 'var(--mgh-ink-3)', marginTop: 2 }}>
                  Última sincronización: <strong>{formatSyncDate(tasksLastSyncAt)}</strong>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              icon="sync"
              disabled={syncingTasks || loadingTasks}
              onClick={handleSyncCurrentProject}
            >
              {syncingTasks ? 'Sincronizando...' : 'Sincronizar ahora'}
            </Button>
          </div>

          {/* Notificación de sin conexión cuando Jira falla o no está conectado */}
          {isOfflineTasks && (
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#92400E',
              fontSize: 12,
            }}>
              <Icon name="dns" size={18} color="#D97706" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <strong>Sin conexión con Jira:</strong> Jira Cloud no respondió o no está disponible. Se muestran las tareas ya guardadas (Última sincronización: {formatSyncDate(tasksLastSyncAt)}).
              </div>
            </div>
          )}

          {tasksError && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#991B1B',
              fontSize: 12,
            }}>
              <Icon name="cloud_off" size={18} color="#DC2626" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>{tasksError}</div>
            </div>
          )}

          {/* Barra de filtros y búsqueda */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#fff',
                border: '1px solid var(--mgh-surface-3, #CBD5E1)',
                borderRadius: 'var(--radius-8, 8px)',
                padding: '0 10px',
                height: 36,
                width: '100%',
                maxWidth: 320,
              }}>
                <Icon name="search" size={18} color="var(--mgh-ink-3)" />
                <input
                  type="text"
                  placeholder="Buscar por clave o título…"
                  value={taskQuery}
                  onChange={e => setTaskQuery(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    font: '400 13px var(--font-sans)',
                    color: 'var(--mgh-ink)',
                    width: '100%',
                    background: 'transparent',
                  }}
                />
                {taskQuery && (
                  <IconButton icon="close" size={16} title="Limpiar" onClick={() => setTaskQuery('')} />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FilterChips
                value={taskStatusFilter}
                onChange={setTaskStatusFilter}
                options={[
                  { value: 'all', label: 'Todos los estados', count: projectTasks.length },
                  ...availableTaskStatuses.map(s => ({
                    value: s,
                    label: s,
                    count: projectTasks.filter(x => x.status === s).length,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Tabla de incidencias */}
          <div style={{
            maxHeight: 420,
            overflowY: 'auto',
            border: '1px solid var(--mgh-surface-2, #E2E8F0)',
            borderRadius: 8,
          }}>
            {loadingTasks ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--mgh-ink-3)', font: '500 13px var(--font-sans)' }}>
                Cargando incidencias...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Icon name="search_off" size={32} color="var(--mgh-ink-4)" />
                <div style={{ font: '600 14px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                  {projectTasks.length === 0 ? 'No hay tareas sincronizadas aún para este proyecto' : 'No hay incidencias que coincidan con la búsqueda'}
                </div>
                <div style={{ font: '400 12px var(--font-sans)', color: 'var(--mgh-ink-3)', maxWidth: 400 }}>
                  {projectTasks.length === 0 ? 'Pulsa "Sincronizar ahora" para consultar Jira Cloud y guardar las incidencias.' : 'Intenta ajustar los filtros o el término de búsqueda.'}
                </div>
                {projectTasks.length === 0 && (
                  <Button size="sm" icon="sync" onClick={handleSyncCurrentProject} disabled={syncingTasks}>
                    Sincronizar ahora
                  </Button>
                )}
              </div>
            ) : (
              <DataTable
                density="compact"
                rows={filteredTasks.map((t, idx) => ({ id: t.key || idx, ...t }))}
                columns={[
                  {
                    key: 'key',
                    label: 'Clave',
                    sortable: true,
                    render: r => (
                      r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: 'none' }}
                          title="Abrir en Jira Cloud"
                        >
                          <Badge mono size="sm" tone="primary">{r.key}</Badge>
                        </a>
                      ) : (
                        <Badge mono size="sm" tone="primary">{r.key}</Badge>
                      )
                    )
                  },
                  {
                    key: 'summary',
                    label: 'Título',
                    render: r => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {r.type && <Badge size="xs" uppercase tone="neutral">{r.type}</Badge>}
                        <span style={{ fontWeight: 600, color: 'var(--mgh-ink)', fontSize: 13 }}>{r.summary}</span>
                      </div>
                    )
                  },
                  {
                    key: 'status',
                    label: 'Estado',
                    render: r => (
                      <Badge size="xs" tone={getStatusTone(r.status)}>
                        {r.status || '—'}
                      </Badge>
                    )
                  },
                  {
                    key: 'assignee',
                    label: 'Responsable',
                    render: r => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <Icon name="person" size={16} color="var(--mgh-ink-3)" />
                        <span>{r.assignee || 'Sin asignar'}</span>
                      </div>
                    )
                  },
                  {
                    key: 'updated',
                    label: 'Última actualización',
                    align: 'right',
                    render: r => (
                      <span style={{ font: '400 12px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>
                        {formatTaskUpdated(r.updated)}
                      </span>
                    )
                  }
                ]}
              />
            )}
          </div>
        </div>
      </ModalComp>
    )}

    {/* POPUP / MODAL: Crear Cuenta de Trabajador */}
    {ModalComp && (
      <ModalComp
        open={createWorkerOpen}
        title="Crear Cuenta de Trabajador y Asignar a Proyecto"
        onClose={() => { setCreateWorkerOpen(false); setCreatedSummary(null); }}
        width={600}
        actions={
          createdSummary ? (
            <Button variant="primary" onClick={() => { setCreateWorkerOpen(false); setCreatedSummary(null); }}>
              Listo, Cerrar
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setCreateWorkerOpen(false)} disabled={creatingWorker}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                icon="person_add"
                disabled={creatingWorker || !workerForm.first.trim() || !workerForm.email.trim()}
                onClick={handleCreateWorker}
              >
                {creatingWorker ? 'Creando cuenta...' : 'Crear Cuenta y Asignar'}
              </Button>
            </>
          )
        }
      >
        {createdSummary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--mgh-success-bg, #ECFDF5)',
              border: '1px solid #A7F3D0',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <Icon name="check_circle" size={28} color="#059669" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#065F46' }}>
                  Colaborador registrado
                </div>
                <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                  {createdSummary.account && ['created', 'linked'].includes(createdSummary.account.status)
                    ? 'El colaborador quedó registrado y su usuario de acceso está habilitado.'
                    : 'El colaborador quedó registrado. Revisa abajo el estado de su acceso.'}
                </div>
              </div>
            </div>

            <Card title="Credenciales de Acceso Generadas" icon="badge">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <KeyValue label="ID de Colaborador" value={createdSummary.id} mono />
                <KeyValue label="Nombre Completo" value={createdSummary.name} />
                <KeyValue label="Correo Electrónico" value={createdSummary.email} mono />
                {createdSummary.password ? <KeyValue label="Contraseña Temporal" value={createdSummary.password} mono aside={<Badge size="sm" tone="warning">Debe cambiarla al entrar</Badge>} /> : null}
                {window.__mghAccountNotice(createdSummary.account) ? <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--mgh-warning-bg)', font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{window.__mghAccountNotice(createdSummary.account)}</div> : null}
                <KeyValue label="Cargo / Especialidad" value={createdSummary.role || '—'} />
                <KeyValue label="Proyecto Asignado" value={createdSummary.project || '—'} />
                <KeyValue label="Tarifa Acordada" value={createdSummary.rate != null && createdSummary.rate !== '' ? `$${createdSummary.rate}/h` : '—'} mono />
              </div>
            </Card>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--mgh-ink-2)', lineHeight: '18px' }}>
              Como Project Manager, puedes dar de alta nuevos desarrolladores, diseñadores o contratistas. Se creará su ficha de colaborador y su usuario en el sistema con acceso inmediato.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Nombre <span style={{ color: 'var(--mgh-danger)' }}>*</span></label>
                <input
                  type="text"
                  value={workerForm.first}
                  onChange={e => setWorkerForm(p => ({ ...p, first: e.target.value }))}
                  placeholder="ej. Carlos"
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Apellido</label>
                <input
                  type="text"
                  value={workerForm.last}
                  onChange={e => setWorkerForm(p => ({ ...p, last: e.target.value }))}
                  placeholder="ej. Peña"
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Correo Corporativo <span style={{ color: 'var(--mgh-danger)' }}>*</span></label>
                <input
                  type="email"
                  value={workerForm.email}
                  onChange={e => setWorkerForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="carlos.pena@myglobalhub.com"
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Contraseña <span style={{ color: 'var(--mgh-danger)' }}>*</span></label>
                <input
                  type="text"
                  value={workerForm.password}
                  onChange={e => setWorkerForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Vacío = se genera una segura"
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13, fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Cargo / Título</label>
                <input
                  type="text"
                  value={workerForm.role}
                  onChange={e => setWorkerForm(p => ({ ...p, role: e.target.value }))}
                  placeholder="ej. Frontend Engineer"
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Rol de Permisos en Sistema</label>
                <select
                  value={workerForm.systemRole}
                  onChange={e => setWorkerForm(p => ({ ...p, systemRole: e.target.value }))}
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13, background: '#fff' }}
                >
                  <option value="employee">Empleado Estándar (Registrar horas, ver proyectos)</option>
                  <option value="contractor">Contratista</option>
                  <option value="supervisor">Supervisor (Supervisión de equipo)</option>
                  {['hr', 'admin'].includes((MGH_RBAC.user || {}).role) && <option value="pm">Project Manager (Gestión de proyectos y equipo)</option>}
                  {(MGH_RBAC.user || {}).role === 'admin' && <><option value="hr">Recursos Humanos</option><option value="finance">Finanzas</option><option value="admin">Administrador (acceso total)</option></>}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Tipo de Contratación</label>
                <select
                  value={workerForm.type}
                  onChange={e => setWorkerForm(p => ({ ...p, type: e.target.value }))}
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13, background: '#fff' }}
                >
                  <option value="Full-time">Full-time (Tiempo Completo)</option>
                  <option value="Contractor">Contractor (Contratista Independiente)</option>
                  <option value="Part-time">Part-time (Medio Tiempo)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Tarifa Horaria (USD/h)</label>
                <input
                  type="number"
                  step="5"
                  value={workerForm.rate}
                  onChange={e => setWorkerForm(p => ({ ...p, rate: e.target.value }))}
                  placeholder="50.00"
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Asignar a Proyecto Inicial <span style={{ color: 'var(--mgh-danger)' }}>*</span></label>
                <select
                  value={workerForm.project}
                  onChange={e => setWorkerForm(p => ({ ...p, project: e.target.value }))}
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13, background: '#fff' }}
                >
                  <option value="">Selecciona…</option>
                  {allProjectNames.map(pn => (
                    <option key={pn} value={pn}>{pn}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>Supervisor / PM Responsable</label>
                <input
                  type="text"
                  value={workerForm.mgr}
                  onChange={e => setWorkerForm(p => ({ ...p, mgr: e.target.value }))}
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
                />
              </div>
            </div>
          </div>
        )}
      </ModalComp>
    )}

    {/* POPUP / MODAL: Crear Nuevo Proyecto */}
    {ModalComp && (
      <ModalComp
        open={createProjectOpen}
        title="Crear Nuevo Proyecto"
        onClose={() => setCreateProjectOpen(false)}
        width={540}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreateProjectOpen(false)} disabled={creatingProject}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon="add_circle"
              disabled={creatingProject || !projectForm.name.trim()}
              onClick={handleCreateProject}
            >
              {creatingProject ? 'Guardando...' : 'Crear Proyecto'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--mgh-ink-2)', lineHeight: '18px' }}>
            Registra un nuevo proyecto en la base de datos de la empresa para habilitar imputación de horas, seguimiento presupuestario y asignación de colaboradores.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
              Nombre del Proyecto <span style={{ color: 'var(--mgh-danger)' }}>*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={projectForm.name}
              onChange={e => setProjectForm(p => ({ ...p, name: e.target.value }))}
              placeholder="ej. Portal de Pagos Web, Mobile Banking v2..."
              style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Clave / Código (ej. PPW, MOB)
              </label>
              <input
                type="text"
                value={projectForm.key}
                onChange={e => setProjectForm(p => ({ ...p, key: e.target.value.toUpperCase() }))}
                placeholder="Autogenerado si está vacío"
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13, fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Líder / PM Responsable
              </label>
              <input
                type="text"
                value={projectForm.lead}
                onChange={e => setProjectForm(p => ({ ...p, lead: e.target.value }))}
                placeholder="Nombre del responsable"
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Presupuesto ($ USD)
              </label>
              <input
                type="number"
                step="5000"
                value={projectForm.budget}
                onChange={e => setProjectForm(p => ({ ...p, budget: e.target.value }))}
                placeholder="Opcional"
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Facturable (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={projectForm.bill}
                onChange={e => setProjectForm(p => ({ ...p, bill: e.target.value }))}
                placeholder="Opcional"
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Estado Inicial
              </label>
              <select
                value={projectForm.st}
                onChange={e => setProjectForm(p => ({ ...p, st: e.target.value }))}
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', background: '#fff', fontSize: 13 }}
              >
                <option value="On track">On track (En orden)</option>
                <option value="At risk">At risk (En riesgo)</option>
                <option value="Over budget">Over budget (Excedido)</option>
              </select>
            </div>
          </div>
        </div>
      </ModalComp>
    )}

    {/* POPUP / MODAL: Editar Proyecto */}
    {ModalComp && (
      <ModalComp
        open={editProjectOpen}
        title={`Editar Proyecto — ${editProjectForm.key}`}
        onClose={() => { setEditProjectOpen(false); setProjectToEdit(null); }}
        width={540}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditProjectOpen(false)} disabled={editingProject}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon="check_circle"
              disabled={editingProject || !editProjectForm.name.trim()}
              onClick={handleSaveEditProject}
            >
              {editingProject ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
              Nombre del Proyecto <span style={{ color: 'var(--mgh-danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={editProjectForm.name}
              onChange={e => setEditProjectForm(p => ({ ...p, name: e.target.value }))}
              style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Clave (Identificador)
              </label>
              <input
                type="text"
                disabled
                value={editProjectForm.key}
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-2, #E2E8F0)', background: '#F8FAFC', fontSize: 13, fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Líder / PM Responsable
              </label>
              <input
                type="text"
                value={editProjectForm.lead}
                onChange={e => setEditProjectForm(p => ({ ...p, lead: e.target.value }))}
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Presupuesto ($ USD)
              </label>
              <input
                type="number"
                step="5000"
                value={editProjectForm.budget}
                onChange={e => setEditProjectForm(p => ({ ...p, budget: e.target.value }))}
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Facturable (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={editProjectForm.bill}
                onChange={e => setEditProjectForm(p => ({ ...p, bill: e.target.value }))}
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                Estado
              </label>
              <select
                value={editProjectForm.st}
                onChange={e => setEditProjectForm(p => ({ ...p, st: e.target.value }))}
                style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-3, #CBD5E1)', background: '#fff', fontSize: 13 }}
              >
                <option value="On track">On track (En orden)</option>
                <option value="At risk">At risk (En riesgo)</option>
                <option value="Over budget">Over budget (Excedido)</option>
              </select>
            </div>
          </div>
        </div>
      </ModalComp>
    )}

    {/* POPUP / MODAL: Asignar UNO O MÁS Proyectos a un Trabajador */}
    {ModalComp && (
      <ModalComp
        open={reassignOpen}
        title={`Asignar Proyectos — ${selectedWorker?.name || ''}`}
        onClose={() => { setReassignOpen(false); setSelectedWorker(null); }}
        width={620}
        actions={
          <>
            <Button variant="secondary" onClick={() => setReassignOpen(false)} disabled={reassigning}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon="check_circle"
              disabled={reassigning}
              onClick={handleConfirmReassign}
            >
              {reassigning ? 'Guardando...' : `Confirmar Asignaciones (${selectedProjects.length})`}
            </Button>
          </>
        }
      >
        {selectedWorker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              padding: 12,
              background: 'var(--mgh-surface-1, #F8FAFC)',
              borderRadius: 8,
              border: '1px solid var(--mgh-surface-2, #E2E8F0)',
              display: 'flex',
              gap: 12,
              alignItems: 'center'
            }}>
              <Avatar name={selectedWorker.name} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--mgh-ink)' }}>{selectedWorker.name}</div>
                <div style={{ fontSize: 12, color: 'var(--mgh-ink-3)', marginTop: 2 }}>
                  {selectedWorker.role || selectedWorker.title} • {selectedWorker.id} • {selectedWorker.email}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mgh-ink)', marginBottom: 4 }}>
                Selecciona los proyectos en los que trabaja este colaborador ({selectedProjects.length} seleccionados):
              </div>
              <div style={{ fontSize: 12, color: 'var(--mgh-ink-2)', marginBottom: 10 }}>
                Puedes marcar uno o más proyectos simultáneamente con las casillas de verificación. El colaborador podrá imputar actividades a cualquiera de los proyectos asignados.
              </div>

              {/* Badges de proyectos seleccionados actualmente */}
              {selectedProjects.length > 0 ? (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 12,
                  padding: 8,
                  background: '#EEF2FF',
                  borderRadius: 6,
                  border: '1px solid #C7D2FE'
                }}>
                  {selectedProjects.map(p => (
                    <span
                      key={p}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#fff',
                        border: '1px solid #818CF8',
                        color: '#3730A3',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600
                      }}
                    >
                      {p}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleProject(p); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#DC2626',
                          fontWeight: 700,
                          padding: 0,
                          lineHeight: 1,
                          fontSize: 14
                        }}
                        title="Remover proyecto"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '8px 12px',
                  background: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#92400E',
                  marginBottom: 12
                }}>
                  Ningún proyecto seleccionado actualmente. Marca al menos un proyecto abajo.
                </div>
              )}

              {/* Filtro rápido de proyectos */}
              <input
                type="text"
                value={projectSearchModal}
                onChange={e => setProjectSearchModal(e.target.value)}
                placeholder="Filtrar proyectos en la lista..."
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: '1px solid var(--mgh-surface-3, #CBD5E1)',
                  fontSize: 13,
                  marginBottom: 10,
                  boxSizing: 'border-box'
                }}
              />

              {/* Lista interactiva de proyectos con casillas de verificación */}
              <div style={{
                maxHeight: 260,
                overflowY: 'auto',
                border: '1px solid var(--mgh-surface-2, #E2E8F0)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column'
              }}>
                {allProjectNames
                  .filter(p => !projectSearchModal || p.toLowerCase().includes(projectSearchModal.toLowerCase()))
                  .map(p => {
                    const isSelected = selectedProjects.includes(p);
                    return (
                      <div
                        key={p}
                        onClick={() => handleToggleProject(p)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--mgh-surface-2, #E2E8F0)',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--mgh-primary-bg, #EEF2FF)' : '#fff',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // controlado por onClick del contenedor
                          style={{ cursor: 'pointer', width: 18, height: 18 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ font: '600 13px var(--font-sans)', color: isSelected ? 'var(--mgh-primary-dark, #3730A3)' : 'var(--mgh-ink)' }}>
                            {p}
                          </div>
                        </div>
                        {isSelected && (
                          <Badge size="xs" tone="primary">Asignado</Badge>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </ModalComp>
    )}
  </Page>;
}

// Arawaki, Wokokai and Tr3slog are projects of the one company, not clients: reports have no client dimension.
// (kept as an empty global only because older screens may still read it)
window.__MGH_CLIENT_OF = {};
const COMPANY = 'My Global Hub (Dominicana SRL)';
const localToday = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const REPORTS = [
  { id: 'hours', label: 'Employee Hours', icon: 'schedule' }, { id: 'weekly', label: 'Weekly Hours', icon: 'date_range' }, { id: 'payroll', label: 'Biweekly Payroll', icon: 'payments' },
  { id: 'ot', label: 'Overtime', icon: 'more_time' }, { id: 'attendance', label: 'Attendance', icon: 'how_to_reg' }, { id: 'summary', label: 'Payroll Summary', icon: 'summarize' },
  { id: 'labor', label: 'Labor Cost', icon: 'account_tree' }, { id: 'pto', label: 'PTO', icon: 'beach_access' },
  { id: 'org', label: 'Organization Summary', icon: 'hub' }];
const n1 = v => { const x = Number(v); return Number.isFinite(x) ? (Math.round(x * 10) / 10).toFixed(1) : '—'; }, m2 = v => fmt$(Number(v) || 0);
function weekSplit(e, per) {
  const d = buildDays(e, per); const w = [1, 2].map(k => d.filter(x => x.week === k).map(x => x.hrs || 0));
  const ot = w.map(h => WF ? WF.splitOT(h).reduce((s, x) => s + x, 0) : 0);
  return { w1: w[0].reduce((s, x) => s + x, 0), w2: w[1].reduce((s, x) => s + x, 0), ot: ot[0] + ot[1], days: d.filter(x => !x.weekend && (x.hrs || 0) > 0).length };
}
function buildReport(id, E, per) {
  const grp = (key, f) => Object.values(E.reduce((m, e) => { const k = f(e); (m[k] = m[k] || { k, list: [] }).list.push(e); return m; }, {}));
  const sum = (l, f) => l.reduce((s, e) => s + (Number(f(e)) || 0), 0);
  const ded = e => DEDUCT(e).total || 0;
  if (id === 'hours') return { cols: [['ID', 'mono'], ['Employee'], ['Department'], ['Project'], ['Regular', 'num'], ['Overtime', 'num'], ['PTO', 'num'], ['Total', 'num'], ['Status']], rows: E.map(e => [e.id, e.name, e.dept || '—', e.project || '—', n1(e.reg), n1(e.ot), n1(e.pto), n1(e.total), liveStatus(e)]), total: ['', 'Total', '', '', n1(sum(E, e => e.reg)), n1(sum(E, e => e.ot)), n1(sum(E, e => e.pto)), n1(sum(E, e => e.total)), ''] };
  if (id === 'weekly') { const W = E.map(e => ({ e, ...weekSplit(e, per) })); return { cols: [['ID', 'mono'], ['Employee'], ['Week 1', 'num'], ['Week 2', 'num'], ['Period total', 'num'], ['Overtime (rule)', 'num']], rows: W.map(x => [x.e.id, x.e.name, n1(x.w1), n1(x.w2), n1(x.w1 + x.w2), n1(x.ot)]), total: ['', 'Total', n1(sum(W, x => x.w1)), n1(sum(W, x => x.w2)), n1(sum(W, x => x.w1 + x.w2)), n1(sum(W, x => x.ot))], note: 'Overtime recalculated with the organization rule: ' + (WF ? WF.otLabel() : 'Weekly > 44h') };
  }
  if (id === 'payroll') return { cols: [['ID', 'mono'], ['Employee'], ['Regular', 'num'], ['Overtime', 'num'], ['Rate', 'num'], ['Gross', 'num'], ['Deductions', 'num'], ['Net', 'num'], ['Status']], rows: E.map(e => [e.id, e.name, n1(e.reg), n1(e.ot), m2(e.rate), m2(e.gross), m2(ded(e)), m2(e.gross - ded(e)), liveStatus(e)]), total: ['', 'Total', n1(sum(E, e => e.reg)), n1(sum(E, e => e.ot)), '', m2(sum(E, e => e.gross)), m2(sum(E, ded)), m2(sum(E, e => e.gross - ded(e))), ''] };
  if (id === 'ot') { const O = E.filter(e => e.ot > 0); const all = sum(E, e => e.total) || 1; return { cols: [['ID', 'mono'], ['Employee'], ['Department'], ['OT hours', 'num'], ['OT cost (1.5×)', 'num'], ['% of hours', 'num']], rows: O.map(e => [e.id, e.name, e.dept, n1(e.ot), m2(e.ot * e.rate * 1.5), n1(e.ot / (e.total || 1) * 100) + '%']), total: ['', 'Total', '', n1(sum(O, e => e.ot)), m2(sum(O, e => e.ot * e.rate * 1.5)), n1(sum(O, e => e.ot) / all * 100) + '%'] }; }
  if (id === 'attendance') { const today = (window.MGH_ATT && window.MGH_ATT.TODAY) || localToday(); const A2 = E.map(e => { const d = buildDays(e, per).filter(x => !x.weekend && x.dateStr <= today); const worked = d.filter(x => x.hrs > 0).length, pto = e.pto / 8, sched = Math.max(0, d.length - pto); return [e.id, e.name, e.dept, String(worked), String(Math.max(0, Math.round(sched - worked))), n1(pto), sched ? n1(Math.min(100, worked / sched * 100)) + '%' : '—']; }); return { cols: [['ID', 'mono'], ['Employee'], ['Department'], ['Days with punches', 'num'], ['Days without record', 'num'], ['PTO days', 'num'], ['Attendance', 'num']], rows: A2, total: null }; }
  if (id === 'summary') { const G = grp('dept', e => e.dept || '—'); return { cols: [['Department'], ['Employees', 'num'], ['Hours', 'num'], ['Gross', 'num'], ['Deductions', 'num'], ['Net', 'num']], rows: G.map(g => [g.k, String(g.list.length), n1(sum(g.list, e => e.total)), m2(sum(g.list, e => e.gross)), m2(sum(g.list, ded)), m2(sum(g.list, e => e.gross - ded(e)))]), total: ['Total', String(E.length), n1(sum(E, e => e.total)), m2(sum(E, e => e.gross)), m2(sum(E, ded)), m2(sum(E, e => e.gross - ded(e)))] }; }
  if (id === 'labor') { const G = grp('project', e => e.project || '—'); return { cols: [['Project'], ['People', 'num'], ['Hours', 'num'], ['Labor cost', 'num'], ['Jira match', 'num']], rows: G.map(g => [g.k, String(g.list.length), n1(sum(g.list, e => e.total)), m2(sum(g.list, e => e.gross)), (g.list.some(hasMatch) ? n1(sum(g.list.filter(hasMatch), e => e.match) / g.list.filter(hasMatch).length) + '%' : '—')]), total: ['Total', String(E.length), n1(sum(E, e => e.total)), m2(sum(E, e => e.gross)), ''] }; }
  if (id === 'pto') { const yr = String(new Date().getFullYear()), holN = e => window.MGH_ATT ? window.MGH_ATT.holidays(e.entity).filter(h => String(h.date).startsWith(yr)).length : 0; return { cols: [['ID', 'mono'], ['Employee'], ['Department'], ['PTO used (h)', 'num'], ['Holidays (' + yr + ')', 'num']], rows: E.map(e => [e.id, e.name, e.dept, n1(e.pto), String(holN(e))]), total: ['', 'Total', '', n1(sum(E, e => e.pto)), ''] }; }
  if (id === 'org') { const G = E.length ? [{ k: COMPANY, list: E }] : []; return { cols: [['Organization'], ['Employees', 'num'], ['Hours', 'num'], ['Overtime', 'num'], ['Labor cost', 'num'], ['Pending timesheets', 'num']], rows: G.map(g => [g.k, String(g.list.length), n1(sum(g.list, e => e.total)), n1(sum(g.list, e => e.ot)), m2(sum(g.list, e => e.gross)), String(g.list.filter(e => /Review|Submitted/.test(liveStatus(e))).length)]), total: ['Total', String(E.length), n1(sum(E, e => e.total)), n1(sum(E, e => e.ot)), m2(sum(E, e => e.gross)), String(E.filter(e => /Review|Submitted/.test(liveStatus(e))).length)] }; }
  return { cols: [], rows: [] };
}
function exportReport(kind, title, sub, rep) {
  const tx = s => window.MGH_I18N ? window.MGH_I18N.tx(s) : s;
  const head = rep.cols.map(c => tx(c[0])), rows = rep.total ? [...rep.rows, rep.total] : rep.rows;
  const name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + ((sub || '').match(/PP-\d{4}-\d{2}/) || [new Date().toISOString().slice(0, 10)])[0].toLowerCase();
  const dl = (blob, ext) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.' + ext; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  if (kind === 'csv') { const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; dl(new Blob(['\ufeff' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'csv'); return 'CSV downloaded'; }
  if (kind === 'xls') { const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr><th colspan="' + head.length + '">' + esc(tx(title)) + ' • ' + esc(sub) + '</th></tr><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</table></body></html>'; dl(new Blob([html], { type: 'application/vnd.ms-excel' }), 'xls'); return 'Excel downloaded'; }
  const w = window.open('', '_blank'); if (!w) return 'Allow pop-ups to print or save as PDF';
  w.document.write('<html><head><meta charset="utf-8"><title>' + esc(tx(title)) + '</title><style>body{font:12px/16px "Plus Jakarta Sans",Arial,sans-serif;color:#131B2E;margin:28px}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 14px;color:#43474D}table{width:100%;border-collapse:collapse}th{background:#F2F3FF;text-align:left;font-size:10px;letter-spacing:.5px;text-transform:uppercase;padding:6px 8px}td{padding:6px 8px;border-bottom:1px solid #EAEDFF}tr:last-child td{font-weight:700}.n{text-align:right}</style></head><body><h1>My Global Hub • ' + esc(tx(title)) + '</h1><p>' + esc(sub) + '</p><table><tr>' + rep.cols.map((c, i) => '<th class="' + (c[1] === 'num' ? 'n' : '') + '">' + esc(head[i]) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map((v, i) => '<td class="' + (rep.cols[i] && rep.cols[i][1] === 'num' ? 'n' : '') + '">' + esc(v) + '</td>').join('') + '</tr>').join('') + '</table>' + (rep.note ? '<p style="margin-top:12px">' + esc(tx(rep.note)) + '</p>' : '') + '</body></html>');
  w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 300); return kind === 'pdf' ? 'Choose "Save as PDF" in the print dialog' : 'Print dialog opened';
}
window.__mghExport = exportReport;
function Reports({ notify }) {
  useWF();
  const [rep, setRep] = React.useState('hours');
  const ALL = 'All';
  const curP = getCurrentPeriod();
  const PERIODS = React.useMemo(() => [curP.code, ...window.__mghPrevPeriods(curP, 5).map(p => p.code)], [curP.code]);
  const [f, setF] = React.useState({ dept: ALL, project: ALL, sup: ALL, emp: ALL, period: curP.code, status: ALL });
  const set = k => v => setF(x => ({ ...x, [k]: typeof v === 'string' ? v : v.target.value }));
  const opts = (l) => [ALL, ...[...new Set(l.filter(Boolean))].sort()];
  // Past periods: hours come from that period's stored timesheets (current period is already on EMPLOYEES)
  const [past, setPast] = React.useState(null);
  React.useEffect(() => {
    if (f.period === curP.code) { setPast(null); return; }
    let cancel = false; setPast({});
    window.api.timesheets({ periodId: f.period }).then(list => { if (cancel) return; const m = {}; (Array.isArray(list) ? list : []).forEach(t => { m[t.emp] = t; }); setPast(m); }).catch(() => { if (!cancel) setPast({}); });
    return () => { cancel = true; };
  }, [f.period]);
  const withPeriod = e => { if (!past) return e; const t = past[e.id] || {}; const reg = Number(t.reg) || 0, ot = Number(t.ot) || 0, pto = Number(t.pto) || 0, rate = Number(e.rate) || 0; return { ...e, reg, ot, pto, total: reg + ot + pto, gross: +(reg * rate + ot * rate * 1.5 + pto * rate).toFixed(2) }; };
  const E0 = EMPLOYEES.filter(e => MGH_RBAC.can('reports.view', e)).map(withPeriod);
  const E = E0.filter(e => (f.dept === ALL || e.dept === f.dept) && (f.project === ALL || e.project === f.project) && (f.sup === ALL || e.mgr === f.sup) && (f.emp === ALL || e.id + ' • ' + e.name === f.emp) && (f.status === ALL || liveStatus(e) === f.status));
  const perObj = f.period === curP.code ? curP : (window.__mghPrevPeriods(curP, 5).find(p => p.code === f.period) || curP);
  const R = buildReport(rep, E, perObj), meta = REPORTS.find(r => r.id === rep);
  const active = Object.entries(f).filter(([k, v]) => v !== ALL && k !== 'period').length;
  const sub = f.period + ' • ' + COMPANY + (active ? ' • ' + active + ' filter(s)' : '') + ' • USD';
  const hist = WF ? WF.all().flatMap(r => { const s = r.history.find(h => h.to === 'Submitted'), a2 = r.history.find(h => h.to === 'Approved'); return s && a2 ? [(new Date(a2.at) - new Date(s.at)) / 864e5] : []; }) : [];
  const avg = hist.length ? hist.reduce((s, x) => s + x, 0) / hist.length : null;
  const pendingTs = E.filter(e => /Review|Submitted/.test(liveStatus(e))).length, approvedNotPaid = E.filter(e => liveStatus(e) === 'Approved');
  const ex = kind => notify(exportReport(kind, meta.label, sub, R));
  const fsel = (k, label, list, icon) => <Select size="sm" icon={icon} value={f[k]} onChange={set(k)} options={opts(list).map(v => ({ value: v, label: v === ALL ? 'All ' + label : v }))} />;
  const num = x => Number(x) || 0;
  return <Page>
    <PageHeader breadcrumbs={['Payroll & Finance', 'Reports & Register']} title="Reports & Export Center" description="Operational reports with live filters. Every report exports to PDF, Excel, CSV or print in the selected language." status={<Badge tone="primary">{sub}</Badge>} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,170px),1fr))', gap: 14 }}>
      <StatCard label="Hours worked" value={n1(E.reduce((s, e) => s + num(e.total), 0))} unit="h" icon="schedule" style={{ minHeight: 0 }} />
      <StatCard label="Overtime" value={n1(E.reduce((s, e) => s + num(e.ot), 0))} unit="h" icon="more_time" tone="warning" style={{ minHeight: 0 }} />
      <StatCard label="Labor cost" value={'$' + (E.reduce((s, e) => s + num(e.gross), 0) / 1000).toFixed(1) + 'k'} icon="payments" tone="primary" style={{ minHeight: 0 }} />
      <StatCard label="Active employees" value={String(E.length)} icon="group" tone="success" style={{ minHeight: 0 }} />
      <StatCard label="Pending timesheets" value={String(pendingTs)} icon="hourglass_top" tone="warning" style={{ minHeight: 0 }} />
      <StatCard label="Payroll pending" value={String(approvedNotPaid.length)} unit={fmt$(approvedNotPaid.reduce((s, e) => s + num(e.gross), 0))} icon="account_balance_wallet" tone="accent" style={{ minHeight: 0 }} />
      <StatCard label="Avg approval time" value={avg == null ? '—' : n1(avg)} unit={avg == null ? 'no completed approvals yet' : 'days'} icon="timer" style={{ minHeight: 0 }} />
    </div>
    <Card padding={20}>
      <FilterChips value={rep} onChange={setRep} options={REPORTS.map(r => ({ value: r.id, label: r.label }))} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {fsel('dept', 'departments', E0.map(e => e.dept), 'apartment')}{fsel('project', 'projects', E0.map(e => e.project), 'folder_open')}
        {fsel('sup', 'supervisors', E0.map(e => e.mgr), 'supervisor_account')}{fsel('emp', 'employees', E0.map(e => e.id + ' • ' + e.name), 'person')}
        <Select size="sm" icon="calendar_month" value={f.period} onChange={set('period')} options={PERIODS} />
        {fsel('status', 'statuses', E0.map(liveStatus), 'flag')}
        {active > 0 && <Button size="sm" variant="ghost" icon="filter_alt_off" onClick={() => setF(x => ({ ...x, dept: ALL, project: ALL, sup: ALL, emp: ALL, status: ALL }))}>Clear filters</Button>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '18px 0 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={meta.icon} size={18} color="var(--mgh-primary)" /><span className="mgh-h3">{meta.label}</span><Badge size="sm" tone="neutral">{R.rows.length} rows</Badge></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size="sm" variant="secondary" icon="picture_as_pdf" style={MGH_RBAC.can('reports.export') ? undefined : { display: 'none' }} disabled={!R.rows.length} onClick={() => ex('pdf')}>PDF</Button>
          <Button size="sm" variant="secondary" icon="table_view" style={MGH_RBAC.can('reports.export') ? undefined : { display: 'none' }} disabled={!R.rows.length} onClick={() => ex('xls')}>Excel</Button>
          <Button size="sm" variant="secondary" icon="csv" style={MGH_RBAC.can('reports.export') ? undefined : { display: 'none' }} disabled={!R.rows.length} onClick={() => ex('csv')}>CSV</Button>
          <Button size="sm" variant="dark" icon="print" style={MGH_RBAC.can('reports.export') ? undefined : { display: 'none' }} disabled={!R.rows.length} onClick={() => ex('print')}>Print</Button>
        </div>
      </div>
      {R.note && <div className="mgh-body" style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--mgh-surface-1)' }}>{R.note}</div>}
      {!R.rows.length ? <div className="mgh-body" style={{ padding: 28, textAlign: 'center', color: 'var(--mgh-ink-3)' }}>{E0.length ? 'No records match these filters.' : 'No employees in your scope yet.'}</div> :
      <div className="mgh-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead><tr>{R.cols.map(c => <th key={c[0]} style={{ textAlign: c[1] === 'num' ? 'right' : 'left', padding: '10px 12px', background: 'var(--mgh-surface-1)', font: '700 11px/14px var(--font-sans)', letterSpacing: '0.55px', textTransform: 'uppercase', color: 'var(--mgh-ink-2)', whiteSpace: 'nowrap' }}>{c[0]}</th>)}</tr></thead>
          <tbody>{R.rows.map((r, i) => <tr key={i} style={{ borderBottom: '1px solid var(--mgh-surface-2)' }}>{r.map((v, j) => <td key={j} style={{ padding: '10px 12px', textAlign: R.cols[j][1] === 'num' ? 'right' : 'left', font: (R.cols[j][1] === 'mono' ? '600 12px/16px var(--font-mono)' : '500 13px/18px var(--font-sans)'), color: 'var(--mgh-ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{R.cols[j][0] === 'Status' ? <WFPill size="sm" status={v} /> : v}</td>)}</tr>)}
            {R.total && <tr style={{ background: 'var(--mgh-surface-1)' }}>{R.total.map((v, j) => <td key={j} style={{ padding: '10px 12px', textAlign: R.cols[j][1] === 'num' ? 'right' : 'left', font: '800 13px/18px var(--font-sans)', color: 'var(--mgh-ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</td>)}</tr>}
          </tbody>
        </table>
      </div>}
    </Card>
  </Page>;
}

// Users come from GET /users (one company, no per-entity cards). User accounts are created
// from Add Employee (there is no invite / MFA / suspend backend yet, so those actions are not offered).
function Administration({ notify, go }) {
  const [users, setUsers] = React.useState(null);
  React.useEffect(() => {
    let cancel = false;
    if (!window.api || !window.api.users) { setUsers([]); return; }
    window.api.users()
      .then(r => { if (!cancel) setUsers(Array.isArray(r) ? r : []); })
      .catch(err => { if (!cancel) { setUsers([]); notify('Could not load users • ' + err.message); } });
    return () => { cancel = true; };
  }, []);
  try { localStorage.removeItem('mgh-admin-users'); } catch (_) {}

  const rows = (users || []).map(u => ({ id: u.id, e: { name: u.name || '—', role: u.email, avatar: u.avatar }, r: u.role || '—', active: u.is_active, last: u.last_login_at ? new Date(u.last_login_at.replace(' ', 'T') + (u.last_login_at.endsWith('Z') ? '' : 'Z')).toLocaleString(LOC()) : 'Never' }));

  return <Page>
    <PageHeader breadcrumbs={['System', 'Administration']} title="Administration" description="Users and roles of My Global Hub (Dominicana SRL)." />
    <Card icon="group" title="Users & roles" subtitle={users ? rows.length + ' user account' + (rows.length === 1 ? '' : 's') : 'Loading…'} bodyStyle={{ paddingTop: 14 }}>
      {users && !rows.length ? <div className="mgh-body" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--mgh-ink-3)' }}>No user accounts yet.</div> :
      <DataTable rows={rows} columns={[
        { key: 'e', label: 'User', render: r => <EmployeeCell e={r.e} /> }, { key: 'r', label: 'Role', render: r => <Badge size="sm" tone="primary">{r.r}</Badge> },
        { key: 'active', label: 'Status', render: r => <Badge size="sm" dot tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Inactive'}</Badge> }, { key: 'last', label: 'Last login' }]} />}
    </Card>
    <Card icon="account_tree" title="Approval workflow policy" subtitle="Configured in Approval Workflows" actions={<Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={() => go('workflows')}>Open Approval Workflows</Button>} />
  </Page>;
}

function CompanySettings({ notify }) {
  const [tab, setTab] = React.useState('general');
  const [saving, setSaving] = React.useState(false);

  const initialProfile = {
    legalName: 'My Global Hub Dominicana SRL',
    rnc: '133-474018',
    hq: 'Punta Cana, La Altagracia, DR',
    currency: 'USD',
    frequency: 'Quincenal (1–15 / 16–fin)',
    periodStart: 'Días 1 y 16 de cada mes',
    deadline: 'Last day of the quincena, 23:59',
    offset: '5',
    ot: true,
    esig: true,
    lock: true,
    notifStatus: true,
    notifPayment: true,
    secAudit: true
  };

  const [form, setForm] = React.useState(() => {
    try {
      const saved = localStorage.getItem('mgh-company-settings');
      const v = saved ? JSON.parse(saved) : initialProfile;
      // The pay schedule is fixed (quincenas); older saved values are replaced
      return { ...v, rnc: v.rnc === '1-31-88421-7' ? initialProfile.rnc : v.rnc, frequency: initialProfile.frequency, periodStart: initialProfile.periodStart };
    } catch {
      return initialProfile;
    }
  });

  const tg = k => v => setForm(x => ({ ...x, [k]: v }));
  const setField = (k, v) => setForm(x => ({ ...x, [k]: typeof v === 'string' ? v : v.target ? v.target.value : v }));

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem('mgh-company-settings', JSON.stringify(form));
      notify('Company settings saved in this browser (not yet stored on the server)');
    } catch {
      notify('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    try {
      const saved = localStorage.getItem('mgh-company-settings');
      setForm(saved ? { ...JSON.parse(saved), frequency: initialProfile.frequency, periodStart: initialProfile.periodStart } : initialProfile);
      notify('Changes discarded');
    } catch {
      notify('Changes discarded');
    }
  };

  return <Page style={{ maxWidth: 1100 }}>
    <PageHeader breadcrumbs={['System', 'Company Settings']} title="Company Settings" actions={<><Button variant="outline" onClick={handleDiscard}>Discard</Button><Button icon="save" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save Changes'}</Button></>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ value: 'general', label: 'General' }, { value: 'pay', label: 'Pay Schedule' }, { value: 'time', label: 'Time & Overtime' }, { value: 'notif', label: 'Notifications' }, { value: 'sec', label: 'Security' }]} />
    {tab === 'general' && <Card icon="apartment" title="Company profile">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
        <TextField label="Legal name" value={form.legalName} onChange={v => setField('legalName', v)} />
        <TextField label="RNC (Tax ID)" value={form.rnc} mono onChange={v => setField('rnc', v)} />
        <TextField label="Headquarters" value={form.hq} onChange={v => setField('hq', v)} />
        <TextField label="Base currency" value={form.currency} suffix="Multi-currency" onChange={v => setField('currency', v)} />
      </div>
    </Card>}
    {tab === 'pay' && <Card icon="event_repeat" title="Pay schedule">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        <Select label="Frequency" value={form.frequency} onChange={v => setField('frequency', v)} options={['Quincenal (1–15 / 16–fin)']} />
        <Select label="Period start" value={form.periodStart} onChange={v => setField('periodStart', v)} options={['Días 1 y 16 de cada mes']} />
        <TextField label="Submission deadline" value={form.deadline} onChange={v => setField('deadline', v)} />
        <TextField label="Pay date offset" value={form.offset} suffix="days" onChange={v => setField('offset', v)} />
      </div>
    </Card>}
    {tab === 'time' && <Card icon="rule" title="Time & approval rules" actions={<Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={() => window.__mghGo('workflows')}>Approval workflow & overtime rule</Button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Toggle checked={form.ot} onChange={tg('ot')} label="Require pre-authorization for overtime (No aplicado aún)" description="No aplicado aún: se guarda solo en este navegador. Overtime would need approval before it is logged." />
        <Toggle checked={form.esig} onChange={tg('esig')} label="Electronic signature on approval (No aplicado aún)" description="No aplicado aún: se guarda solo en este navegador. Approvals are recorded in the timesheet history." />
        <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>Paid periods are locked by the system: corrections go through Payroll Adjustments.</div>
      </div>
    </Card>}
    {tab === 'notif' && <Card icon="notifications" title="Notifications">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Toggle checked={form.notifStatus} onChange={tg('notifStatus')} label="Timesheet status changes (No aplicado aún)" description="No aplicado aún: se guarda solo en este navegador. No notifications are sent yet." />
        <Toggle checked={form.notifPayment} onChange={tg('notifPayment')} label="Payment completed (No aplicado aún)" description="No aplicado aún: se guarda solo en este navegador. No notifications are sent yet." />
      </div>
    </Card>}
    {tab === 'sec' && <Card icon="shield_lock" title="Security">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>State changes are recorded in the Audit Log by the server (user, time, previous and new state). Multi-factor authentication is not available yet.</div>
      </div>
    </Card>}
  </Page>;
}

// Events = backend audit_logs (GET /audit) plus this browser's workflow actions. No sample events, no fake hashes.
function AuditLog({ notify }) {
  useWF();
  const [server, setServer] = React.useState([]);
  React.useEffect(() => {
    let cancel = false;
    if (window.api && window.api.auditLogs) window.api.auditLogs().then(r => { if (!cancel && Array.isArray(r)) setServer(r); }).catch(() => {});
    return () => { cancel = true; };
  }, []);
  const toneOf = s => /FAIL|DENIED|UNAUTHORIZED/i.test(s) ? 'danger' : /DELETE|REJECT|RETURN|REVERT|warning/i.test(s) ? 'warning' : 'success';
  const fromServer = server.map(a => ({ at: a.created_at ? new Date(a.created_at.replace(' ', 'T') + (/Z$/.test(a.created_at) ? '' : 'Z')).getTime() : 0, actor: a.actor || 'System', action: a.action, target: [a.entity_type, a.entity_id].filter(Boolean).join(' • '), tone: toneOf(a.action) }));
  const fromWF = (WF ? WF.audit() : []).map(a => ({ at: new Date(a.at).getTime() || 0, actor: a.actor, action: a.action, target: a.target, tone: toneOf(a.action + ' ' + (a.tone || '')) }));
  const ev = [...fromServer, ...fromWF].sort((a, b) => b.at - a.at).map((e, i) => ({ ...e, id: i, time: e.at ? new Date(e.at).toLocaleString(LOC()) : '—' }));
  const [chip, setChip] = React.useState('all');
  const t = useTable(ev.filter(e => chip === 'all' || e.tone === chip), { search: ['actor', 'action', 'target'], pageSize: 10 });

  const exportJson = () => {
    const payload = { organization: MGH_RBAC.org, generatedAt: new Date().toISOString(), totalRecords: ev.length, records: ev.map(r => ({ timestamp: r.time, actor: r.actor, action: r.action, target: r.target })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (notify) notify('Audit log exported • ' + ev.length + ' events');
  };

  return <Page>
    <PageHeader breadcrumbs={['System', 'Audit Log']} title="Audit Log" actions={<Button variant="dark" icon="download" disabled={!ev.length} onClick={exportJson}>Export JSON</Button>} />
    <Card padding={20}>
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search actor, event, target…"
        chips={<FilterChips value={chip} onChange={setChip} options={[{ value: 'all', label: 'All events', count: ev.length }, { value: 'success', label: 'Actions', count: ev.filter(e => e.tone === 'success').length }, { value: 'warning', label: 'Changes', count: ev.filter(e => e.tone === 'warning').length }, { value: 'danger', label: 'Security', count: ev.filter(e => e.tone === 'danger').length, tone: 'danger' }]} />} />
      {ev.length ? <>
        <DataTable style={{ marginTop: 14 }} maxHeight={560} density="compact" rows={t.rows} columns={[
          { key: 'time', label: 'Timestamp', mono: true }, { key: 'actor', label: 'Actor', strong: true, weight: 600 },
          { key: 'action', label: 'Event', render: r => <Badge mono size="sm" tone={r.tone}>{r.action}</Badge> }, { key: 'target', label: 'Target' }]} />
        <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="events" />
      </> : <div className="mgh-body" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--mgh-ink-3)' }}>No audit events recorded yet.</div>}
    </Card>
  </Page>;
}

window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { jira: JiraIntegration, projects: Projects, reports: Reports, admin: Administration, settings: CompanySettings, audit: AuditLog });

})();

// ---- ScreensContractors.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, DataTable, TableToolbar, Pagination, Tabs, PageHeader, Select, KeyValue, Stepper, TextField } = window.MyGlobalHubDesignSystem_2a603d;
const Modal = window.Modal;

// Real contractors and payments are loaded from the backend; no sample records.
const CONTRACTORS = [];
const isWU = c => c.method === 'Western Union';
const INIT_PAYMENTS = [];
const fmtUSD = n => (n == null || isNaN(Number(n))) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Select options with an explicit empty choice: nothing is preselected for the user
const selOpts = (list, cur) => [{ value: '', label: 'Seleccione…' }, ...[...list, ...(cur && !list.includes(cur) ? [cur] : [])].map(v => ({ value: v, label: v }))];
const COUNTRIES = ['Dominican Republic', 'Venezuela', 'Colombia', 'Argentina', 'Peru', 'Mexico', 'Honduras', 'United States'];

function Section({ icon, title, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name={icon} size={16} color="var(--mgh-primary)" /><span className="mgh-overline">{title}</span></div>
    <div style={{ display: 'grid', gap: 8, padding: 14, borderRadius: 8, background: 'var(--mgh-surface-1)' }}>{children}</div>
  </div>;
}
function PersonCell({ c, sub }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={c.name} size={32} />
    <div style={{ minWidth: 0 }}><div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{c.name}</div><div style={{ font: '400 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{sub}</div></div></div>;
}

// Start from what the backend bootstrap loaded (window.__MGH_CTR); the old browser cache is dropped
try { localStorage.removeItem('mgh_contractors_v1'); } catch (_) {}
const loadContractors = () => (window.__MGH_CTR && window.__MGH_CTR.CONTRACTORS) || CONTRACTORS;

function Contractors({ go, notify }) {
  const [list, setList] = React.useState(loadContractors);
  const [tab, setTab] = React.useState('contractors');
  const [chip, setChip] = React.useState('all');
  const [loading, setLoading] = React.useState(false);
  const [dbConnected, setDbConnected] = React.useState(false);

  const fetchContractors = React.useCallback(async (showToast = false) => {
    try {
      setLoading(true);
      const client = window.api || api;
      const data = await client.contractors();
      if (Array.isArray(data)) {
        setList(data);
        setDbConnected(true);
        if (window.__MGH_CTR) window.__MGH_CTR.CONTRACTORS = data;
        if (showToast) notify('Contractors synchronized with database (' + data.length + ' records)');
      }
    } catch (err) {
      console.warn('[contractors API error, fallback to cache]', err);
      setDbConnected(false);
      if (showToast) notify('Failed to fetch from DB: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  React.useEffect(() => {
    fetchContractors(false);
  }, [fetchContractors]);

  const VC = list.filter(c => MGH_RBAC.can('contractors.view', c));
  const [cur, setCur] = React.useState((VC[0] || {}).id);
  const base = VC.filter(c => chip === 'all' || c.st === chip);
  const t = useTable(base, { search: ['name', 'id', 'country', 'role'], pageSize: 10 });
  const c = VC.find(x => x.id === cur) || VC[0] || {};
  const rateTxt = x => x.basis === 'Fixed Monthly' ? fmtUSD(x.rate) + ' / mo' : fmtUSD(x.rate) + ' / hr';
  const active = VC.filter(x => x.st === 'Active');

  const [addOpen, setAddOpen] = React.useState(false);
  const [newPass, setNewPass] = React.useState(null);
  const [editOpen, setEditOpen] = React.useState(false);

  const initialAdd = {
    name: '',
    role: '',
    country: '',
    email: '',
    phone: '',
    basis: 'Hourly',
    rate: '',
    method: '',
    network: '',
    asset: '',
    wallet: '',
    delivery: '',
    receiver: '',
    city: '',
    payCur: '',
    password: ''
  };
  const [addForm, setAddForm] = React.useState(initialAdd);
  const [editForm, setEditForm] = React.useState({});

  const handleOpenAdd = () => {
    setAddForm(initialAdd);
    setAddOpen(true);
  };

  const handleOpenEdit = () => {
    if (!c || !c.id) return;
    setEditForm({
      ...c,
      rate: c.rate,
      basis: c.basis,
      method: c.method,
      wallet: c.walletFull || c.wallet || '',
      role: c.role || '',
      email: c.email || '',
      phone: c.phone || '',
      country: c.country || '',
      st: c.st || 'Active',
      method: c.method || '',
      delivery: c.delivery || '',
      receiver: c.receiver || '',
      city: c.city || '',
      payCur: c.payCur || '',
      network: c.network || '',
      asset: c.asset || ''
    });
    setEditOpen(true);
  };

  const handleSaveAdd = async () => {
    if (!addForm.name.trim() || !addForm.role.trim() || !addForm.email.trim()) {
      notify('Please enter contractor name, role and email');
      return;
    }
    if (!(Number(addForm.rate) > 0)) {
      notify('Please enter a rate greater than 0');
      return;
    }
    if (!addForm.country || !addForm.method) {
      notify('Seleccione el país y el método de pago');
      return;
    }
    if (addForm.method === 'Coinbase' && (!addForm.asset || !addForm.network)) {
      notify('Seleccione el activo y la red de Coinbase');
      return;
    }
    try {
      const client = window.api || api;
      const payload = {
        name: addForm.name.trim(),
        role: addForm.role.trim(),
        country: addForm.country,
        email: addForm.email.trim(),
        phone: addForm.phone.trim(),
        basis: addForm.basis,
        rate: Number(addForm.rate),
        cur: 'USD',
        method: addForm.method,
        network: addForm.network,
        asset: addForm.asset,
        wallet: addForm.wallet,
        walletFull: addForm.wallet,
        delivery: addForm.delivery,
        receiver: addForm.receiver || addForm.name,
        city: addForm.city || '',
        payCur: addForm.payCur || '',
        password: addForm.password || undefined,
        st: 'Active',
        entity: 'MGH Dominicana SRL'
      };

      // No local fallback: if the API fails, the catch below reports it instead of faking a saved record
      const { initialPassword, ...nextItem } = await client.createContractor(payload);
      // A generated login password is shown once and never kept in the list/cache
      if (initialPassword) setNewPass({ email: nextItem.email || payload.email, pw: initialPassword });
      else if (window.__mghAccountNotice(nextItem.account)) notify(window.__mghAccountNotice(nextItem.account));

      const updated = [nextItem, ...list.filter(x => x.id !== nextItem.id)];
      setList(updated);
      if (window.__MGH_CTR) window.__MGH_CTR.CONTRACTORS = updated;
      setCur(nextItem.id);
      setAddOpen(false);
      notify(`Contractor ${nextItem.name} (${nextItem.id}) created in database`);
    } catch (err) {
      notify('Error creating contractor: ' + err.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.name || !editForm.name.trim()) {
      notify('Please enter contractor name');
      return;
    }
    try {
      const client = window.api || api;
      const patch = {
        name: editForm.name.trim(),
        role: (editForm.role || '').trim(),
        country: editForm.country,
        email: editForm.email,
        phone: editForm.phone,
        basis: editForm.basis,
        rate: Number(editForm.rate) > 0 ? Number(editForm.rate) : null,
        method: editForm.method,
        wallet: editForm.wallet,
        walletFull: editForm.wallet,
        network: editForm.network,
        asset: editForm.asset,
        delivery: editForm.delivery,
        receiver: editForm.receiver,
        city: editForm.city,
        payCur: editForm.payCur,
        st: editForm.st
      };

      const updatedRecord = await client.updateContractor(editForm.id, patch);

      const updated = list.map(x => x.id === editForm.id ? (updatedRecord || { ...x, ...editForm, ...patch }) : x);
      setList(updated);
      if (window.__MGH_CTR) window.__MGH_CTR.CONTRACTORS = updated;
      setEditOpen(false);
      notify(`Contractor ${editForm.name} (${editForm.id}) updated in database`);
    } catch (err) {
      notify('Error updating contractor: ' + err.message);
    }
  };

  return <Page>
    <PageHeader
      breadcrumbs={['Contractors', tab === 'contractors' ? 'Directory' : 'Contracts']}
      title="Contractors"
      status={<Badge tone={dbConnected ? 'success' : 'warning'} dot>{dbConnected ? 'Conectado' : 'Sin conexión'}</Badge>}
      description="Payout profile of contractor-type employees. They log time like everyone else and are paid in the same payroll (#processing) from their approved timesheets — no withholdings or TSS."
      actions={<>
        <Button variant="secondary" icon="refresh" onClick={() => fetchContractors(true)}>Refresh</Button>
        <Button icon="person_add" onClick={handleOpenAdd}>Add Contractor</Button>
      </>}
    />
    <Grid min={200}>
      <StatCard label="Active contractors" value={active.length} unit={'/ ' + list.length} icon="badge" style={{ minHeight: 0 }} />
      <StatCard label="Countries" value={new Set(active.map(x => x.country).filter(Boolean)).size} icon="public" tone="accent" style={{ minHeight: 0 }} />
      <StatCard label="Payout rails" value={active.filter(x => !isWU(x)).length + ' / ' + active.filter(isWU).length} unit="Coinbase • WU" icon="currency_exchange" tone="success" style={{ minHeight: 0 }} />
    </Grid>
    <Tabs value={tab} onChange={setTab} tabs={[{ value: 'contractors', label: 'Contractors' }, { value: 'contracts', label: 'Contracts' }]} />
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <Card padding={20} style={{ flex: '1 1 520px', minWidth: 0 }}>
        <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search name, ID, country…" chips={<FilterChips value={chip} onChange={setChip} options={[{ value: 'all', label: 'All', count: list.length }, { value: 'Active', label: 'Active', count: active.length }, { value: 'Ended', label: 'Ended' }]} />} />
        <DataTable style={{ marginTop: 14 }} rows={t.rows} onRowClick={r => setCur(r.id)} activeRow={cur} columns={tab === 'contractors' ? [
          { key: 'name', label: 'Contractor', render: r => <PersonCell c={r} sub={r.id + ' • ' + (r.role || '—')} /> },
          { key: 'country', label: 'Country', render: r => r.country || '—' },
          { key: 'rate', label: 'Rate', align: 'right', render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{rateTxt(r)}</span> },
          { key: 'asset', label: 'Payout', render: r => isWU(r) ? <span style={{ display: 'flex', gap: 4 }}><Badge size="sm" tone="warning">Western Union</Badge>{r.delivery && <Badge size="sm" tone="neutral">{r.delivery}</Badge>}</span> : r.method ? <span style={{ display: 'flex', gap: 4 }}><Badge size="sm" tone="primary">{r.asset || r.method}</Badge>{r.network && <Badge size="sm" tone="neutral">{r.network}</Badge>}</span> : '—' },
          { key: 'st', label: 'Status', render: r => <Badge size="sm" dot tone={r.st === 'Active' ? 'success' : 'neutral'}>{r.st}</Badge> }] : [
          { key: 'name', label: 'Contractor', render: r => <PersonCell c={r} sub={r.country} /> },
          { key: 'basis', label: 'Basis' },
          { key: 'start', label: 'Start', render: r => r.start || '—' },
          { key: 'end', label: 'End', render: r => r.end || '—' },
          { key: 'rate', label: 'Rate', align: 'right', render: r => rateTxt(r) },
          { key: 'cur', label: 'Currency', mono: true, render: r => r.cur || '—' }]} emptyText={list.length ? 'No contractors match these filters.' : 'No hay contratistas registrados.'} />
        <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="contractors" />
      </Card>
      <Card padding={20} style={{ flex: '1 1 320px', maxWidth: 400, minWidth: 0 }}>
        {!c.id ? <div className="mgh-body" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--mgh-ink-3)' }}>No hay contratistas registrados. Los contratistas son colaboradores y se pagan en la misma nómina (#processing).</div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Avatar name={c.name} size={48} /><div style={{ flex: 1, minWidth: 0 }}><div className="mgh-h3">{c.name}</div><div className="mgh-body">{c.role || '—'} • {c.country || '—'}</div></div><Badge mono tone="dark">{c.id}</Badge></div>
          <Section icon="person" title="Personal information"><KeyValue label="Email" value={c.email || '—'} /><KeyValue label="Phone" value={c.phone || '—'} mono /><KeyValue label="Country" value={c.country || '—'} /></Section>
          <Section icon="contract" title="Contract"><KeyValue label="Start date" value={c.start || '—'} /><KeyValue label="End date" value={c.end || 'Open-ended'} /><KeyValue label={c.basis === 'Fixed Monthly' ? 'Fixed monthly fee' : 'Hourly rate'} value={rateTxt(c)} /><KeyValue label="Contract currency" value={c.cur || '—'} mono /></Section>
          {isWU(c) ? <Section icon="currency_exchange" title="Payment"><KeyValue label="Method" value="Western Union" /><KeyValue label="Delivery" value={c.delivery || '—'} /><KeyValue label="Receiver name (as on ID)" value={c.receiver || '—'} /><KeyValue label="Payout location" value={[c.city, c.country].filter(Boolean).join(', ') || '—'} />{c.bank && <KeyValue label="Receiver bank" value={c.bank + (c.acct ? ' ' + c.acct : '')} mono />}<KeyValue label="Payout currency" value={c.payCur || '—'} mono aside={c.fx != null && c.payCur ? <Badge size="sm" tone="neutral">{'1 USD = ' + c.fx + ' ' + c.payCur}</Badge> : null} /><KeyValue label="Transfer fee" value={c.wuFee != null ? fmtUSD(c.wuFee) : '—'} /></Section>
          : <Section icon="account_balance_wallet" title="Payment"><KeyValue label="Method" value={c.method || '—'} /><KeyValue label={(c.walletFull || c.wallet || '').includes('@') ? 'Coinbase email' : 'Wallet address'} value={c.wallet || '—'} mono /><KeyValue label="Preferred currency" value={c.asset || '—'} aside={c.asset === 'USDC' && <Badge size="sm" tone="success">Recommended</Badge>} /><KeyValue label="Network" value={c.network || '—'} /></Section>}
          <div style={{ display: 'flex', gap: 8 }}><Button variant="secondary" icon="edit" style={{ flex: 1 }} onClick={handleOpenEdit}>Edit</Button></div>
        </div>}
      </Card>
    </div>

    <Modal open={!!newPass} title="Contractor login created" onClose={() => setNewPass(null)} width={480}
      actions={<><Button variant="secondary" icon="content_copy" onClick={() => { try { navigator.clipboard.writeText(newPass.pw); notify('Password copied'); } catch (e) { notify('Copy failed • select it manually'); } }}>Copy</Button><Button onClick={() => setNewPass(null)}>Done</Button></>}>
      {newPass && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="mgh-body">Initial password for <b>{newPass.email}</b>. It is shown only once and is temporary: they must replace it at first sign-in. Share it privately.</div>
        <div style={{ padding: 12, borderRadius: 8, background: 'var(--mgh-surface-1)', font: '700 16px/22px var(--font-mono)', color: 'var(--mgh-ink)', letterSpacing: 0.5 }}>{newPass.pw}</div>
        <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>They can change it from the user menu → Cambiar contraseña, or sign in with Google.</div>
      </div>}
    </Modal>
    <Modal open={addOpen} title="Add New Contractor" onClose={() => setAddOpen(false)} width={580}
      actions={<>
        <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
        <Button variant="primary" icon="person_add" onClick={handleSaveAdd}>Save Contractor</Button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: 'span 2', padding: '10px 14px', borderRadius: 8, background: 'var(--mgh-primary-50, #EEF2FF)', border: '1px solid var(--mgh-primary-200, #C7D2FE)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="verified_user" size={20} color="var(--mgh-primary, #4F46E5)" />
          <span style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink, #1F2937)' }}>
            Se creará automáticamente un usuario de sistema con rol de <strong>Contratista</strong> para permitirle ingresar al sistema y cargar sus horas y entregables.
          </span>
        </div>
        <TextField label="Contractor Full Name" value={addForm.name} onChange={x => setAddForm(f => ({ ...f, name: typeof x === 'string' ? x : x.target.value }))} placeholder="e.g. Roberto Sánchez" />
        <TextField label="Role / Scope" value={addForm.role} onChange={x => setAddForm(f => ({ ...f, role: typeof x === 'string' ? x : x.target.value }))} placeholder="e.g. Senior Frontend Dev" />
        <Select label="Country of Residence" value={addForm.country} onChange={x => setAddForm(f => ({ ...f, country: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(COUNTRIES)} />
        <TextField label="Email Address (Login Account)" value={addForm.email} onChange={x => setAddForm(f => ({ ...f, email: typeof x === 'string' ? x : x.target.value }))} placeholder="e.g. dev@myglobalhub.net" />
        <TextField label="Contraseña Inicial (Password)" type="password" value={addForm.password || ''} onChange={x => setAddForm(f => ({ ...f, password: typeof x === 'string' ? x : x.target.value }))} placeholder="Vacío = se genera una segura" />
        <TextField label="Phone Number" value={addForm.phone} onChange={x => setAddForm(f => ({ ...f, phone: typeof x === 'string' ? x : x.target.value }))} placeholder="+1 809 ..." />
        <Select label="Compensation Basis" value={addForm.basis} onChange={x => setAddForm(f => ({ ...f, basis: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={['Hourly', 'Fixed Monthly']} />
        <TextField label={addForm.basis === 'Hourly' ? 'Hourly Rate (USD)' : 'Monthly Rate (USD)'} type="number" value={String(addForm.rate)} placeholder="0.00" onChange={x => setAddForm(f => ({ ...f, rate: typeof x === 'string' ? x : x.target.value }))} />
        <Select label="Disbursement Method" value={addForm.method} onChange={x => setAddForm(f => ({ ...f, method: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(['Coinbase', 'Western Union'])} />
        {addForm.method === 'Coinbase' ? <>
          <Select label="Crypto Asset" value={addForm.asset} onChange={x => setAddForm(f => ({ ...f, asset: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(['USDC', 'ETH', 'BTC'])} />
          <Select label="Network Rail" value={addForm.network} onChange={x => setAddForm(f => ({ ...f, network: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(['Base', 'Polygon', 'Ethereum', 'Solana'])} />
          <div style={{ gridColumn: 'span 2' }}>
            <TextField label="Wallet Address or Coinbase Email" mono value={addForm.wallet} onChange={x => setAddForm(f => ({ ...f, wallet: typeof x === 'string' ? x : x.target.value }))} placeholder="0x... or user@coinbase" />
          </div>
        </> : addForm.method === 'Western Union' ? <>
          <Select label="Delivery Mode" value={addForm.delivery} onChange={x => setAddForm(f => ({ ...f, delivery: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(['Cash Pickup', 'Bank Deposit'])} />
          <TextField label="Receiver Full Name (as on ID)" value={addForm.receiver} onChange={x => setAddForm(f => ({ ...f, receiver: typeof x === 'string' ? x : x.target.value }))} placeholder="Legal name" />
          <TextField label="Payout City / State" value={addForm.city} onChange={x => setAddForm(f => ({ ...f, city: typeof x === 'string' ? x : x.target.value }))} placeholder="City, State" />
          <TextField label="Payout Currency" mono value={addForm.payCur} onChange={x => setAddForm(f => ({ ...f, payCur: typeof x === 'string' ? x : x.target.value }))} placeholder="MXN, HNL, USD" />
        </> : null}
      </div>
    </Modal>

    <Modal open={editOpen} title={`Edit Contractor • ${editForm.name || ''} (${editForm.id || ''})`} onClose={() => setEditOpen(false)} width={580}
      actions={<>
        <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
        <Button variant="primary" icon="save" onClick={handleSaveEdit}>Save Changes</Button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <TextField label="Contractor Full Name" value={editForm.name || ''} onChange={x => setEditForm(f => ({ ...f, name: typeof x === 'string' ? x : x.target.value }))} />
        <TextField label="Role / Scope" value={editForm.role || ''} onChange={x => setEditForm(f => ({ ...f, role: typeof x === 'string' ? x : x.target.value }))} />
        <Select label="Status" value={editForm.st || 'Active'} onChange={x => setEditForm(f => ({ ...f, st: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={['Active', 'Ended']} />
        <Select label="Country of Residence" value={editForm.country || ''} onChange={x => setEditForm(f => ({ ...f, country: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(COUNTRIES, editForm.country)} />
        <TextField label="Email Address" value={editForm.email || ''} onChange={x => setEditForm(f => ({ ...f, email: typeof x === 'string' ? x : x.target.value }))} />
        <TextField label="Phone Number" value={editForm.phone || ''} onChange={x => setEditForm(f => ({ ...f, phone: typeof x === 'string' ? x : x.target.value }))} />
        <Select label="Compensation Basis" value={editForm.basis || 'Hourly'} onChange={x => setEditForm(f => ({ ...f, basis: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={['Hourly', 'Fixed Monthly']} />
        <TextField label={editForm.basis === 'Hourly' ? 'Hourly Rate (USD)' : 'Monthly Rate (USD)'} type="number" value={String(editForm.rate || '')} onChange={x => setEditForm(f => ({ ...f, rate: typeof x === 'string' ? x : x.target.value }))} />
        <Select label="Disbursement Method" value={editForm.method || ''} onChange={x => setEditForm(f => ({ ...f, method: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(['Coinbase', 'Western Union'], editForm.method)} />
        {editForm.method === 'Coinbase' ? <>
          <Select label="Crypto Asset" value={editForm.asset || ''} onChange={x => setEditForm(f => ({ ...f, asset: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(['USDC', 'ETH', 'BTC'], editForm.asset)} />
          <Select label="Network Rail" value={editForm.network || ''} onChange={x => setEditForm(f => ({ ...f, network: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(['Base', 'Polygon', 'Ethereum', 'Solana'], editForm.network)} />
          <div style={{ gridColumn: 'span 2' }}>
            <TextField label="Wallet Address or Coinbase Email" mono value={editForm.wallet || ''} onChange={x => setEditForm(f => ({ ...f, wallet: typeof x === 'string' ? x : x.target.value }))} />
          </div>
        </> : editForm.method === 'Western Union' ? <>
          <Select label="Delivery Mode" value={editForm.delivery || ''} onChange={x => setEditForm(f => ({ ...f, delivery: typeof x === 'string' ? x : x.target ? x.target.value : x }))} options={selOpts(['Cash Pickup', 'Bank Deposit'], editForm.delivery)} />
          <TextField label="Receiver Full Name" value={editForm.receiver || ''} onChange={x => setEditForm(f => ({ ...f, receiver: typeof x === 'string' ? x : x.target.value }))} />
          <TextField label="Payout City / State" value={editForm.city || ''} onChange={x => setEditForm(f => ({ ...f, city: typeof x === 'string' ? x : x.target.value }))} />
          <TextField label="Payout Currency" mono value={editForm.payCur || ''} onChange={x => setEditForm(f => ({ ...f, payCur: typeof x === 'string' ? x : x.target.value }))} />
        </> : null}
      </div>
    </Modal>
  </Page>;
}

// App.loadFromApi writes the backend contractors/payments here
window.__MGH_CTR = { CONTRACTORS, INIT_PAYMENTS };
window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { contractors: Contractors });

})();

// ---- ScreensAttendance.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, Tabs, PageHeader, Select, TextField, Toggle, KeyValue, ProgressBar } = window.MyGlobalHubDesignSystem_2a603d;
const A = window.MGH_ATT;
let SHARED = { d: A.TODAY, org: 'All', dept: 'All', sup: 'All' };
// Date ranges relative to today: current pay period (to date), previous one, last 7 days, this month
const RANGES = (() => {
  const cur = getCurrentPeriod(), prev = getQuincenaForDate(new Date(A.addD(cur.startDate, -1) + 'T12:00:00'));
  const upTo = d => d > A.TODAY ? A.TODAY : d;
  return { [cur.code]: [cur.startDate, upTo(cur.endDate)], [prev.code]: [prev.startDate, prev.endDate], 'Last 7 days': [A.addD(A.TODAY, -6), A.TODAY], 'This month': [A.TODAY.slice(0, 8) + '01', A.TODAY] };
})();
const RANGE_KEYS = Object.keys(RANGES);
const SUBS = [['attendance', 'Dashboard', 'how_to_reg'], ['attDaily', 'Registro por horas', 'today'], ['actDaily', 'Registro por actividades', 'task_alt'], ['attCalendar', 'Calendar', 'calendar_month'], ['attExceptions', 'Exceptions', 'report'], ['attLeave', 'Leave Requests', 'beach_access'], ['attHolidays', 'Holidays', 'celebration'], ['attReports', 'Reports', 'summarize'], ['attRules', 'Rules', 'rule']];
const fmtD = d => { const t = new Date(d + 'T00:00:00Z'); return t.toLocaleDateString(LOC(), { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
const v = x => typeof x === 'string' ? x : x && x.target ? x.target.value : x;
// Leave requests change from other accounts: refresh them from the backend whenever a screen that lists them opens
function useLeaveSync() { React.useEffect(() => { if (window.api && window.api.leaveRequests) window.api.leaveRequests().then(l => A.setLeave(Array.isArray(l) ? l : [])).catch(() => {}); }, []); }
function useATT() { const [, f] = React.useState(0); React.useEffect(() => { const h = () => f(x => x + 1); window.addEventListener('mgh-att', h); window.addEventListener('mgh-wf', h); return () => { window.removeEventListener('mgh-att', h); window.removeEventListener('mgh-wf', h); }; }, []); }
function Pill({ status }) { const c = A.STATUS_COLOR[status] || ['#EAEDFF', '#43474D']; return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 9999, font: '700 11px/16px var(--font-sans)', background: c[0], color: c[1], whiteSpace: 'nowrap', boxShadow: c[0] === 'transparent' ? 'inset 0 0 0 1px var(--mgh-surface-3)' : 'none' }}>{status}</span>; }
function Dlg({ open, title, onClose, children, actions }) { if (!open) return null; return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(19,27,46,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}><div onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="mgh-h3">{title}</span><IconButton icon="close" onClick={onClose} title="Close" /></div>{children}<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>{actions}</div></div></div>; }
function Table({ cols, rows, empty }) {
  if (!rows.length) return <div className="mgh-body" style={{ padding: 28, textAlign: 'center', color: 'var(--mgh-ink-3)' }}>{empty || 'No records match these filters.'}</div>;
  return <div className="mgh-scroll" style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
    <thead><tr>{cols.map(c => <th key={c[0]} style={{ textAlign: c[1] || 'left', padding: '10px 12px', background: 'var(--mgh-surface-1)', font: '700 11px/14px var(--font-sans)', letterSpacing: '0.55px', textTransform: 'uppercase', color: 'var(--mgh-ink-2)', whiteSpace: 'nowrap' }}>{c[0]}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} style={{ borderBottom: '1px solid var(--mgh-surface-2)' }}>{r.map((x, j) => <td key={j} style={{ padding: '10px 12px', textAlign: cols[j][1] || 'left', font: '500 13px/18px var(--font-sans)', color: 'var(--mgh-ink)', fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{x}</td>)}</tr>)}</tbody></table></div>;
}
function Who({ id }) { const e = EMPLOYEES.find(x => x.id === id) || { name: id }; return <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><Avatar src={e.avatar} name={e.name} size={28} /><div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ font: '600 13px/18px var(--font-sans)', whiteSpace: 'nowrap' }}>{e.name}</span><span style={{ font: '600 11px/14px var(--font-mono)', color: 'var(--mgh-ink-3)' }}>{id}</span></div></div>; }
function Filters({ f, setF, withDate }) {
  const ALL = 'All', o = (l, n) => [{ value: ALL, label: 'All ' + n }, ...[...new Set(l)].sort().map(x => ({ value: x, label: x }))];
  const s = k => x => setF(p => ({ ...p, [k]: v(x) }));
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    {withDate && <><IconButton icon="chevron_left" title="Previous day" onClick={() => setF(p => ({ ...p, d: A.addD(p.d, -1) }))} /><input type="date" value={f.d} max={A.TODAY} onChange={e => e.target.value && setF(p => ({ ...p, d: e.target.value }))} style={{ height: 32, border: 'none', borderRadius: 8, boxShadow: 'inset 0 0 0 1px var(--mgh-surface-3)', padding: '0 10px', font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }} /><IconButton icon="chevron_right" title="Next day" onClick={() => setF(p => ({ ...p, d: p.d < A.TODAY ? A.addD(p.d, 1) : p.d }))} /><Button size="sm" variant="ghost" onClick={() => setF(p => ({ ...p, d: A.TODAY }))}>Today</Button></>}
    <Select size="sm" icon="domain" value={f.org} onChange={s('org')} options={o(EMPLOYEES.map(e => e.entity), 'organizations')} style={{ display: 'none' }} />
    <Select size="sm" icon="apartment" value={f.dept} onChange={s('dept')} options={o(EMPLOYEES.map(e => e.dept), 'departments')} />
    <Select size="sm" icon="supervisor_account" value={f.sup} onChange={s('sup')} options={o(EMPLOYEES.map(e => e.mgr), 'supervisors')} />
  </div>;
}
const match = f => e => MGH_RBAC.can('attendance.view', e) && (f.org === 'All' || e.entity === f.org) && (f.dept === 'All' || e.dept === f.dept) && (f.sup === 'All' || e.mgr === f.sup);
const lunchTxt = p => p.lo && p.li ? p.lo + '–' + p.li : p.lo ? p.lo + '–…' : '—';

function Dashboard({ f, setF, go }) {
  useLeaveSync();
  const s = A.summary(f.d, match(f));
  const k = [['Employees Present', s.present, 'how_to_reg', 'success'], ['No Record', s.noRecord, 'person_off', 'neutral'], ['Late Arrivals', s.late, 'schedule', 'warning'], ['Early Departures', s.early, 'logout', 'warning'], ['Missing Clock-Out', s.missingOut, 'timer_off', 'danger'], ['Missing Clock-In', s.missingIn, 'login', 'danger'], ['On Leave', s.onLeave, 'beach_access', 'accent'], ['Remote', s.remote, 'home_work', 'primary'], ['Field Work', s.field, 'directions_car', 'primary'], ['Attendance %', s.pct == null ? '—' : s.pct + '%', 'percent', s.pct == null ? 'neutral' : s.pct >= 90 ? 'success' : 'warning']];
  const days = []; for (let d = f.d, i = 0; days.length < 10 && i < 30; i++, d = A.addD(d, -1)) if (A.dow(d) % 6) days.unshift(d);
  const trend = days.map(d => ({ d, p: A.summary(d, match(f)).pct || 0 }));
  const ex = A.daily(f.d, match(f)).flatMap(x => x.exceptions).filter(x => !['Approved', 'Corrected', 'Closed'].includes(x.status));
  const pend = A.leave().filter(l => /Pending/.test(l.status));
  return <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,170px),1fr))', gap: 14 }}>{k.map(([l, val, ic, t]) => <StatCard key={l} label={l} value={String(val)} icon={ic} tone={t} style={{ minHeight: 0 }} />)}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 20, alignItems: 'start' }}>
      <Card icon="insights" title="Attendance % • last 10 working days" subtitle={fmtD(days[0]) + ' – ' + fmtD(days[days.length - 1])}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150 }}>{trend.map(t => <div key={t.d} title={fmtD(t.d) + ' • ' + t.p + '%'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><span style={{ font: '700 10px/12px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>{Math.round(t.p)}</span><div style={{ width: '100%', height: Math.max(4, (t.p - 50) * 2.4), background: t.d === f.d ? 'var(--mgh-primary)' : 'var(--mgh-primary-100)', borderRadius: 4 }} /><span style={{ font: '600 10px/12px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{t.d.slice(8)}</span></div>)}</div>
      </Card>
      <Card icon="report" title={'Open exceptions • ' + fmtD(f.d)} actions={<Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={() => go('attExceptions')}>All exceptions</Button>}>
        {ex.length ? <div style={{ display: 'flex', flexDirection: 'column' }}>{ex.slice(0, 6).map(x => <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--mgh-surface-2)' }}><Who id={x.emp} /><span className="mgh-body" style={{ textAlign: 'right' }}>{x.label}</span></div>)}</div> : <span className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>No open exceptions for this day.</span>}
      </Card>
      <Card icon="beach_access" title="Leave requests pending" actions={<Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={() => go('attLeave')}>Leave Requests</Button>}>
        {pend.length ? pend.map(l => <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--mgh-surface-2)' }}><Who id={l.emp} /><span className="mgh-body">{l.type} • {fmtD(l.from)}{l.to !== l.from ? ' → ' + fmtD(l.to) : ''}</span><Badge size="sm" tone="warning">{l.status}</Badge></div>) : <span className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>Nothing pending.</span>}
      </Card>
    </div>
  </>;
}
function Daily({ f, go, notify }) {
  const [st, setSt] = React.useState('All');
  const [punchDlg, setPunchDlg] = React.useState(false);
  const [punchEmp, setPunchEmp] = React.useState('');
  const [cin, setCin] = React.useState('');
  const [cout, setCout] = React.useState('');
  const [mode, setMode] = React.useState('Office');
  const L = A.daily(f.d, match(f)).filter(x => st === 'All' || x.status === st);
  const all = A.daily(f.d, match(f));

  const savePunch = async () => {
    if (!punchEmp) { if (notify) notify('Selecciona un empleado'); return; }
    if (!cin || !cout) { if (notify) notify('Indica la hora de entrada y la de salida'); return; }
    const a = A.tm(cin), b = A.tm(cout);
    if (a == null || b == null || b <= a) { if (notify) notify('La salida debe ser posterior a la entrada'); return; }
    // Hours from the entered times (minus the org's auto-lunch when the shift is over 6h)
    const r = A.rulesFor((A.roster.find(e => e.id === punchEmp) || {}).entity);
    const worked = Math.max(0, (b - a - (r.autoLunch && b - a > 360 ? r.minLunch : 0)) / 60);
    const hours = +worked.toFixed(2), overtime = +Math.max(0, worked - r.shift).toFixed(2);
    try {
      // Save to the backend first; only reflect it locally once the server accepted it
      await window.api.recordPunch({ empId: punchEmp, date: f.d, clock_in: cin, clock_out: cout, mode, hours, overtime });
      A.punch({ emp: punchEmp, date: f.d, in: cin, out: cout, mode, hours, overtime });
      if (notify) notify(`Ponche guardado para ${punchEmp} (${cin} – ${cout} • ${hours}h)`);
      setPunchDlg(false); setPunchEmp(''); setCin(''); setCout('');
    } catch (err) {
      if (notify) notify('Error al guardar ponche: ' + err.message);
    }
  };

  return <Card padding={20}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <FilterChips value={st} onChange={setSt} options={[{ value: 'All', label: 'All', count: all.length }, ...A.STATUSES.map(x => ({ value: x, label: x, count: all.filter(y => y.status === x).length })).filter(o => o.count)]} />
      <Button size="sm" icon="schedule" variant="primary" onClick={() => setPunchDlg(true)}>+ Registrar Ponche</Button>
    </div>
    <div style={{ height: 14 }} />
    <Table cols={[['Employee'], ['Status'], ['Clock In'], ['Lunch'], ['Clock Out'], ['Hours', 'right'], ['Exception'], ['Supervisor']]} rows={L.map(x => [<Who id={x.emp} />, <Pill status={x.status} />, x.punches.in || '—', lunchTxt(x.punches) + (x.autoLunch ? ' (auto ' + A.rules.minLunch + 'm)' : ''), x.inProgress ? 'In progress' : x.punches.out || '—', x.hours ? x.hours.toFixed(1) + 'h' : '—',
      x.exceptions.length ? <a onClick={() => go('attExceptions')} style={{ cursor: 'pointer', font: '600 12px/16px var(--font-sans)' }}>{x.exceptions.map(e => e.label.split(' • ')[0]).join(', ')}</a> : (x.leave ? x.leave.type : x.holiday ? x.holiday.desc : '—'), x.sup])} />
    <Dlg open={punchDlg} title={`Registrar Ponche • ${fmtD(f.d)}`} onClose={() => setPunchDlg(false)} actions={<><Button variant="outline" onClick={() => setPunchDlg(false)}>Cancelar</Button><Button icon="save" disabled={!punchEmp || !cin || !cout} onClick={savePunch}>Guardar Ponche</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Select label="Empleado *" value={punchEmp} onChange={x => setPunchEmp(v(x))} options={[{ value: '', label: 'Selecciona…' }, ...EMPLOYEES.map(e => ({ value: e.id, label: e.name + ' • ' + e.id }))]} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <TextField label="Hora Entrada *" type="time" value={cin} onChange={x => setCin(v(x))} />
          <TextField label="Hora Salida *" type="time" value={cout} onChange={x => setCout(v(x))} />
        </div>
        <Select label="Modalidad" value={mode} onChange={x => setMode(v(x))} options={[{ value: 'Office', label: 'Office' }, { value: 'Remote', label: 'Remote' }, { value: 'Field', label: 'Field' }]} />
      </div>
    </Dlg>
  </Card>;
}
function Calendar({ f, setF, go }) {
  const [view, setView] = React.useState('month'); const [ym, setYm] = React.useState(() => [Number(A.TODAY.slice(0, 4)), Number(A.TODAY.slice(5, 7))]);
  const E = EMPLOYEES.filter(match(f));
  const legend = ['Present', 'Late', 'No Record', 'Vacation', 'Sick', 'Remote', 'Training', 'Business Trip', 'Holiday', 'Pending Review'];
  const days = view === 'month' ? A.month(ym[0], ym[1]) : (() => { const d0 = A.addD(f.d, -((A.dow(f.d) + 6) % 7)); return A.range(d0, A.addD(d0, 6)); })();
  const nav = n => { if (view === 'month') setYm(([y, m]) => { const t = m + n; return t < 1 ? [y - 1, 12] : t > 12 ? [y + 1, 1] : [y, t]; }); else setF(p => ({ ...p, d: A.addD(p.d, 7 * n) > A.TODAY ? A.TODAY : A.addD(p.d, 7 * n) })); };
  const title = view === 'month' ? new Date(Date.UTC(ym[0], ym[1] - 1, 1)).toLocaleDateString(LOC(), { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Week of ' + fmtD(days[0]);
  return <Card padding={20}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconButton icon="chevron_left" title="Previous" onClick={() => nav(-1)} /><span className="mgh-h3" style={{ minWidth: 170, textAlign: 'center' }}>{title}</span><IconButton icon="chevron_right" title="Next" onClick={() => nav(1)} /></div>
      <FilterChips value={view} onChange={x => x === 'day' ? go('attDaily') : setView(x)} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }]} />
    </div>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>{legend.map(l => { const lc = A.STATUS_COLOR[l] || ['transparent', '#74777F']; return <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)' }}><span style={{ width: 12, height: 12, borderRadius: 3, background: lc[0], boxShadow: 'inset 0 0 0 1px ' + lc[1] }} />{l}</span>; })}</div>
    <div className="mgh-scroll" style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 3, minWidth: view === 'month' ? 980 : 760 }}>
        <thead><tr><th style={{ textAlign: 'left', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-2)', padding: '4px 8px', position: 'sticky', left: 0, background: '#fff', minWidth: 170 }}>Employee</th>{days.map(d => <th key={d} onClick={() => { setF(p => ({ ...p, d: d > A.TODAY ? A.TODAY : d })); if (view === 'week') go('attDaily'); }} style={{ cursor: 'pointer', font: '700 10px/12px var(--font-sans)', color: d === A.TODAY ? 'var(--mgh-primary)' : A.dow(d) % 6 ? 'var(--mgh-ink-2)' : 'var(--mgh-ink-4)', padding: 2, minWidth: view === 'month' ? 26 : 96 }}>{view === 'month' ? d.slice(8) : fmtD(d)}</th>)}</tr></thead>
        <tbody>{E.map(e => <tr key={e.id}><td style={{ position: 'sticky', left: 0, background: '#fff', padding: '2px 8px', font: '600 12px/16px var(--font-sans)', whiteSpace: 'nowrap' }}>{e.name}</td>{days.map(d => { const x = A.day(e.id, d), c = A.STATUS_COLOR[x.status] || ['transparent', '#999']; return <td key={d} title={e.name + ' • ' + fmtD(d) + ' • ' + x.status + (x.punches.in ? ' • ' + x.punches.in + '–' + (x.punches.out || '…') : '')} onClick={() => { if (!x.future && !x.weekend) { setF(p => ({ ...p, d })); go('attDaily'); } }} style={{ cursor: x.future || x.weekend ? 'default' : 'pointer', background: c[0], height: view === 'month' ? 24 : 44, borderRadius: 4, textAlign: 'center', font: '700 10px/12px var(--font-sans)', color: c[1], boxShadow: d === A.TODAY ? 'inset 0 0 0 2px var(--mgh-primary)' : 'none' }}>{view === 'week' && !x.weekend && !x.future ? <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span>{x.status}</span><span style={{ fontWeight: 500 }}>{x.punches.in ? x.punches.in + '–' + (x.punches.out || '…') : ''}</span></div> : ''}</td>; })}</tr>)}</tbody>
      </table>
    </div>
  </Card>;
}
function Exceptions({ f, notify }) {
  const [rng, setRng] = React.useState(RANGE_KEYS[0]); const [type, setType] = React.useState('All'); const [st, setSt] = React.useState('Open');
  const [dlg, setDlg] = React.useState(null); const [txt, setTxt] = React.useState(''); const [fix, setFix] = React.useState({});
  const R = RANGES[rng];
  const all = A.exceptions(R[0], R[1]).filter(x => match(f)(EMPLOYEES.find(e => e.id === x.emp) || {}));
  const done = s => ['Approved', 'Corrected', 'Closed'].includes(s);
  const L = all.filter(x => (type === 'All' || x.type === type) && (st === 'All' || (st === 'Open' ? !done(x.status) : done(x.status))));
  const types = [...new Set(all.map(x => x.type))];
  const TL = { missing_in: 'Missing Clock In', missing_out: 'Missing Clock Out', late: 'Late Arrival', early: 'Early Departure', overtime: 'Overtime', duplicate: 'Duplicate Entries', overlap: 'Overlapping Time', invalid: 'Invalid Shift' };
  // Exceptions are computed in the browser from the punches (the server stores none yet), so review decisions
  // live in this browser. A correction changes the punch itself: it is saved to the server first.
  const run = async (x, a, c, fx) => {
    if (a === 'correct') {
      if (!A.canManage(x)) { notify('Only Supervisor, Manager, HR or Admin can correct'); return false; }
      const p = (A.day(x.emp, x.date) || {}).punches || {};
      const nx = { ...p };
      Object.keys(fx || {}).forEach(k => { if (fx[k] !== undefined) nx[k] = fx[k]; });
      if (!nx.in || !nx.out) { notify('Indica la entrada y la salida para guardar la corrección'); return false; }
      const ta = A.tm(nx.in), tb = A.tm(nx.out);
      if (ta == null || tb == null || tb <= ta) { notify('La salida debe ser posterior a la entrada'); return false; }
      const lo = nx.lo ? A.tm(nx.lo) : null, li = nx.li ? A.tm(nx.li) : null;
      const rr = A.rulesFor((A.roster.find(e => e.id === x.emp) || {}).entity);
      const lunch = lo != null && li != null && li > lo ? li - lo : (rr.autoLunch && tb - ta > 360 ? rr.minLunch : 0);
      const worked = Math.max(0, (tb - ta - lunch) / 60);
      try {
        await window.api.recordPunch({ empId: x.emp, date: x.date, clock_in: nx.in, clock_out: nx.out, lunch_out: nx.lo || null, lunch_in: nx.li || null, hours: +worked.toFixed(2), overtime: +Math.max(0, worked - rr.shift).toFixed(2) });
      } catch (err) {
        notify('No se pudo guardar la corrección • ' + err.message);
        return false;
      }
    }
    const r = A.exAction(x, a, c, fx);
    notify(r.ok ? x.label.split(' • ')[0] + ' • ' + (a === 'comment' ? 'comment added' : a === 'correct' ? 'corrected' : a === 'review' ? 'in review' : a + 'd') : r.msg);
    return r.ok;
  };
  const cur = dlg && all.find(x => x.id === dlg.id) || (dlg && dlg.x);
  const day = cur && A.day(cur.emp, cur.date);
  return <Card padding={20}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Select size="sm" icon="date_range" value={rng} onChange={x => setRng(v(x))} options={RANGE_KEYS} />
      <Select size="sm" icon="category" value={type} onChange={x => setType(v(x))} options={[{ value: 'All', label: 'All types' }, ...types.map(t => ({ value: t, label: TL[t] }))]} />
      <FilterChips value={st} onChange={setSt} options={[{ value: 'Open', label: 'Open', count: all.filter(x => !done(x.status)).length }, { value: 'Done', label: 'Resolved', count: all.filter(x => done(x.status)).length }, { value: 'All', label: 'All', count: all.length }]} />
    </div>
    <div style={{ height: 14 }} />
    <Table cols={[['Employee'], ['Date'], ['Exception'], ['Severity'], ['Status'], ['Comments', 'right'], ['Actions', 'right']]} empty="No exceptions in this range."
      rows={L.map(x => [<Who id={x.emp} />, fmtD(x.date), x.label, <Badge size="sm" tone={x.sev === 'high' ? 'danger' : x.sev === 'medium' ? 'warning' : 'neutral'}>{x.sev}</Badge>, <Badge size="sm" dot tone={done(x.status) ? 'success' : x.status === 'In Review' ? 'info' : 'warning'}>{x.status}</Badge>, String(x.comments.length),
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}><Button size="sm" variant="secondary" icon="visibility" onClick={() => { setDlg({ id: x.id, x }); setTxt(''); setFix({}); if (x.status === 'Open') A.exAction(x, 'review'); }}>Review</Button>{!done(x.status) && A.canManage(x) && <Button size="sm" variant="ghost" icon="check" onClick={() => run(x, 'approve')}>Approve</Button>}</div>])} />
    <Dlg open={!!cur} title={cur ? cur.label : ''} onClose={() => setDlg(null)} actions={cur && <>
      <Button variant="outline" icon="chat" onClick={() => run(cur, 'comment', txt).then(ok => { if (ok) setTxt(''); })}>Comment</Button>
      {A.canManage(cur) && !done(cur.status) && <Button variant="outline" icon="check" onClick={() => run(cur, 'approve', txt).then(ok => { if (ok) setDlg(null); })}>Approve as is</Button>}
      {A.canManage(cur) && !done(cur.status) && <Button icon="edit" onClick={() => run(cur, 'correct', txt, fix).then(ok => { if (ok) setDlg(null); })}>Save correction</Button>}
      {A.canManage(cur) && !['Closed'].includes(cur.status) && <Button variant="ghost" icon="task_alt" onClick={() => run(cur, 'close', txt).then(ok => { if (ok) setDlg(null); })}>Close</Button>}
      {A.canManage(cur) && done(cur.status) && <Button variant="ghost" icon="undo" onClick={() => run(cur, 'reopen', txt)}>Reopen</Button>}</>}>
      {cur && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><Who id={cur.emp} /><span className="mgh-body">{fmtD(cur.date)} • <b>{cur.status}</b></span></div>
        <span className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>Las correcciones de ponches se guardan en el servidor. Los comentarios y estados de revisión de la excepción se guardan solo en este navegador.</span>
        {!A.canManage(cur) && <span className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>Viewing as {window.MGH_WF ? window.MGH_WF.role : ''}: you can comment; approval and corrections need Supervisor, Manager, HR or Admin.</span>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>{[['in', 'Clock in'], ['lo', 'Lunch out'], ['li', 'Lunch in'], ['out', 'Clock out']].map(([kk, l]) => <label key={kk} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ font: '700 10px/12px var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--mgh-ink-2)' }}>{l}</span><input type="time" disabled={!A.canManage(cur) || done(cur.status)} value={fix[kk] !== undefined ? fix[kk] : day.punches[kk] || ''} onChange={e => setFix(p => ({ ...p, [kk]: e.target.value }))} style={{ height: 36, border: 'none', borderRadius: 8, boxShadow: 'inset 0 0 0 1px var(--mgh-surface-3)', padding: '0 8px', font: '600 13px var(--font-sans)' }} /></label>)}</div>
        <textarea value={txt} onChange={e => setTxt(e.target.value)} rows={3} placeholder="Comment (visible to the employee and approvers)" style={{ border: 'none', outline: 'none', borderRadius: 8, padding: 10, background: 'var(--mgh-surface-1)', font: '400 13px/18px var(--font-sans)', resize: 'vertical' }} />
        {(cur.comments.length > 0 || cur.history.length > 0) && <div style={{ display: 'flex', flexDirection: 'column' }}>{[...cur.comments.map(c => ({ at: c.at, t: c.actor + ': "' + c.text + '"' })), ...cur.history.map(h => ({ at: h.at, t: h.actor + ' (' + h.role + ') • ' + h.action }))].sort((a, b) => a.at.localeCompare(b.at)).map((h, i) => <div key={i} className="mgh-body" style={{ padding: '6px 0', borderTop: '1px solid var(--mgh-surface-2)' }}><span style={{ font: '600 11px/14px var(--font-mono)', color: 'var(--mgh-ink-3)' }}>{new Date(h.at).toLocaleString(LOC(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span> {h.t}</div>)}</div>}
      </>}
    </Dlg>
  </Card>;
}
function Leave({ notify }) {
  useLeaveSync();
  const [form, setForm] = React.useState(() => ({ emp: '', type: 'Vacation', from: A.TODAY, to: A.TODAY, reason: '' }));
  const [rej, setRej] = React.useState(null); const [why, setWhy] = React.useState(''); const [chip, setChip] = React.useState('All');
  const L = A.leave().filter(l => chip === 'All' || (chip === 'Pending' ? /Pending/.test(l.status) : l.status === chip));
  const selfOnly = MGH_RBAC.scopeOf('leave.request') === 'self', meId = (MGH_RBAC.me() || {}).emp, canReq = MGH_RBAC.can('leave.request');
  const emp = selfOnly ? meId : form.emp;
  // Backend first (field names match leave.controller: empId/fromDate/toDate); the local engine only mirrors
  // what the server accepted, so a failed save is reported instead of silently living in this browser.
  const submit = async () => {
    if (!emp) { notify(selfOnly ? 'Your account is not linked to an employee record' : 'Selecciona un empleado'); return; }
    const e = EMPLOYEES.find(x => x.id === emp);
    const name = e ? e.name : emp;
    if (!form.from || !form.to || form.to < form.from) { notify('End date must be on or after start date'); return; }
    let saved;
    try {
      saved = await window.api.createLeaveRequest({ empId: emp, name, type: form.type, fromDate: form.from, toDate: form.to, reason: form.reason });
    } catch (err) {
      notify('Could not submit leave request • ' + err.message);
      return;
    }
    const r = A.requestLeave({ ...form, emp, name });
    notify(r.ok ? 'Leave request ' + (saved && saved.id ? saved.id : '') + ' sent to Supervisor' : r.msg);
    if (window.api.leaveRequests) window.api.leaveRequests().then(list => A.setLeave(list)).catch(() => {});
    setForm(p => ({ ...p, reason: '' }));
  };

  const act = async (l, a, c) => {
    if (a === 'reject' && !(c || '').trim()) { notify('A reason is required'); return false; }
    try {
      await window.api.reviewLeaveRequest(l.id, { action: a === 'cancel' ? 'cancel' : a === 'reject' ? 'reject' : 'approve', comment: c || '' });
    } catch (err) {
      notify('Could not update ' + l.id + ' • ' + err.message);
      return false;
    }
    const r = A.leaveAct(l, a, c);
    if (window.api.leaveRequests) window.api.leaveRequests().then(list => A.setLeave(list)).catch(() => {});
    notify(r.ok ? l.id + ' • ' + r.to : l.id + ' updated');
    return true;
  };
  const days = l => A.range(l.from, l.to).filter(d => A.dow(d) % 6).length;
  return <>
    <Card icon="route" title="Leave workflow" subtitle="Employee → Supervisor → HR → Approved → Calendar → Payroll">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))', gap: 10, alignItems: 'end' }}>
        {!canReq ? null : selfOnly ? <KeyValue label="Employee" value={MGH_RBAC.me().person + ' • ' + meId} /> : <Select label="Employee" value={form.emp} onChange={x => setForm(p => ({ ...p, emp: v(x) }))} options={[{ value: '', label: 'Selecciona…' }, ...MGH_RBAC.visible(EMPLOYEES, 'leave.request').map(e => ({ value: e.id, label: e.name + ' • ' + e.id }))]} />}
        {canReq && <Select label="Type" value={form.type} onChange={x => setForm(p => ({ ...p, type: v(x) }))} options={A.LEAVE_TYPES} />}
        {canReq && <TextField label="From" type="date" value={form.from} onChange={x => setForm(p => ({ ...p, from: v(x) }))} />}
        {canReq && <TextField label="To" type="date" value={form.to} onChange={x => setForm(p => ({ ...p, to: v(x) }))} />}
        {canReq && <TextField label="Reason" value={form.reason} onChange={x => setForm(p => ({ ...p, reason: v(x) }))} placeholder="Optional for vacation" />}
        {canReq ? <Button icon="send" onClick={submit}>Request Leave</Button> : <span className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>Your role approves requests at its workflow step.</span>}
      </div>
    </Card>
    <Card padding={20}>
      <FilterChips value={chip} onChange={setChip} options={['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'].map(x => ({ value: x, label: x, count: x === 'All' ? A.leave().length : A.leave().filter(l => x === 'Pending' ? /Pending/.test(l.status) : l.status === x).length }))} />
      <div style={{ height: 14 }} />
      <Table cols={[['Request'], ['Employee'], ['Type'], ['Dates'], ['Days', 'right'], ['Paid'], ['Status'], ['Actions', 'right']]} empty="No leave requests."
        rows={L.map(l => [<span style={{ font: '600 12px/16px var(--font-mono)' }}>{l.id}</span>, <Who id={l.emp} />, l.type, fmtD(l.from) + (l.to !== l.from ? ' → ' + fmtD(l.to) : ''), String(days(l)), l.type === 'Unpaid' ? 'No' : 'Yes', <Badge size="sm" dot tone={A.LEAVE_TONE[l.status]}>{l.status}</Badge>,
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{A.leaveCan(l) && <><Button size="sm" icon="check" onClick={() => act(l, 'approve')}>Approve</Button><Button size="sm" variant="danger" icon="close" onClick={() => { setRej(l); setWhy(''); }}>Reject</Button></>}
            {/Pending/.test(l.status) && MGH_RBAC.can('leave.cancel', l.emp) && <Button size="sm" variant="ghost" icon="block" onClick={() => act(l, 'cancel')}>Cancel</Button>}
            {!A.leaveCan(l) && /Pending/.test(l.status) && <span style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>Waiting for {l.status === 'Pending HR' ? 'HR' : 'Supervisor'}</span>}</div>])} />
    </Card>
    <Dlg open={!!rej} title={rej ? 'Reject ' + rej.id : ''} onClose={() => setRej(null)} actions={<><Button variant="outline" onClick={() => setRej(null)}>Cancel</Button><Button variant="danger" icon="close" disabled={!why.trim()} onClick={() => { if (act(rej, 'reject', why)) setRej(null); }}>Reject</Button></>}>
      <textarea value={why} onChange={e => setWhy(e.target.value)} rows={3} placeholder="Reason (required)" style={{ border: 'none', outline: 'none', borderRadius: 8, padding: 10, background: 'var(--mgh-surface-1)', font: '400 13px/18px var(--font-sans)' }} />
    </Dlg>
  </>;
}
function Holidays({ notify }) {
  const [org, setOrg] = React.useState(A.ORGS[0]); const [n, setN] = React.useState({ date: '', desc: '', country: 'Dominican Republic', region: 'National', paid: true, working: false });
  const H = A.holidays(org), C = { 'MGH Dominicana SRL': 'Dominican Republic' };
  const canManage = MGH_RBAC.can('holidays.manage');
  const fmt = h => new Date(h.date + 'T00:00:00Z').toLocaleDateString(LOC(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (!canManage) return <Card padding={20}>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
      <Select label="Organization" value={org} onChange={x => setOrg(v(x))} options={A.ORGS} />
    </div>
    <div style={{ height: 14 }} />
    <Table cols={[['Date'], ['Description'], ['Country'], ['Region'], ['Paid', 'center'], ['Working holiday', 'center']]} empty="No holidays configured."
      rows={H.map(h => [fmt(h), h.desc, h.country, h.region, h.paid ? 'Yes' : 'No', h.working ? 'Yes' : 'No'])} />
  </Card>;
  return <Card padding={20}>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
      <Select label="Organization" value={org} onChange={x => { const o = v(x); setOrg(o); setN(p => ({ ...p, country: C[o] })); }} options={A.ORGS} />
      <TextField label="Date" type="date" value={n.date} onChange={x => setN(p => ({ ...p, date: v(x) }))} />
      <TextField label="Description" value={n.desc} onChange={x => setN(p => ({ ...p, desc: v(x) }))} placeholder="e.g. Company anniversary" />
      <TextField label="Country" value={n.country} onChange={x => setN(p => ({ ...p, country: v(x) }))} />
      <TextField label="Region" value={n.region} onChange={x => setN(p => ({ ...p, region: v(x) }))} />
      <Toggle checked={n.paid} onChange={x => setN(p => ({ ...p, paid: !!x }))} label="Paid" />
      <Toggle checked={n.working} onChange={x => setN(p => ({ ...p, working: !!x }))} label="Working holiday" />
      <Button icon="add" onClick={async () => {
        if (!n.date || !n.desc.trim()) { notify('Date and description are required'); return; }
        if (H.some(h => h.date === n.date)) { notify('A holiday already exists on that date'); return; }
        try {
          await window.api.createHoliday({ orgId: org, date: n.date, description: n.desc.trim(), country: n.country, region: n.region, paid: n.paid, working: n.working });
        } catch (err) {
          notify('No se pudo guardar el feriado • ' + err.message);
          return;
        }
        // The server list is the source of truth (ids included, so it can be deleted later)
        try { const list = await window.api.holidays(); A.setHolidays(Array.isArray(list) ? list : []); }
        catch (_) { notify('Feriado guardado • recarga la página para verlo'); }
        notify('Holiday added • ' + n.desc.trim());
        setN(p => ({ ...p, date: '', desc: '' }));
      }}>Add Holiday</Button>
    </div>
    <div style={{ height: 14 }} />
    <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)', marginTop: 10 }}>Paid / working are set when the holiday is created; to change them, delete it and add it again (the server has no edit for holidays yet).</div>
    <Table cols={[['Date'], ['Description'], ['Country'], ['Region'], ['Paid', 'center'], ['Working holiday', 'center'], ['', 'right']]} empty="No holidays configured."
      rows={H.map(h => [fmt(h), h.desc, h.country || '—', h.region || '—', h.paid ? 'Yes' : 'No', h.working ? 'Yes' : 'No', <IconButton icon="delete" title="Remove" onClick={async () => {
        try {
          await window.api.deleteHoliday(h.id);
        } catch (err) {
          notify('No se pudo eliminar el feriado • ' + err.message);
          return;
        }
        A.removeHoliday(h.id);
        notify('Holiday removed • ' + h.desc);
      }} />])} />
  </Card>;
}
function AttReports({ f, notify }) {
  const [rep, setRep] = React.useState('daily'); const [rng, setRng] = React.useState(RANGE_KEYS[0]);
  const R = RANGES[rng];
  const E = EMPLOYEES.filter(match(f)), days = A.range(R[0], R[1]).filter(d => A.dow(d) % 6);
  const per = e => { const L = days.map(d => A.day(e.id, d)); const c = s => L.filter(x => x.status === s).length; const sched = L.filter(x => !['Holiday', 'Vacation', 'Sick', 'Not Started'].includes(x.status)).length; const pres = L.filter(x => ['Present', 'Late', 'Remote', 'Training', 'Business Trip', 'Pending Review'].includes(x.status)).length; return { L, c, sched, pres, pct: sched ? pres / sched * 100 : null, hrs: L.reduce((s, x) => s + x.hours, 0), ex: L.flatMap(x => x.exceptions) }; };
  const P = E.map(e => ({ e, ...per(e) }));
  const REPS = { daily: 'Daily Attendance', monthly: 'Monthly Attendance', late: 'Late Employees', absence: 'Days Without Record', pct: 'Attendance %', ot: 'Overtime by Attendance', missing: 'Missing Punches', dept: 'Attendance by Department' };
  const n1 = x => (Math.round(x * 10) / 10).toFixed(1);
  let cols = [], rows = [], total = null;
  if (rep === 'daily') { cols = [['Employee'], ['Status'], ['Clock In'], ['Lunch'], ['Clock Out'], ['Hours', 'num'], ['Exception'], ['Supervisor']]; rows = A.daily(f.d, match(f)).map(x => [x.name, x.status, x.punches.in || '—', lunchTxt(x.punches), x.punches.out || (x.inProgress ? 'In progress' : '—'), n1(x.hours), x.exceptions.map(y => y.label).join('; ') || '—', x.sup]); }
  if (rep === 'monthly') { cols = [['Employee'], ['Present', 'num'], ['Late', 'num'], ['No record', 'num'], ['Leave', 'num'], ['Remote', 'num'], ['Hours', 'num']]; rows = P.map(p => [p.e.name, String(p.pres), String(p.c('Late')), String(p.c('No Record')), String(p.c('Vacation') + p.c('Sick')), String(p.c('Remote')), n1(p.hrs)]); }
  if (rep === 'late') { const lt = P.map(p => ({ p, l: p.ex.filter(x => x.type === 'late') })).filter(x => x.l.length); cols = [['Employee'], ['Department'], ['Late days', 'num'], ['Avg minutes late', 'num'], ['Worst', 'num']]; rows = lt.map(({ p, l }) => { const m = l.map(x => parseInt(x.label.split('• ')[1])); return [p.e.name, p.e.dept, String(l.length), n1(m.reduce((s, x) => s + x, 0) / m.length), Math.max(...m) + ' min']; }); }
  if (rep === 'absence') { cols = [['Employee'], ['Days without record', 'num'], ['Vacation', 'num'], ['Sick', 'num'], ['Holidays', 'num']]; rows = P.map(p => [p.e.name, String(p.c('No Record')), String(p.c('Vacation')), String(p.c('Sick')), String(p.c('Holiday'))]); }
  if (rep === 'pct') { cols = [['Employee'], ['Scheduled days', 'num'], ['Days present', 'num'], ['Attendance %', 'num']]; rows = P.map(p => [p.e.name, String(p.sched), String(p.pres), p.pct == null ? '—' : n1(p.pct) + '%']); total = ['Total', String(P.reduce((s, p) => s + p.sched, 0)), String(P.reduce((s, p) => s + p.pres, 0)), n1(P.reduce((s, p) => s + p.pres, 0) / Math.max(1, P.reduce((s, p) => s + p.sched, 0)) * 100) + '%']; }
  if (rep === 'ot') { cols = [['Employee'], ['Days with OT', 'num'], ['OT hours (daily > ' + A.rules.shift + 'h)', 'num'], ['Hours worked', 'num']]; rows = P.map(p => { const o = p.ex.filter(x => x.type === 'overtime'); return [p.e.name, String(o.length), n1(o.reduce((s, x) => s + parseFloat(x.label.split('• ')[1]), 0)), n1(p.hrs)]; }).filter(r => r[1] !== '0'); }
  if (rep === 'missing') { cols = [['Employee'], ['Date'], ['Missing'], ['Status']]; rows = P.flatMap(p => p.ex.filter(x => /missing/.test(x.type)).map(x => [p.e.name, x.date, x.label, x.status])); }
  if (rep === 'dept') { const G = {}; P.forEach(p => { (G[p.e.dept] = G[p.e.dept] || []).push(p); }); cols = [['Department'], ['Employees', 'num'], ['Attendance %', 'num'], ['Late', 'num'], ['No record', 'num']]; rows = Object.entries(G).map(([d, l]) => [d, String(l.length), n1(l.reduce((s, p) => s + p.pres, 0) / Math.max(1, l.reduce((s, p) => s + p.sched, 0)) * 100) + '%', String(l.reduce((s, p) => s + p.c('Late'), 0)), String(l.reduce((s, p) => s + p.c('No Record'), 0))]); }
  const sub = (rep === 'daily' ? fmtD(f.d) : rng) + ' • My Global Hub (Dominicana SRL)';
  const ex = kind => notify(window.__mghExport ? window.__mghExport(kind, REPS[rep], sub, { cols, rows, total }) : 'Export unavailable');
  return <Card padding={20}>
    <FilterChips value={rep} onChange={setRep} options={Object.entries(REPS).map(([k2, l]) => ({ value: k2, label: l }))} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '14px 0 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="mgh-h3">{REPS[rep]}</span><Badge size="sm" tone="neutral">{rows.length} rows</Badge>{rep !== 'daily' && <Select size="sm" icon="date_range" value={rng} onChange={x => setRng(v(x))} options={RANGE_KEYS} />}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[['pdf', 'PDF', 'picture_as_pdf'], ['xls', 'Excel', 'table_view'], ['csv', 'CSV', 'csv'], ['print', 'Print', 'print']].map(([k2, l, ic]) => <Button key={k2} size="sm" variant={k2 === 'print' ? 'dark' : 'secondary'} icon={ic} style={MGH_RBAC.can('reports.export') ? undefined : { display: 'none' }} disabled={!rows.length} onClick={() => ex(k2)}>{l}</Button>)}</div>
    </div>
    <Table cols={cols.map(c => [c[0], c[1] === 'num' ? 'right' : 'left'])} rows={(total ? [...rows, total] : rows).map(r => r.map((x, j) => cols[j][0] === 'Status' && A.STATUS_COLOR[x] ? <Pill status={x} /> : x))} />
  </Card>;
}
function Rules({ notify }) {
  const ORGS = [...new Set(EMPLOYEES.map(e => e.entity))].sort();
  const [org, setOrg] = React.useState('*'); const [d, setD] = React.useState(A.rulesFor('*'));
  const pick = x => { const o = v(x); setOrg(o); setD(A.rulesFor(o)); };
  const num = (k, l, min, max, unit) => <TextField label={l + ' (' + unit + ')'} type="number" value={String(d[k])} onChange={x => setD(p => ({ ...p, [k]: v(x) }))} />;
  const save = () => { const n = { start: d.start, shift: +d.shift, grace: +d.grace, maxLate: +d.maxLate, minLunch: +d.minLunch, maxHours: +d.maxHours, autoLunch: !!d.autoLunch, flexible: !!d.flexible };
    if (!/^\d{2}:\d{2}$/.test(n.start) || !(n.shift > 0 && n.shift <= 16) || !(n.grace >= 0 && n.grace <= 60) || !(n.maxLate >= n.grace) || !(n.minLunch >= 0 && n.minLunch <= 120) || !(n.maxHours >= n.shift && n.maxHours <= 24)) { notify('Check the values: shift 1–16h, grace 0–60 min, max late ≥ grace, lunch 0–120 min, max hours ≥ shift'); return; }
    A.setRules(n, org); notify((org === '*' ? 'Default rules' : org) + ' • rules saved • statuses and exceptions recalculated'); };
  return <Card icon="rule" title="Attendance rules" subtitle="Per organization • applied to statuses, exceptions and hours" actions={<>{org !== '*' && A.hasOverride(org) && <Button variant="ghost" icon="restart_alt" onClick={() => { A.clearRules(org); setD(A.rulesFor(org)); notify(org + ' • now uses default rules'); }}>Use default</Button>}<Button icon="save" onClick={save}>Save rules</Button></>}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
      <Select icon="domain" value={org} onChange={pick} options={[{ value: '*', label: 'Default (all organizations)' }, ...ORGS.map(o => ({ value: o, label: o + (A.hasOverride(o) ? ' • custom' : ' • default') }))]} />
      <span className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>{org === '*' ? 'Applies to every organization without custom rules.' : A.hasOverride(org) ? 'Custom rules for this organization.' : 'Inherits the default rules until you save.'}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 14 }}>
      <TextField label="Shift start" type="time" value={d.start} onChange={x => setD(p => ({ ...p, start: v(x) }))} />
      {num('shift', 'Shift duration', 1, 16, 'h')}{num('grace', 'Grace period', 0, 60, 'min')}{num('maxLate', 'Max late minutes', 0, 120, 'min')}{num('minLunch', 'Minimum lunch', 0, 120, 'min')}{num('maxHours', 'Maximum hours per day', 1, 24, 'h')}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
      <Toggle checked={!!d.autoLunch} onChange={() => setD(p => ({ ...p, autoLunch: !p.autoLunch }))} label="Automatic lunch deduction" description={'Deduct ' + d.minLunch + ' min when no lunch is punched and the day exceeds 6h'} />
      <Toggle checked={!!d.flexible} onChange={() => setD(p => ({ ...p, flexible: !p.flexible }))} label="Flexible schedule" description="No late / early flags; only short days (under the shift duration) are flagged" />
    </div>
  </Card>;
}
function Attendance({ route, go, notify, empId }) {
  useATT();
  const [f, setRaw] = React.useState(SHARED);
  const setF = u => setRaw(p => { SHARED = typeof u === 'function' ? u(p) : u; return SHARED; });
  const sub = SUBS.find(s => s[0] === route) || SUBS[0];
  const showFilters = !['attLeave', 'attHolidays', 'attRules', 'actDaily'].includes(sub[0]);
  return <Page>
    <PageHeader breadcrumbs={['Attendance', sub[1]]} title={sub[0] === 'attendance' ? 'Attendance Dashboard' : sub[1]} description="Single source for punches, daily status, exceptions and leave • feeds My Time Entry, timesheets, payroll and reports." status={<Badge tone="primary">{fmtD(f.d)} • {A.rules.flexible ? 'Flexible schedule' : 'Shift ' + A.rules.start + ' • ' + A.rules.shift + 'h • grace ' + A.rules.grace + ' min'}</Badge>} />
    <Tabs value={sub[0]} onChange={go} tabs={SUBS.filter(s => MGH_RBAC.canRoute(s[0])).map(s => ({ value: s[0], label: s[1] }))} />
    {showFilters && <Filters f={f} setF={setF} withDate={['attendance', 'attDaily', 'attCalendar'].includes(sub[0]) || (sub[0] === 'attReports')} />}
    {sub[0] === 'attendance' && <Dashboard f={f} setF={setF} go={go} />}
    {sub[0] === 'attDaily' && <Daily f={f} go={go} notify={notify} />}
    {sub[0] === 'actDaily' && <DailyActivities f={f} setF={setF} go={go} notify={notify} empId={empId} />}
    {sub[0] === 'attCalendar' && <Calendar f={f} setF={setF} go={go} />}
    {sub[0] === 'attExceptions' && <Exceptions f={f} notify={notify} />}
    {sub[0] === 'attLeave' && <Leave notify={notify} />}
    {sub[0] === 'attHolidays' && <Holidays notify={notify} />}
    {sub[0] === 'attReports' && <AttReports f={f} notify={notify} />}
    {sub[0] === 'attRules' && <Rules notify={notify} />}
  </Page>;
}
function Permissions() {
  useATT();
  const R = MGH_RBAC, cur = R.role, mods = [...new Set(Object.values(R.MATRIX).map(m => m.module))];
  const th = { padding: '10px 10px', background: 'var(--mgh-surface-1)', font: '700 11px/14px var(--font-sans)', letterSpacing: '0.55px', textTransform: 'uppercase', color: 'var(--mgh-ink-2)', whiteSpace: 'nowrap', position: 'sticky', top: 0 };
  const cell = v => v ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, font: '700 11px/16px var(--font-sans)', color: v === 'global' ? 'var(--mgh-success)' : 'var(--mgh-primary)', whiteSpace: 'nowrap' }}><Icon name="check" size={14} />{R.SCOPE_LABEL[v]}</span> : <Icon name="close" size={14} color="var(--mgh-ink-4)" />;
  const routes = Object.entries(R.ROUTES).filter(([r]) => r !== 'login');
  return <Page>
    <PageHeader breadcrumbs={['System / Administration', 'Roles & Permissions']} title="Roles & Permissions" description="Central permission matrix. Menus, routes, buttons and engines call can(permission, record) — the record must be inside the role's scope and the active organization." status={<Badge tone="primary">{R.me().person} • {cur} • {R.org}</Badge>} />
    <Card padding={0}><div className="mgh-scroll" style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
      <thead><tr><th style={{ ...th, textAlign: 'left' }}>Permission</th>{R.ROLE_IDS.map(r => <th key={r} style={{ ...th, textAlign: 'center', background: r === cur ? '#EEF0FF' : th.background, color: r === cur ? 'var(--mgh-primary)' : th.color }}>{r}</th>)}</tr></thead>
      <tbody>{mods.map(m => <React.Fragment key={m}>
        <tr><td colSpan={R.ROLE_IDS.length + 1} style={{ padding: '12px 10px 6px', font: '700 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>{m}</td></tr>
        {Object.entries(R.MATRIX).filter(([, x]) => x.module === m).map(([key, x]) => <tr key={key} style={{ borderTop: '1px solid var(--mgh-surface-2)' }}>
          <td style={{ padding: '8px 10px' }}><div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{x.label}</span><span data-i18n-skip="" style={{ font: '500 11px/14px var(--font-mono)', color: 'var(--mgh-ink-3)' }}>{key}</span></div></td>
          {R.ROLE_IDS.map(r => <td key={r} style={{ textAlign: 'center', padding: '8px 6px', background: r === cur ? '#F6F7FF' : 'transparent' }}>{cell(x.grants[r])}</td>)}
        </tr>)}
      </React.Fragment>)}</tbody></table></div></Card>
    <Card icon="route" title="Route protection" subtitle={'Current role: ' + cur + ' • ' + routes.filter(([r]) => R.canRoute(r)).length + ' of ' + routes.length + ' routes allowed • others return 403'}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 6 }}>{routes.map(([r, p]) => <div key={r} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--mgh-surface-1)' }}><span data-i18n-skip="" style={{ font: '600 12px/16px var(--font-mono)', color: 'var(--mgh-ink)' }}>#{r}</span><span data-i18n-skip="" style={{ font: '500 11px/16px var(--font-mono)', color: R.canRoute(r) ? 'var(--mgh-success)' : 'var(--mgh-danger)', textAlign: 'right' }}>{R.canRoute(r) ? 'OK • ' : '403 • '}{p.join(' | ')}</span></div>)}</div>
    </Card>
    <Card icon="domain" title="Memberships" subtitle="Active authenticated user organization & permissions">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '8px 0' }}>
          <span style={{ font: '600 13px/18px var(--font-sans)' }}>{R.me().person} ({R.me().title || cur})</span>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(R.me().memberships || {}).map(([o, r]) => <Badge key={o} size="sm" tone="primary">{o} • {r}</Badge>)}
          </span>
        </div>
      </div>
    </Card>
  </Page>;
}
function Operations({ go, notify }) {
  useLeaveSync();
  useATT();
  const R = MGH_RBAC, W = window.MGH_WF, [tick, setTick] = React.useState(Date.now());
  React.useEffect(() => { const t = setInterval(() => setTick(Date.now()), 15000); return () => clearInterval(t); }, []);
  // Live checks against the backend (null = still checking, false = failed)
  const [hApi, setHApi] = React.useState(null), [hJira, setHJira] = React.useState(null);
  React.useEffect(() => {
    let cancel = false;
    window.api.health().then(r => { if (!cancel) setHApi(r || false); }).catch(() => { if (!cancel) setHApi(false); });
    window.api.jiraStatus().then(r => { if (!cancel) setHJira(r || false); }).catch(() => { if (!cancel) setHJira(false); });
    return () => { cancel = true; };
  }, []);
  const E = EMPLOYEES.filter(e => R.canAny(['timesheets.view', 'timesheets.approve', 'payroll.generate'], e));
  const recs = W ? W.all().filter(r => E.some(e => e.id === r.emp)) : [];
  const inReview = recs.filter(r => /Review|Submitted/.test(r.status)), toPay = recs.filter(r => r.status === 'Approved'), returned = recs.filter(r => r.status === 'Returned');
  const age = r => { const h = r.history.slice(-1)[0]; return h ? (Date.now() - new Date(h.at)) / 36e5 : 0; };
  const stale = inReview.filter(r => age(r) > 48);
  const y = A.addD(A.TODAY, -1), ex = A.exceptions(y, A.TODAY).filter(x => E.some(e => e.id === x.emp) && !['Approved', 'Corrected', 'Closed'].includes(x.status));
  const missOut = ex.filter(x => x.type === 'missing_out'), today = A.summary(A.TODAY, e => E.some(x => x.id === e.id));
  const noSup = E.filter(e => !e.mgr || e.mgr === '—'), leavePend = A.leave().filter(l => /Pending/.test(l.status) && E.some(e => e.id === l.emp));
  const kp = [
    ['Timesheets in review', inReview.length, 'pending_actions', 'warning', 'queue'], ['Ready for payroll', toPay.length, 'payments', 'primary', 'approvals'],
    ['Attendance exceptions', ex.length, 'report', ex.length ? 'danger' : 'success', 'attExceptions'], ['Missing clock-out', missOut.length, 'timer_off', missOut.length ? 'danger' : 'success', 'attExceptions'],
    ['Blocked approvals', stale.length + returned.length, 'block', stale.length + returned.length ? 'danger' : 'success', 'queue'], ['Attendance today', today.pct == null ? '—' : today.pct + '%', 'how_to_reg', today.pct == null ? 'neutral' : today.pct >= 90 ? 'success' : 'warning', 'attendance']];
  const alerts = [
    ...stale.map(r => ['high', 'Timesheet waiting > 48h at ' + r.status, r.name + ' • ' + r.period, () => go('approvals', r.emp)]),
    ...returned.map(r => ['medium', 'Returned for corrections', r.name + ' • ' + r.period + ' • ' + ((r.history.slice(-1)[0] || {}).comment || ''), () => go('approvals', r.emp)]),
    ...(toPay.length ? [['medium', toPay.length + ' approved timesheet(s) not yet paid', 'Payroll must generate pay stubs', () => go('approvals')]] : []),
    ...missOut.map(x => ['high', 'Missing clock-out', x.name + ' • ' + fmtD(x.date), () => go('attExceptions')]),
    ...noSup.map(e => ['medium', 'Employee without supervisor', e.name + ' • ' + e.id, () => go('profile', e.id)]),
    ...leavePend.map(l => ['low', 'Leave request pending', l.name + ' • ' + l.type + ' • ' + l.status, () => go('attLeave')]),
  ].filter(a => R.canRoute(a[3] ? 'queue' : 'queue') || true);
  const sevTone = { high: 'danger', medium: 'warning', low: 'neutral' };
  const health = [
    ['Jira Cloud', hJira == null ? 'Checking…' : hJira && hJira.connection && hJira.connection.ok ? 'Connected' : 'Not connected' + (hJira && hJira.connection && hJira.connection.message ? ' • ' + hJira.connection.message : ''), hJira == null ? 'ink-4' : hJira && hJira.connection && hJira.connection.ok ? 'success' : 'danger', 'jira'],
    ['Back-end', hApi == null ? 'Checking…' : hApi && hApi.status === 'ok' ? 'Connected • ' + (hApi.dialect || 'database') : 'Unreachable', hApi == null ? 'ink-4' : hApi && hApi.status === 'ok' ? 'success' : 'danger', null],
    ['Exports', 'PDF / Excel / CSV / Print (generated in the browser)', 'success', 'reports'],
    ['Workflow', (W ? ['Employee', ...W.steps().map(s => s.label), 'Paid'].join(' → ') : '—'), 'success', 'workflows']];
  const quick = [['fact_check', 'Approve Pending', 'queue'], ['play_circle', 'Run Payroll', 'processing'], ['person_add', 'Create Employee', 'addEmployee'], ['report', 'Attendance Exceptions', 'attExceptions'], ['download', 'Export Reports', 'reports'], ['beach_access', 'Leave Requests', 'attLeave']].filter(q => R.canRoute(q[2]));
  const feed = (W ? W.audit() : []).slice(0, 14);
  const ago = iso => { const m = Math.max(0, Math.round((tick - new Date(iso)) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
  return <Page>
    <PageHeader breadcrumbs={['Overview', 'Operations Center']} title="Operations Center" description={<span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}><span>Daily operation in one place</span><span>•</span><span data-i18n-skip="">{R.org}</span><span>•</span><span>{E.length + ' people in your scope'}</span><span>•</span><span>Every figure links to its source record.</span></span>} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 14 }}>{kp.map(([l, v, ic, t, r]) => <div key={l} role="button" title={'Open ' + l} onClick={() => R.canRoute(r) ? go(r) : notify('No access to ' + l)} style={{ cursor: 'pointer', borderRadius: 12 }}><StatCard label={l} value={String(v)} icon={ic} tone={t} style={{ minHeight: 0 }} /></div>)}</div>
    {quick.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{quick.map(([ic, l, r]) => <Button key={l} variant="secondary" icon={ic} onClick={() => go(r)}>{l}</Button>)}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', gap: 20, alignItems: 'start' }}>
      <Card icon="notification_important" title="Alerts" subtitle={alerts.length + ' open • sorted by severity'}>
        {alerts.length ? <div style={{ display: 'flex', flexDirection: 'column' }}>{alerts.sort((a, b) => ['high', 'medium', 'low'].indexOf(a[0]) - ['high', 'medium', 'low'].indexOf(b[0])).slice(0, 12).map((a, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--mgh-surface-2)' }}><Badge size="sm" tone={sevTone[a[0]]}>{a[0]}</Badge><div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{a[1]}</span><span style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a[2]}</span></div><Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={a[3]}>Open record</Button></div>)}</div> : <span className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>No open alerts in your scope.</span>}
      </Card>
      <Card icon="monitor_heart" title="System health" subtitle="Integrations and platform services">
        <div style={{ display: 'flex', flexDirection: 'column' }}>{health.map(([n, st, t, r]) => <div key={n} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--mgh-surface-2)' }}><span style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{n}</span><span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)' }}><span style={{ width: 8, height: 8, borderRadius: 9999, flex: 'none', background: 'var(--mgh-' + t + ')' }} />{st}</span>{r && R.canRoute(r) ? <IconButton icon="arrow_forward" title={'Open ' + n} onClick={() => go(r)} /> : <span />}</div>)}</div>
      </Card>
      <Card icon="history" title="Audit log • live" subtitle={feed.length ? 'Latest ' + feed.length + ' events in ' + R.org : 'No events yet'} actions={R.canRoute('audit') && <Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={() => go('audit')}>Audit Logs</Button>}>
        {feed.length ? <div style={{ display: 'flex', flexDirection: 'column' }}>{feed.map((a, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0,1fr)', gap: 10, padding: '7px 0', borderTop: '1px solid var(--mgh-surface-2)' }}><span style={{ font: '600 11px/16px var(--font-mono)', color: 'var(--mgh-ink-3)' }}>{ago(a.at)}</span><div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span data-i18n-skip="" style={{ font: '600 12px/16px var(--font-mono)', color: 'var(--mgh-ink)' }}>{a.action}</span><span style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.actor} • {a.target}</span></div></div>)}</div> : <span className="mgh-body" style={{ color: 'var(--mgh-ink-3)' }}>Actions (approvals, corrections, leave, configuration) appear here as they happen.</span>}
      </Card>
    </div>
  </Page>;
}
function Page({ children }) { return <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600 }}>{children}</div>; }
const mk = r => props => <Attendance {...props} route={r} />;
window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, Object.fromEntries(SUBS.map(s => [s[0], mk(s[0])])), { permissions: Permissions, ops: Operations });
})();

class ViewBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error('[view]', this.props.route, err); }
  render() {
    if (!this.state.err) return this.props.children;
    return <div style={{ padding: 28 }}><div style={{ border: '1px solid var(--mgh-danger, #ba1a1a)', borderRadius: 12, padding: 20, background: '#fff5f5' }}><div style={{ font: '700 16px var(--font-sans)', marginBottom: 6 }}>This view could not be displayed</div><div style={{ font: '400 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>{String(this.state.err && this.state.err.message || this.state.err)}</div></div></div>;
  }
}

function KitScreen({ route, go, notify, empId, currentUser, openRoleModal, onReloadData }) {
  if (currentUser) {
    window.__mghCurrentUser = currentUser;
  }
  const fix = v => {
    if (typeof v !== 'string') return v;
    if (v.includes('assets/avatars/person-') || v.includes('carlos-mendez.jpg')) return null;
    return v.replace(/(\.\.\/)+assets\//g, 'assets/');
  };
  const prevEmps = window.EMPLOYEES;
  Object.assign(window, window.__MGH_DATA || {}); // DS bundle also defines these globals — keep the kit's versions
  if (prevEmps && prevEmps.length > 0) {
    window.EMPLOYEES = prevEmps;
  }
  window.AVATARS = 'assets/avatars/'; window.__mghGo = go; window.__mghNotify = notify;
  const curUser = currentUser || window.__mghCurrentUser || (window.MGH_AUTH && window.MGH_AUTH.user);
  (window.EMPLOYEES || []).forEach(e => {
    const isCur = curUser && (
      curUser.employeeId === e.id ||
      curUser.employee_id === e.id ||
      curUser.id === e.id ||
      (curUser.email && e.email && curUser.email.toLowerCase() === e.email.toLowerCase()) ||
      (e.name && curUser.name && curUser.name.toLowerCase() === e.name.toLowerCase())
    );
    if (isCur && curUser.avatar) {
      e.avatar = curUser.avatar;
    } else {
      e.avatar = fix(e.avatar);
    }
  });
  const K = window.__MGH_KIT || {}; const S = K[route] || K.dashboard;
  return (
    <div style={{ background: '#fff', minHeight: '100%' }}>
      <ViewBoundary route={route} key={'b|' + route + '|' + (window.MGH_RBAC ? MGH_RBAC.org : '')}>
      <S
        key={(window.MGH_RBAC ? MGH_RBAC.org + '|' + MGH_RBAC.persona : '') + '|' + route}
        go={go}
        notify={notify}
        empId={empId}
        currentUser={currentUser}
        openRoleModal={openRoleModal}
        onReloadData={onReloadData}
      />
      </ViewBoundary>
    </div>
  );
}
export { KitScreen };
