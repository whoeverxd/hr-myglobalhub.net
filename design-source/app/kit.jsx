// Bundled from the My Global Hub design-system UI kit (ui_kits/enterprise). Each file is scoped; globals are shared via window.

// ---- data.jsx ----
(function(){
// Sample data for the My Global Hub enterprise kit (names/values follow the Figma file's sample content)
const A = 'assets/avatars/';
const EMPLOYEES = [
  { id: 'MGH-1042', name: 'Carlos Mendez', role: 'Sr. Full Stack Developer', dept: 'Engineering', type: 'Contractor / Exempt', entity: 'MGH Dominicana SRL', loc: 'Punta Cana, DR', mgr: 'Elena Rostova', project: 'Atlas Core', rate: 52.5, reg: 80, ot: 6.5, pto: 0, match: 98.2, status: 'Awaiting PM', avatar: A + 'carlos-mendez.jpg', bank: 'Banco BHD León', joined: 'Jan 15, 2023' },
  { id: 'MGH-1088', name: 'Sofia Almonte', role: 'UI/UX Architect', dept: 'Product', type: 'Full-time', entity: 'MGH Dominicana SRL', loc: 'Santo Domingo, DR', mgr: 'Marcus Vance', project: 'Global Hub v3', rate: 44.5, reg: 80, ot: 0, pto: 8, match: 100, status: 'Awaiting Supervisor', bank: 'Banco Popular', joined: 'Mar 02, 2022' },
  { id: 'MGH-1102', name: 'David Wu', role: 'DevOps Engineer', dept: 'Infrastructure', type: 'Full-time', entity: 'MGH USA Inc.', loc: 'Austin, TX', mgr: 'Elena Rostova', project: 'Perf Infra', rate: 55.5, reg: 80, ot: 12, pto: 0, match: 92, status: 'Flagged OT', bank: 'Chase Bank USA', joined: 'Aug 21, 2021' },
  { id: 'MGH-0975', name: 'Mariana Reyes', role: 'QA Automation Lead', dept: 'Quality', type: 'Full-time', entity: 'MGH Dominicana SRL', loc: 'Punta Cana, DR', mgr: 'Marcus Vance', project: 'Atlas Core', rate: 46, reg: 80, ot: 0, pto: 0, match: 100, status: 'Ready', avatar: A + 'person-1.jpg', bank: 'Banco BHD León', joined: 'Nov 08, 2020' },
  { id: 'MGH-1120', name: 'Javier Peña', role: 'Backend Engineer', dept: 'Engineering', type: 'Contractor / Exempt', entity: 'MGH Dominicana SRL', loc: 'Santiago, DR', mgr: 'Elena Rostova', project: 'Atlas Core', rate: 48, reg: 76, ot: 0, pto: 4, match: 88.4, status: 'Jira Mismatch', avatar: A + 'person-2.jpg', bank: 'Banreservas', joined: 'Feb 11, 2024' },
  { id: 'MGH-1131', name: 'Priya Natarajan', role: 'Data Engineer', dept: 'Analytics', type: 'Full-time', entity: 'MGH USA Inc.', loc: 'Remote, US', mgr: 'Marcus Vance', project: 'Insights Lake', rate: 58, reg: 80, ot: 2, pto: 0, match: 99.1, status: 'Awaiting Supervisor', avatar: A + 'person-3.jpg', bank: 'Chase Bank USA', joined: 'Jun 30, 2022' },
  { id: 'MGH-1007', name: 'Luis Cabrera', role: 'Payroll Specialist', dept: 'Finance', type: 'Full-time', entity: 'MGH Dominicana SRL', loc: 'Punta Cana, DR', mgr: 'Ana Gómez', project: 'Internal Ops', rate: 32, reg: 80, ot: 0, pto: 0, match: 100, status: 'Approved', avatar: A + 'person-4.jpg', bank: 'Banco Popular', joined: 'Apr 04, 2019' },
  { id: 'MGH-1144', name: 'Hannah Kim', role: 'Frontend Engineer', dept: 'Engineering', type: 'Part-time', entity: 'MGH USA Inc.', loc: 'Seattle, WA', mgr: 'Elena Rostova', project: 'Global Hub v3', rate: 50, reg: 40, ot: 0, pto: 0, match: 97.6, status: 'Approved', bank: 'Wells Fargo', joined: 'Sep 12, 2024' },
  { id: 'MGH-1059', name: 'Rafael Ortiz', role: 'Site Reliability Eng.', dept: 'Infrastructure', type: 'Full-time', entity: 'MGH Dominicana SRL', loc: 'Punta Cana, DR', mgr: 'Elena Rostova', project: 'Perf Infra', rate: 51, reg: 80, ot: 9.5, pto: 0, match: 94.3, status: 'Flagged OT', bank: 'Banco BHD León', joined: 'Jan 09, 2021' },
  { id: 'MGH-1150', name: 'Grace Okafor', role: 'Product Manager', dept: 'Product', type: 'Full-time', entity: 'MGH UK Ltd.', loc: 'London, UK', mgr: 'Marcus Vance', project: 'Global Hub v3', rate: 62, reg: 72, ot: 0, pto: 8, match: 100, status: 'Ready', bank: 'Barclays', joined: 'May 17, 2023' },
  { id: 'MGH-1013', name: 'Tomás Vidal', role: 'Security Analyst', dept: 'Security', type: 'Full-time', entity: 'MGH Dominicana SRL', loc: 'Santo Domingo, DR', mgr: 'Ana Gómez', project: 'Internal Ops', rate: 47, reg: 80, ot: 0, pto: 0, match: 100, status: 'Approved', bank: 'Banreservas', joined: 'Jul 23, 2020' },
  { id: 'MGH-1162', name: 'Elif Demir', role: 'ML Engineer', dept: 'Analytics', type: 'Contractor / Exempt', entity: 'MGH UK Ltd.', loc: 'Remote, EU', mgr: 'Marcus Vance', project: 'Insights Lake', rate: 64, reg: 80, ot: 4, pto: 0, match: 91.2, status: 'Jira Mismatch', bank: 'Revolut Business', joined: 'Oct 01, 2024' },
];
EMPLOYEES.forEach(e => { e.total = e.reg + e.ot + e.pto; e.gross = +(e.reg * e.rate + e.ot * e.rate * 1.5 + e.pto * e.rate).toFixed(2);
  e.tax = e.tax || (e.type === 'Contractor / Exempt' ? 'Exempt — not subject to tax deductions' : /USA/.test(e.entity) ? 'W-4 (US Federal)' : /UK/.test(e.entity) ? 'PAYE (HMRC)' : 'DGII (ISR + TSS)'); });
// Payroll deduction engine — reads each employee's tax profile; Exempt short-circuits all withholdings
const DEDUCT = e => {
  const g = e.gross, N = 26, br = (a, b) => { let x = 0, p = 0; for (const [cap, r] of b) { if (a <= p) break; x += (Math.min(a, cap) - p) * r; p = cap; } return x; };
  if (/^Exempt/.test(e.tax)) return { exempt: true, lines: [], total: 0, net: g };
  let lines = [];
  if (/DGII/.test(e.tax)) { const afp = g * 0.0287, sfs = g * 0.0304, fx = 60.5, ad = (g - afp - sfs) * N * fx; lines = [['ISR withholding', br(ad, [[416220, 0], [624329, .15], [867123, .20], [Infinity, .25]]) / N / fx], ['TSS — SFS (3.04%)', sfs], ['TSS — AFP (2.87%)', afp]]; }
  else if (/W-4/.test(e.tax)) { const A = g * N; lines = [['Federal income tax', Math.max(0, br(A - 14600, [[11600, .10], [47150, .12], [100525, .22], [191950, .24], [Infinity, .32]]) / N)], ['Social Security (6.2%)', g * 0.062], ['Medicare (1.45%)', g * 0.0145]]; }
  else if (/PAYE/.test(e.tax)) { const t = Math.max(0, g * N - 12570); lines = [['PAYE income tax', br(t, [[37700, .20], [112570, .40], [Infinity, .45]]) / N], ['National Insurance', br(t, [[37700, .08], [Infinity, .02]]) / N]]; }
  lines = lines.map(([l, v]) => [l, +v.toFixed(2)]);
  const total = lines.reduce((s, d) => s + d[1], 0);
  return { exempt: false, lines, total, net: g - total };
};

const STATUS_TONE = { 'Awaiting PM': 'warning', 'Awaiting Supervisor': 'warning', 'Flagged OT': 'danger', 'Jira Mismatch': 'danger', 'Ready': 'success', 'Approved': 'success', 'Returned': 'danger', 'Draft': 'neutral' };

const NAV = [
  { label: 'Overview', items: [{ key: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' }] },
  { label: 'Workforce', items: [
    { key: 'approvals', label: 'Approval Workspace', icon: 'assignment_turned_in', badge: '12 Pending' },
    { key: 'queue', label: 'Team Approval Queue', icon: 'fact_check' },
    { key: 'timesheets', label: 'Bi-Weekly Timesheets', icon: 'more_time' },
    { key: 'employees', label: 'Employees', icon: 'badge' } ] },
  { label: 'Payroll & Finance', items: [
    { key: 'payroll', label: 'Payroll Dashboard', icon: 'monitoring' },
    { key: 'processing', label: 'Payroll Processing', icon: 'payments' },
    { key: 'paystub', label: 'Pay Stubs', icon: 'receipt_long' },
    { key: 'banking', label: 'Banking & Allocations', icon: 'account_balance' } ] },
  { label: 'Integrations', items: [
    { key: 'jira', label: 'Jira Cloud Sync', icon: 'sync_alt', badge: '2m', badgeTone: 'onDarkSuccess' },
    { key: 'projects', label: 'Projects', icon: 'folder_open' } ] },
  { label: 'Insights', items: [{ key: 'reports', label: 'Reports & Register', icon: 'bar_chart' }] },
  { label: 'System', items: [
    { key: 'admin', label: 'Administration', icon: 'admin_panel_settings' },
    { key: 'settings', label: 'Company Settings', icon: 'tune' },
    { key: 'audit', label: 'Audit Log', icon: 'shield_lock' } ] },
];

const JIRA = ['ATLAS-412 GraphQL API Optimization', 'ATLAS-420 Hotfix: Redis Cluster Failover', 'CORE-108 Database Sharding Pipeline', 'ATLAS-412 Client Review & Profiling', 'ATLAS-415 Auth Microservice Integration', 'CORE-111 Billing Event Stream', 'ATLAS-398 Sprint 24 Release Prep'];
// 14-day period Mon Mar 31 – Sun Apr 13 (PP-2025-08 work days)
function buildDays(emp) {
  const out = []; const start = new Date(2025, 2, 31);
  const otDays = { 3: 1.5, 8: 2.0, 11: 3.0 };
  for (let i = 0; i < 14; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const wd = d.getDay(); const weekend = wd === 0 || wd === 6;
    const ot = !weekend && emp.ot ? (otDays[i] || 0) * (emp.ot / 6.5) : 0;
    const hrs = weekend ? 0 : 8 + ot;
    const issue = JIRA[i % JIRA.length]; const [key, ...t] = issue.split(' ');
    const jira = weekend ? 0 : (i === 8 && emp.match < 99 ? hrs - 0.5 : hrs);
    out.push({ id: i, week: i < 7 ? 1 : 2, date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }), weekend,
      inn: weekend ? '—' : (i % 3 === 2 ? '08:45' : '08:30'), out: weekend ? '—' : (ot ? `${String(16 + Math.ceil(ot) + 1).padStart(2, '0')}:${ot % 1 ? '00' : '30'}` : '17:30'),
      hrs: +hrs.toFixed(1), ot: +ot.toFixed(1), key: weekend ? null : key, task: t.join(' '), jira: +jira.toFixed(1), note: ot ? 'Overtime Authorized' : weekend ? 'Weekend' : 'Standard Day' });
  }
  return out;
}
const fmt$ = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtH = n => n.toFixed(1) + 'h';

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

Object.assign(window, { EMPLOYEES, DEDUCT, STATUS_TONE, NAV, buildDays, fmt$, fmtH, useTable, AVATARS: A });

})();

// ---- Shell.jsx ----
(function(){
const DS = window.MyGlobalHubDesignSystem_2a603d;

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

function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 120, background: 'var(--mgh-navy)', color: '#fff', padding: '10px 16px', borderRadius: 12, boxShadow: 'var(--shadow-lg)', display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font-sans)' }}><DS.Icon name="check_circle" size={16} color="var(--mgh-success-300)" />{msg}</div>;
}

function EmployeeCell({ e, sub }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><DS.Avatar src={e.avatar} name={e.name} size={32} />
    <div style={{ minWidth: 0 }}><div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{e.name}</div><div style={{ font: '400 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{sub || e.role}</div></div></div>;
}

const PERIOD = { code: 'PP-2025-08', range: '(Apr 01 - Apr 14, 2025)', phase: 'Supervisor Approval Phase' };

function App() {
  const init = (location.hash || '').slice(1) || localStorage.getItem('mgh-route') || 'approvals';
  const [route, setRoute] = React.useState(init);
  const [empId, setEmpId] = React.useState('MGH-1042');
  const [toast, setToast] = React.useState('');
  const scroller = React.useRef();
  const go = (r, id) => { if (id) setEmpId(id); setRoute(r); localStorage.setItem('mgh-route', r); history.replaceState(null, '', '#' + r); if (scroller.current) scroller.current.scrollTop = 0; };
  const notify = m => { setToast(m); clearTimeout(window.__t); window.__t = setTimeout(() => setToast(''), 2400); };
  const S = window.SCREENS;
  const Screen = S[route] || S.dashboard;
  const navKey = route === 'profile' ? 'employees' : route;
  return <div style={{ display: 'flex', height: '100vh', background: 'var(--surface-app)' }}>
    <DS.Sidebar logoSrc="assets/logo-mgh.png" entity={{ name: 'My Global Hub Dominicana', sub: '(Punta Cana Operations)', tag: 'Multi-HQ' }} sections={NAV} active={navKey} onNavigate={k => go(k)}
      status={{ label: 'Jira Cloud: Active', value: '14 Syncing' }} user={{ name: 'Elena Rostova', role: 'Lead PM & Approver', avatar: AVATARS + 'elena-rostova.jpg' }} />
    <main ref={scroller} className="mgh-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#fff' }}>
      <DS.TopBar period={PERIOD} notifications={4} avatar={AVATARS + 'elena-rostova.jpg'} userName="Elena Rostova"
        actions={[{ label: 'Bulk Actions', icon: 'checklist', variant: 'secondary', onClick: () => go('queue') }, { label: 'Export Register', icon: 'download', variant: 'dark', onClick: () => notify('Payroll register export queued (XLSX)') }]} />
      <Screen go={go} empId={empId} notify={notify} />
    </main>
    <Toast msg={toast} />
  </div>;
}

Object.assign(window, { DS, Page, Grid, BarChart, Modal, EmployeeCell, PERIOD, App, SCREENS: window.SCREENS || {} });

})();

// ---- ScreensApprovals.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, Checkbox, FilterChips, SearchField, StatCard, MetricTile, DataTable, TableToolbar, Pagination, Stepper, ActivityFeed, Tabs, PageHeader, Select, ProgressBar } = window.MyGlobalHubDesignSystem_2a603d;

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
      <Badge size="sm" dot tone={e.match >= 98 ? 'success' : 'warning'}>{e.match}%</Badge>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: active ? '#fff' : 'var(--mgh-surface-1)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
      {[['Reg', e.reg], ['OT', e.ot, e.ot > 8 ? 'var(--mgh-danger)' : e.ot ? 'var(--mgh-warning)' : null], ['PTO', e.pto, e.pto ? 'var(--mgh-success)' : null], ['Total', e.total]].map(([l, v, c]) => <div key={l}><div style={{ font: '500 11px/14px var(--font-sans)', color: c || 'var(--mgh-ink-3)' }}>{l}</div><div style={{ font: '700 13px/18px var(--font-sans)', color: c || 'var(--mgh-ink)' }}>{v.toFixed(1)}h</div></div>)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Badge size="sm" tone={tone} icon={tone === 'danger' ? 'warning' : tone === 'success' ? 'task_alt' : 'hourglass_top'}>{e.status}</Badge><span style={{ font: '700 12px var(--font-sans)', color: 'var(--mgh-ink)' }}>{fmt$(e.gross)} Est.</span></div>
  </div>;
}

function SectionHead({ icon, title, sub, right }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
    <div style={{ display: 'flex', gap: 8 }}>{icon && <Icon name={icon} size={18} color="var(--mgh-primary)" style={{ marginTop: 3 }} />}<div><div className="mgh-h3">{title}</div>{sub && <div style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{sub}</div>}</div></div>{right}</div>;
}

function ApprovalWorkspace({ notify, empId }) {
  const [list, setList] = React.useState(() => EMPLOYEES.filter(e => e.status !== 'Approved').map(e => ({ ...e })));
  const [cur, setCur] = React.useState(list.find(e => e.id === empId) ? empId : list[0].id);
  const [filter, setFilter] = React.useState('all'); const [q, setQ] = React.useState(''); const [sel, setSel] = React.useState([]);
  const [week, setWeek] = React.useState('all'); const [sign, setSign] = React.useState(true); const [ret, setRet] = React.useState(false); const [reason, setReason] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [comments, setComments] = React.useState([{ person: 'Marcus Vance', title: 'Supervisor Note • Marcus Vance', time: 'Apr 15, 09:32 AM', body: '"Overtime (6.5 hrs total) pre-approved for Sprint 24 release deadline and Redis server failover patch. All logged Jira tickets checked out against git commit SHAs."' }]);
  const e = list.find(x => x.id === cur) || list[0];
  const days = React.useMemo(() => buildDays(e), [e.id]);
  const shown = days.filter(d => week === 'all' || d.week === +week);
  const filtered = list.filter(x => (filter === 'all' || (filter === 'ot' && x.ot > 0) || (filter === 'jira' && x.match < 95) || (filter === 'ready' && ['Ready', 'Approved'].includes(x.status))) && (!q || (x.name + x.id + x.project).toLowerCase().includes(q.toLowerCase())));
  const jiraTotal = days.reduce((s, d) => s + d.jira, 0), clockTotal = days.reduce((s, d) => s + d.hrs, 0);
  const setStatus = (id, s) => setList(l => l.map(x => x.id === id ? { ...x, status: s } : x));
  const next = () => { const i = filtered.findIndex(x => x.id === e.id); const n = filtered[(i + 1) % filtered.length]; if (n) setCur(n.id); };
  const approve = adv => { setStatus(e.id, 'Approved'); notify(`${e.name} approved • routed to HR Review`); if (adv) next(); };
  const steps = [
    { label: 'Employee', state: 'done', status: 'Submitted', meta: 'Apr 14, 17:00' },
    { label: 'Supervisor', state: 'done', status: 'Approved', meta: 'M. Vance' },
    { label: 'Project Mgr', state: e.status === 'Approved' ? 'done' : 'current', icon: 'approval', status: e.status === 'Approved' ? 'Approved' : 'Current Step', meta: 'E. Rostova' },
    { label: 'HR Review', icon: 'badge', status: 'Pending', meta: 'Queue #3' },
    { label: 'Finance Run', icon: 'receipt_long', status: 'Pending', meta: 'Auto-Audit' },
    { label: 'Lock / Batch', icon: 'lock', status: 'Locked', meta: 'Disbursement' }];
  const otPay = e.ot * e.rate * 1.5, regPay = e.reg * e.rate, ptoPay = e.pto * e.rate;
  const calc = DEDUCT(e), ded = calc.exempt ? [['Tax deductions — Exempt', 0]] : calc.lines;
  const net = calc.net;
  const files = [['Overtime_Authorization_PP08.pdf', '218 KB', 'picture_as_pdf'], ['Redis_Failover_Incident_Report.pdf', '1.2 MB', 'picture_as_pdf'], ['Sprint24_Commit_Log.csv', '46 KB', 'table_view']];

  return <Page>
    <PageHeader breadcrumbs={['Workforce', 'Approvals', 'Pay Period 2025-08']} title="Bi-Weekly Approval Workspace"
      status={<Badge tone="success" dot>PP-2025-08 (Apr 01 - Apr 14, 2025) • Awaiting Supervisor Approval</Badge>}
      actions={<><div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 12, background: '#fff', boxShadow: 'var(--shadow-xs)' }}><Icon name="cloud_sync" size={18} color="var(--mgh-accent)" /><div><div className="mgh-label" style={{ color: 'var(--mgh-ink-2)' }}>Jira Cloud Sync</div><div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>Active • Synced 2m ago</div></div></div><Button variant="secondary" icon="tune">Approval Policy</Button></>} />
    <Grid min={220}>
      <StatCard label="Pending Approvals" value={list.filter(x => x.status !== 'Approved').length} unit="/ 86 Employees" icon="how_to_reg" progress={84} footer={<><span style={{ color: 'var(--mgh-primary)' }}>84% On-Track</span><span>72 Processed</span></>} />
      <StatCard label="Total Hours Under Review" value="1,128.5" unit="hrs" icon="schedule" tone="accent" footer={<><span>Reg: 1,040h</span><span style={{ color: 'var(--mgh-warning)' }}>OT: 88.5h</span></>} />
      <StatCard label="Estimated Payroll Obligation" value="$48,920" unit="USD" icon="payments" tone="success" footer={<><span style={{ color: 'var(--mgh-success)' }}>Billable Jira: 91.4%</span><span>$44,712.80</span></>} />
      <StatCard label="Jira Sync Discrepancies" value={list.filter(x => x.match < 95).length} unit="Flagged" icon="warning" tone="danger" footer={<span style={{ color: 'var(--mgh-danger)' }}>Needs supervisor review</span>} />
    </Grid>

    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Queue */}
      <div style={{ width: 340, flexShrink: 0, position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--mgh-surface-page)', borderRadius: 16, padding: 14, maxHeight: 'calc(100vh - 104px)' }}>
        <SearchField value={q} onChange={setQ} placeholder="Search team member, ID, or Jira task..." style={{ background: '#fff' }} />
        <FilterChips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All', count: list.length }, { value: 'ot', label: 'Overtime', count: list.filter(x => x.ot).length, tone: 'warning' }, { value: 'jira', label: 'Jira Mismatch', count: list.filter(x => x.match < 95).length, tone: 'danger' }, { value: 'ready', label: 'Ready' }]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#fff', borderRadius: 8 }}>
          <Checkbox checked={sel.length === filtered.length && sel.length > 0} indeterminate={sel.length > 0 && sel.length < filtered.length} onChange={() => setSel(sel.length === filtered.length ? [] : filtered.map(x => x.id))} label={`Select All (${filtered.length})`} />
          <Button size="sm" variant="ghost" icon="done_all" disabled={!sel.length} onClick={() => { sel.forEach(id => setStatus(id, 'Approved')); notify(`${sel.length} timesheets bulk-approved`); setSel([]); }}>Bulk Approve</Button>
        </div>
        <div className="mgh-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: 2, margin: -2 }}>
          {filtered.map(x => <QueueCard key={x.id} e={x} active={x.id === e.id} checked={sel.includes(x.id)} onCheck={() => setSel(s => s.includes(x.id) ? s.filter(i => i !== x.id) : [...s, x.id])} onClick={() => setCur(x.id)} />)}
          {!filtered.length && <div style={{ padding: 28, textAlign: 'center', font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>No employees match.</div>}
        </div>
        <div style={{ font: '600 12px var(--font-sans)', color: 'var(--mgh-ink-2)', padding: '0 4px' }}>Showing {filtered.length} of {list.length} employees</div>
      </div>

      {/* Review pane */}
      <div style={{ flex: 1, minWidth: 0, background: 'var(--mgh-surface-page)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ background: '#fff', padding: 24, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar src={e.avatar} name={e.name} size={72} status="online" />
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span className="mgh-h2">{e.name}</span><Badge tone="dark" mono>{e.id}</Badge><Badge tone={STATUS_TONE[e.status]} dot>{e.status}</Badge></div>
            <div style={{ font: '400 16px/22px var(--font-sans)', color: 'var(--mgh-ink-2)', marginTop: 2 }}>{e.role} • {e.dept} Department</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Icon name="location_on" size={16} />{e.loc}</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Icon name="supervisor_account" size={16} />Manager: <b style={{ color: 'var(--mgh-ink)' }}>{e.mgr}</b></span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Icon name="apartment" size={16} />{e.entity}</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Icon name="work" size={16} />{e.type}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}><div className="mgh-overline">Hourly cost basis</div><div style={{ font: '800 28px/36px var(--font-sans)', letterSpacing: '-0.56px', color: 'var(--mgh-ink)' }}>{fmt$(e.rate)}<span style={{ font: '500 14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}> / hr</span></div><Badge tone={e.match >= 95 ? 'success' : 'danger'} icon={e.match >= 95 ? 'verified' : 'sync_problem'}>{e.match >= 95 ? 'Jira Sync Validated' : 'Jira Variance ' + (100 - e.match).toFixed(1) + '%'}</Badge></div>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card padding={20} title={<span className="mgh-overline">Timesheet lifecycle • Multi-tier multi-role clearance</span>}><Stepper steps={steps} /></Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
            <MetricTile tone="white" label="Regular" value={fmtH(e.reg)} /><MetricTile tone={e.ot ? 'warning' : 'white'} label="Overtime" value={fmtH(e.ot)} /><MetricTile tone="white" label="PTO / Leave" value={fmtH(e.pto)} /><MetricTile tone="white" label="Holiday" value="0.0h" />
            <MetricTile tone="success" label="Billable Jira" value={fmtH(jiraTotal)} /><MetricTile tone="white" label="Non-billable" value={fmtH(Math.max(0, clockTotal - jiraTotal))} /><MetricTile tone="white" label="Total time" value={fmtH(e.total)} /><MetricTile tone="dark" label="Est. Gross" value={fmt$(e.gross)} />
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card padding={20} title="Daily Breakdown & Jira Worklogs Cross-Reference" icon="calendar_month" actions={<><Tabs value={week} onChange={setWeek} tabs={[{ value: 'all', label: '14 days' }, { value: '1', label: 'Week 1' }, { value: '2', label: 'Week 2' }]} style={{ padding: 3 }} /></>} bodyStyle={{ paddingTop: 14 }}>
                <DataTable maxHeight={460} density="compact" rowKey="id" rows={shown} columns={[
                  { key: 'date', label: 'Date & Day', strong: true, weight: 600, render: d => <div><div style={{ color: d.weekend ? 'var(--mgh-ink-4)' : 'var(--mgh-ink)' }}>{d.date}</div><div style={{ font: '500 11px/14px var(--font-sans)', color: d.ot ? 'var(--mgh-warning)' : 'var(--mgh-ink-3)' }}>{d.note}</div></div> },
                  { key: 'inn', label: 'Clock In / Out', render: d => d.weekend ? <span style={{ color: 'var(--mgh-ink-4)' }}>—</span> : <span style={{ fontFamily: 'var(--font-mono)' }}>{d.inn} – {d.out}</span> },
                  { key: 'hrs', label: 'Logged', align: 'right', render: d => d.weekend ? '—' : <span><b style={{ color: 'var(--mgh-ink)' }}>{d.hrs.toFixed(1)}h</b>{d.ot > 0 && <span style={{ color: 'var(--mgh-warning)' }}> ({d.ot.toFixed(1)} OT)</span>}</span> },
                  { key: 'key', label: 'Jira Issue & Task', render: d => d.key ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge mono size="sm" tone="primary">{d.key}</Badge><span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.task}</span></div> : null },
                  { key: 'jira', label: 'Jira Worklog', align: 'right', render: d => d.weekend ? '—' : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: d.jira !== d.hrs ? 'var(--mgh-danger)' : 'var(--mgh-ink)' }}>{d.jira.toFixed(1)}h<Icon name={d.jira !== d.hrs ? 'error' : 'check_circle'} size={14} color={d.jira !== d.hrs ? 'var(--mgh-danger)' : 'var(--mgh-success)'} /></span> },
                ]} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '12px 14px 0', font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)' }}><span>Clock total: {fmtH(clockTotal)}</span><span style={{ color: 'var(--mgh-success)' }}>Jira total: {fmtH(jiraTotal)}</span></div>
              </Card>

              <Card padding={20} icon="sync_alt" title="Jira Worklogs by Issue" subtitle="Realtime bi-directional map • Atlassian Cloud">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(days.filter(d => d.key).reduce((m, d) => { const k = d.key + ' ' + d.task; m[k] = (m[k] || 0) + d.jira; return m; }, {})).map(([k, h]) => { const [key, ...t] = k.split(' ');
                    return <div key={k} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 160px 56px', gap: 12, alignItems: 'center' }}><Badge mono size="sm" tone="primary">{key}</Badge><span style={{ font: '500 13px var(--font-sans)', color: 'var(--mgh-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.join(' ')}</span><ProgressBar value={(h / jiraTotal) * 100 * 3} tone="accent" /><span style={{ font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)', textAlign: 'right' }}>{h.toFixed(1)}h</span></div>; })}
                </div>
              </Card>
            </div>

            <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card padding={20} icon="payments" title="Payroll Summary" subtitle="Estimated for PP-2025-08">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, font: '500 13px/18px var(--font-sans)' }}>
                  {[['Regular  80.0h × ' + fmt$(e.rate), regPay], ['Overtime ' + e.ot.toFixed(1) + 'h × 1.5', otPay], ['PTO ' + e.pto.toFixed(1) + 'h', ptoPay]].map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l}</span><b style={{ color: 'var(--mgh-ink)' }}>{fmt$(v)}</b></div>)}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--mgh-surface-2)', font: '700 14px var(--font-sans)', color: 'var(--mgh-ink)' }}><span>Gross pay</span><span>{fmt$(e.gross)}</span></div>
                  {ded.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--mgh-ink-3)' }}><span>{l}</span><span>−{fmt$(v)}</span></div>)}
                  <div style={{ marginTop: 6, padding: 12, borderRadius: 8, background: 'var(--mgh-navy)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="mgh-overline" style={{ color: 'var(--mgh-nav-text)' }}>Est. net pay</span><span style={{ font: '800 20px var(--font-sans)' }}>{fmt$(net)}</span></div>
                </div>
              </Card>
              <Card padding={20} icon="attach_file" title="Attachments" actions={<IconButton icon="upload" tone="tinted" title="Upload" onClick={() => notify('Upload dialog')} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{files.map(([n, s, ic]) => <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--mgh-surface-1)' }}><Icon name={ic} size={18} color="var(--mgh-primary)" /><div style={{ flex: 1, minWidth: 0 }}><div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</div><div style={{ font: '400 11px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{s}</div></div><IconButton icon="download" size={28} title="Download" /></div>)}</div>
              </Card>
              <Card padding={20} icon="forum" title="Comments">
                <ActivityFeed connector={false} items={comments} />
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><input value={comment} onChange={x => setComment(x.target.value)} placeholder="Add a comment for the approval chain…" style={{ flex: 1, minWidth: 0, height: 36, border: 'none', outline: 'none', borderRadius: 8, padding: '0 12px', background: 'var(--mgh-surface-1)', font: '400 13px var(--font-sans)' }} /><Button size="sm" icon="send" disabled={!comment} onClick={() => { setComments(c => [...c, { person: 'Elena Rostova', avatar: AVATARS + 'elena-rostova.jpg', title: 'Elena Rostova', time: 'Just now', body: comment }]); setComment(''); }}>Post</Button></div>
              </Card>
              <Card padding={20} icon="history" title="Approval History">
                <ActivityFeed items={[
                  ...(e.status === 'Approved' ? [{ icon: 'task_alt', tone: 'success', title: 'Approved by Elena Rostova (PM)', meta: 'Just now • e-signature applied' }] : []),
                  { icon: 'verified', tone: 'success', title: 'Supervisor approved', meta: 'Marcus Vance • Apr 15, 09:32' },
                  { icon: 'sync', tone: 'accent', title: 'Jira worklogs reconciled', meta: 'Auto-sync • Apr 14, 18:02' },
                  { icon: 'send', tone: 'primary', title: 'Timesheet submitted', meta: e.name + ' • Apr 14, 17:00' }]} />
              </Card>
            </div>
          </div>
        </div>
        {/* Sticky decision bar */}
        <div style={{ position: 'sticky', bottom: 0, background: 'rgba(226,231,255,.92)', backdropFilter: 'blur(16px)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Checkbox checked={sign} onChange={setSign} label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="signature" size={16} color="var(--mgh-primary)" />Apply Electronic Signature (Elena Rostova, PM)</span>} />
          <span style={{ flex: 1 }} />
          <Button variant="outline" size="sm" icon="save" onClick={() => notify('Draft saved')}>Save Draft</Button>
          <Button variant="outline" size="sm" icon="picture_as_pdf" onClick={() => notify('PDF exported')}>Export PDF</Button>
          <Button variant="danger" icon="undo" onClick={() => setRet(true)}>Return for Corrections</Button>
          <Button variant="outline" icon="check" disabled={!sign} onClick={() => approve(false)}>Approve Only</Button>
          <Button size="lg" icon="task_alt" iconRight="arrow_forward" disabled={!sign} onClick={() => approve(true)}>Approve & Next Employee</Button>
        </div>
      </div>
    </div>
    <Modal open={ret} title={`Return ${e.name}'s timesheet`} onClose={() => setRet(false)} actions={<><Button variant="outline" onClick={() => setRet(false)}>Cancel</Button><Button variant="danger" icon="undo" disabled={!reason} onClick={() => { setStatus(e.id, 'Returned'); setRet(false); setReason(''); notify('Returned to employee for corrections'); }}>Return Timesheet</Button></>}>
      <p className="mgh-body" style={{ margin: 0 }}>The employee and supervisor will be notified. The timesheet re-enters the lifecycle at <b>Employee</b>.</p>
      <textarea value={reason} onChange={x => setReason(x.target.value)} placeholder="Reason (required) — e.g. Apr 08 worklog on ATLAS-420 is 0.5h short of clock time." rows={4} style={{ border: 'none', outline: 'none', borderRadius: 8, padding: 12, background: 'var(--mgh-surface-1)', font: '400 13px/18px var(--font-sans)', resize: 'vertical' }} />
    </Modal>
  </Page>;
}

function TeamApprovalQueue({ go, notify }) {
  const [rows, setRows] = React.useState(EMPLOYEES.map(e => ({ ...e })));
  const [chip, setChip] = React.useState('all'); const [dept, setDept] = React.useState('All departments'); const [ent, setEnt] = React.useState('All entities');
  const base = rows.filter(r => (chip === 'all' || (chip === 'pending' && r.status.startsWith('Awaiting')) || (chip === 'flag' && ['Flagged OT', 'Jira Mismatch'].includes(r.status)) || (chip === 'done' && r.status === 'Approved')) && (dept === 'All departments' || r.dept === dept) && (ent === 'All entities' || r.entity === ent));
  const t = useTable(base, { search: ['name', 'id', 'project', 'role'], pageSize: 8, initialSort: { key: 'ot', dir: 'desc' } });
  const bulk = s => { setRows(r => r.map(x => t.sel.includes(x.id) ? { ...x, status: s } : x)); notify(`${t.sel.length} timesheets ${s.toLowerCase()}`); t.setSel([]); };
  return <Page>
    <PageHeader breadcrumbs={['Workforce', 'Approvals', 'Team Queue']} title="Team Approval Queue" description="Every timesheet awaiting your sign-off across entities. Select rows to approve or return in bulk." actions={<><Button variant="secondary" icon="filter_list">Saved Views</Button><Button icon="assignment_turned_in" onClick={() => go('approvals')}>Open Workspace</Button></>} />
    <Grid min={200}>
      <StatCard label="Awaiting you" value={rows.filter(r => r.status.startsWith('Awaiting')).length} icon="hourglass_top" tone="warning" style={{ minHeight: 0 }} />
      <StatCard label="Flagged" value={rows.filter(r => ['Flagged OT', 'Jira Mismatch'].includes(r.status)).length} icon="flag" tone="danger" style={{ minHeight: 0 }} />
      <StatCard label="Approved this period" value={rows.filter(r => r.status === 'Approved').length} icon="task_alt" tone="success" style={{ minHeight: 0 }} />
      <StatCard label="SLA: due in" value="1d 6h" icon="timer" tone="accent" style={{ minHeight: 0 }} />
    </Grid>
    <Card padding={20}>
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search name, ID, project…" filters={<><Select size="sm" icon="apartment" value={dept} onChange={setDept} options={['All departments', ...new Set(EMPLOYEES.map(e => e.dept))]} /><Select size="sm" icon="domain" value={ent} onChange={setEnt} options={['All entities', ...new Set(EMPLOYEES.map(e => e.entity))]} /></>} actions={<Button size="sm" variant="secondary" icon="download">Export CSV</Button>}
        chips={<FilterChips value={chip} onChange={setChip} options={[{ value: 'all', label: 'All', count: rows.length }, { value: 'pending', label: 'Awaiting', count: rows.filter(r => r.status.startsWith('Awaiting')).length, tone: 'warning' }, { value: 'flag', label: 'Flagged', count: rows.filter(r => ['Flagged OT', 'Jira Mismatch'].includes(r.status)).length, tone: 'danger' }, { value: 'done', label: 'Approved' }]} />} />
      <DataTable style={{ marginTop: 14 }} maxHeight={520} selectable selected={t.sel} onSelectedChange={t.setSel} sort={t.sort} onSort={t.setSort} rows={t.rows} onRowClick={r => go('approvals', r.id)}
        bulkBar={<><Button size="sm" variant="primary" icon="done_all" onClick={() => bulk('Approved')}>Approve</Button><Button size="sm" variant="danger" icon="undo" onClick={() => bulk('Returned')}>Return</Button></>}
        columns={[
          { key: 'name', label: 'Employee', sortable: true, render: r => <EmployeeCell e={r} sub={r.id + ' • ' + r.dept} /> },
          { key: 'project', label: 'Project', sortable: true },
          { key: 'reg', label: 'Regular', align: 'right', sortable: true, render: r => fmtH(r.reg) },
          { key: 'ot', label: 'Overtime', align: 'right', sortable: true, render: r => <span style={{ color: r.ot > 8 ? 'var(--mgh-danger)' : r.ot ? 'var(--mgh-warning)' : undefined, fontWeight: r.ot ? 700 : 400 }}>{fmtH(r.ot)}</span> },
          { key: 'total', label: 'Total', align: 'right', sortable: true, strong: true, weight: 700, render: r => fmtH(r.total) },
          { key: 'match', label: 'Jira match', align: 'right', sortable: true, render: r => <Badge size="sm" dot tone={r.match >= 98 ? 'success' : r.match >= 93 ? 'warning' : 'danger'}>{r.match}%</Badge> },
          { key: 'gross', label: 'Est. gross', align: 'right', sortable: true, strong: true, render: r => fmt$(r.gross) },
          { key: 'status', label: 'Status', sortable: true, render: r => <Badge size="sm" tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
          { key: 'x', label: '', align: 'right', render: r => <IconButton icon="chevron_right" size={28} title="Review" /> }]} />
      <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="timesheets" />
    </Card>
  </Page>;
}

function BiWeeklyTimesheets({ notify }) {
  const me = EMPLOYEES[0]; const [days, setDays] = React.useState(() => buildDays(me));
  const [submitted, setSubmitted] = React.useState(false);
  const total = days.reduce((s, d) => s + d.hrs, 0), ot = days.reduce((s, d) => s + d.ot, 0);
  const edit = (id, v) => setDays(ds => ds.map(d => d.id === id ? { ...d, hrs: Math.max(0, +v || 0), ot: Math.max(0, (+v || 0) - 8) } : d));
  return <Page>
    <PageHeader breadcrumbs={['Workforce', 'Timesheets', 'PP-2025-08']} title="Bi-Weekly Timesheet" status={<Badge tone={submitted ? 'success' : 'warning'} dot>{submitted ? 'Submitted • Awaiting Supervisor' : 'Draft • Due Apr 14, 17:00'}</Badge>}
      actions={<><Button variant="secondary" icon="sync" onClick={() => notify('Pulled 14 worklogs from Jira Cloud')}>Import Jira Worklogs</Button><Button icon="send" disabled={submitted} onClick={() => { setSubmitted(true); notify('Timesheet submitted for approval'); }}>Submit for Approval</Button></>} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, background: 'var(--mgh-surface-1)' }}><Avatar src={me.avatar} name={me.name} size={44} /><div style={{ flex: 1 }}><div className="mgh-lg">{me.name}</div><div className="mgh-body">{me.role} • {me.project}</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 110px)', gap: 8 }}><MetricTile tone="white" label="Total" value={fmtH(total)} /><MetricTile tone="white" label="Regular" value={fmtH(total - ot)} /><MetricTile tone={ot ? 'warning' : 'white'} label="Overtime" value={fmtH(ot)} /><MetricTile tone="success" label="Target" value="80.0h" /></div></div>
    {[1, 2].map(w => <Card key={w} padding={20} title={`Week ${w}`} subtitle={w === 1 ? 'Mon Mar 31 – Sun Apr 06' : 'Mon Apr 07 – Sun Apr 13'} icon="date_range" actions={<Badge tone="primary">{fmtH(days.filter(d => d.week === w).reduce((s, d) => s + d.hrs, 0))}</Badge>}>
      <DataTable density="compact" rows={days.filter(d => d.week === w)} columns={[
        { key: 'date', label: 'Day', strong: true, weight: 600, render: d => <span style={{ color: d.weekend ? 'var(--mgh-ink-4)' : undefined }}>{d.date}</span> },
        { key: 'inn', label: 'In', mono: true }, { key: 'out', label: 'Out', mono: true },
        { key: 'key', label: 'Jira Issue', render: d => d.key ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge mono size="sm" tone="primary">{d.key}</Badge>{d.task}</div> : <span style={{ color: 'var(--mgh-ink-4)' }}>—</span> },
        { key: 'type', label: 'Type', render: d => d.weekend ? <Badge size="sm">Weekend</Badge> : d.ot ? <Badge size="sm" tone="warning">Overtime</Badge> : <Badge size="sm" tone="success">Regular</Badge> },
        { key: 'hrs', label: 'Hours', align: 'right', render: d => <input disabled={submitted} value={d.hrs} onChange={x => edit(d.id, x.target.value)} style={{ width: 64, height: 30, textAlign: 'right', border: 'none', borderRadius: 6, padding: '0 8px', background: submitted ? 'transparent' : 'var(--mgh-surface-1)', font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)' }} /> }]} />
    </Card>)}
  </Page>;
}

window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { approvals: ApprovalWorkspace, queue: TeamApprovalQueue, timesheets: BiWeeklyTimesheets });

})();

// ---- ScreensPeople.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, MetricTile, DataTable, TableToolbar, Pagination, ActivityFeed, Tabs, PageHeader, Select, ProgressBar, KeyValue, Toggle } = window.MyGlobalHubDesignSystem_2a603d;

function Dashboard({ go }) {
  const trend = [['PP-03', 44.1], ['PP-04', 45.3], ['PP-05', 46.0], ['PP-06', 46.8], ['PP-07', 47.4], ['PP-08', 48.9]].map(([l, a]) => ({ label: l, a, hi: l === 'PP-08' }));
  const depts = [['Engineering', 38, 'var(--mgh-primary)'], ['Infrastructure', 18, 'var(--mgh-accent)'], ['Product', 14, 'var(--mgh-navy)'], ['Analytics', 12, 'var(--mgh-success)'], ['Other', 18, 'var(--mgh-ink-4)']];
  return <Page>
    <PageHeader breadcrumbs={['Overview']} title="Good morning, Elena" description="PP-2025-08 closes in 4 days 18 hours. 14 timesheets still need your approval before Finance Run." actions={<><Button variant="secondary" icon="calendar_month">Apr 01 – Apr 14</Button><Button icon="assignment_turned_in" onClick={() => go('approvals')}>Review 14 Approvals</Button></>} />
    <Grid min={220}>
      <StatCard label="Active workforce" value="86" unit="employees" icon="groups" delta="+4 this quarter" />
      <StatCard label="Period payroll" value="$48.9k" unit="USD" icon="payments" tone="accent" delta="+3.2% vs PP-07" />
      <StatCard label="Billable utilization" value="91.4%" icon="data_usage" tone="success" progress={91.4} />
      <StatCard label="Compliance alerts" value="3" icon="gpp_maybe" tone="danger" footer={<span style={{ color: 'var(--mgh-danger)' }}>2 Jira • 1 Banking</span>} />
    </Grid>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 20 }}>
      <Card title="Gross payroll trend" subtitle="Last 6 bi-weekly periods (thousands USD)" icon="monitoring" actions={<Tabs value="pp" tabs={[{ value: 'pp', label: 'Period' }, { value: 'q', label: 'Quarter' }]} style={{ padding: 3 }} />}><BarChart data={trend} height={200} format={v => '$' + v + 'k'} /></Card>
      <Card title="Cost by department" icon="donut_small">
        <ProgressBar height={14} segments={depts.map(([l, v, c]) => ({ value: v, color: c, label: v + '%' }))} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>{depts.map(([l, v, c]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', font: '500 13px var(--font-sans)' }}><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}</span><b style={{ color: 'var(--mgh-ink)' }}>{fmt$(48920 * v / 100)}</b></div>)}</div>
      </Card>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 20 }}>
      <Card title="Needs your attention" icon="priority_high" actions={<Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={() => go('queue')}>View queue</Button>} bodyStyle={{ paddingTop: 14 }}>
        <DataTable density="compact" onRowClick={r => go('approvals', r.id)} rows={EMPLOYEES.filter(e => e.status !== 'Approved').slice(0, 5)} columns={[
          { key: 'name', label: 'Employee', render: r => <EmployeeCell e={r} /> }, { key: 'total', label: 'Hours', align: 'right', render: r => fmtH(r.total) },
          { key: 'status', label: 'Status', render: r => <Badge size="sm" tone={STATUS_TONE[r.status]}>{r.status}</Badge> }, { key: 'gross', label: 'Est. gross', align: 'right', strong: true, render: r => fmt$(r.gross) }]} />
      </Card>
      <Card title="Period timeline" icon="event_upcoming">
        <ActivityFeed items={[{ icon: 'check', tone: 'success', title: 'Timesheet submission closed', meta: 'Apr 14, 17:00' }, { icon: 'how_to_reg', tone: 'primary', title: 'Supervisor & PM approval', meta: 'Now • due Apr 16' }, { icon: 'badge', tone: 'neutral', title: 'HR review', meta: 'Apr 17' }, { icon: 'account_balance', tone: 'neutral', title: 'Disbursement (ACH / FedWire)', meta: 'Apr 19' }]} />
      </Card>
    </div>
  </Page>;
}

function Employees({ go }) {
  const [chip, setChip] = React.useState('all'); const [dept, setDept] = React.useState('All departments'); const [type, setType] = React.useState('All types');
  const base = EMPLOYEES.filter(e => (chip === 'all' || e.entity.includes(chip)) && (dept === 'All departments' || e.dept === dept) && (type === 'All types' || e.type === type));
  const t = useTable(base, { search: ['name', 'id', 'role', 'dept', 'loc'], pageSize: 10, initialSort: { key: 'name', dir: 'asc' } });
  return <Page>
    <PageHeader breadcrumbs={['Workforce', 'Employee Directory']} title="Employees" description="86 people across 3 operating entities." actions={<><Button variant="secondary" icon="upload">Import CSV</Button><Button icon="person_add">Add Employee</Button></>} />
    <Card padding={20}>
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search name, ID, role, location…"
        filters={<><Select size="sm" icon="apartment" value={dept} onChange={setDept} options={['All departments', ...new Set(EMPLOYEES.map(e => e.dept))]} /><Select size="sm" icon="work" value={type} onChange={setType} options={['All types', ...new Set(EMPLOYEES.map(e => e.type))]} /></>}
        actions={<><Button size="sm" variant="secondary" icon="view_column">Columns</Button><Button size="sm" variant="secondary" icon="download">Export</Button></>}
        chips={<FilterChips value={chip} onChange={setChip} options={[{ value: 'all', label: 'All entities', count: EMPLOYEES.length }, { value: 'Dominicana', label: 'Dominicana SRL', count: EMPLOYEES.filter(e => e.entity.includes('Dominicana')).length }, { value: 'USA', label: 'USA Inc.', count: EMPLOYEES.filter(e => e.entity.includes('USA')).length }, { value: 'UK', label: 'UK Ltd.', count: EMPLOYEES.filter(e => e.entity.includes('UK')).length }]} />} />
      <DataTable style={{ marginTop: 14 }} maxHeight={560} selectable selected={t.sel} onSelectedChange={t.setSel} sort={t.sort} onSort={t.setSort} rows={t.rows} onRowClick={r => go('profile', r.id)}
        bulkBar={<><Button size="sm" variant="secondary" icon="mail">Message</Button><Button size="sm" variant="secondary" icon="download">Export</Button></>}
        columns={[
          { key: 'name', label: 'Employee', sortable: true, render: r => <EmployeeCell e={r} /> },
          { key: 'id', label: 'ID', sortable: true, render: r => <Badge mono size="sm">{r.id}</Badge> },
          { key: 'dept', label: 'Department', sortable: true }, { key: 'entity', label: 'Entity', sortable: true }, { key: 'loc', label: 'Location', sortable: true },
          { key: 'type', label: 'Type', sortable: true, render: r => <Badge size="sm" tone={r.type.startsWith('Contractor') ? 'primary' : 'neutral'}>{r.type}</Badge> },
          { key: 'rate', label: 'Rate', align: 'right', sortable: true, strong: true, render: r => fmt$(r.rate) + '/hr' },
          { key: 'x', label: '', align: 'right', render: () => <IconButton icon="more_vert" size={28} title="More" /> }]} />
      <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="employees" />
    </Card>
  </Page>;
}

function EmployeeProfile({ empId, go, notify }) {
  const e = EMPLOYEES.find(x => x.id === empId) || EMPLOYEES[0];
  const [tab, setTab] = React.useState('overview'); const [sync, setSync] = React.useState(true);
  return <Page>
    <nav style={{ display: 'flex', gap: 6, alignItems: 'center', font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}><a onClick={() => go('employees')} style={{ cursor: 'pointer', color: 'var(--mgh-ink-2)', fontWeight: 500 }}>Workforce</a><Icon name="chevron_right" size={14} /><a onClick={() => go('employees')} style={{ cursor: 'pointer', color: 'var(--mgh-ink-2)', fontWeight: 500 }}>Employee Directory</a><Icon name="chevron_right" size={14} /><b style={{ color: 'var(--mgh-ink)' }}>{e.name} ({e.id})</b></nav>
    <Card padding={24}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ width: 120, height: 120, borderRadius: 12, background: e.avatar ? `url(${e.avatar}) center/cover` : 'var(--mgh-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 40px var(--font-sans)', color: 'var(--mgh-primary)', flexShrink: 0 }}>{!e.avatar && e.name.split(' ').map(s => s[0]).join('')}</div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className="mgh-title">{e.name}</span><Badge tone="success">Active / On-Roll</Badge></div>
          <Badge mono size="sm" style={{ marginTop: 4 }}>{e.id}</Badge>
          <div className="mgh-lg" style={{ fontWeight: 500, marginTop: 6 }}>{e.role}</div>
          <div style={{ font: '400 14px/20px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>{e.dept} • {e.project}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', font: '500 13px var(--font-sans)', color: 'var(--mgh-ink-2)' }}><span style={{ display: 'flex', gap: 4 }}><Icon name="domain" size={16} />{e.entity}</span><span style={{ display: 'flex', gap: 4 }}><Icon name="work" size={16} />{e.type}</span><span style={{ display: 'flex', gap: 4 }}><Icon name="calendar_today" size={16} />Joined {e.joined}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Button variant="secondary" icon="edit">Edit Employee</Button><Button variant="secondary" icon="receipt_long" onClick={() => go('paystub')}>Generate Pay Statement</Button><Button variant="dark" icon="sync_lock" onClick={() => notify('Jira API token reset')}>Reset Jira API Token</Button></div>
      </div>
      <Tabs style={{ marginTop: 20 }} value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview & Profile' }, { value: 'bank', label: 'Multi-Bank Allocations', dot: true }, { value: 'comp', label: 'Compensation & Tax' }, { value: 'jira', label: 'Jira Integration', tag: 'LIVE' }, { value: 'pto', label: 'Time Off & PTO' }, { value: 'docs', label: 'Documents' }]} />
    </Card>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(300px,1fr)', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card icon="badge" title="Employment details">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><KeyValue label="Manager" value={e.mgr} /><KeyValue label="Work location" value={e.loc} /><KeyValue label="Pay frequency" value="Bi-weekly" /><KeyValue label="Tax profile" value={e.tax.split(' — ')[0]} aside={<Badge tone={/^Exempt/.test(e.tax) ? 'success' : 'info'} size="sm">{/^Exempt/.test(e.tax) ? 'No withholdings' : 'Withholding'}</Badge>} /><KeyValue label="Primary bank" value={e.bank} /><KeyValue label="RNC / Cédula Personal" value="001-1829472-3" mono aside={<Badge tone="success" size="sm">Active</Badge>} /><KeyValue label="TSS Registry" value="ARS Primera, AFP Crecer" aside={<Icon name="verified_user" size={18} color="var(--mgh-success)" />} /></div>
        </Card>
        <Card icon="payments" title="Compensation & Overtime Rules" actions={<Button size="sm" variant="ghost">Edit Tariff</Button>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}><MetricTile label="Base hourly" value={fmt$(e.rate)} sub="USD / hr" align="center" /><MetricTile tone="success" label="Overtime 1.5×" value={fmt$(e.rate * 1.5)} sub="> 44h regular" align="center" /><MetricTile tone="warning" label="Sunday / Holiday" value={fmt$(e.rate * 2)} sub="Double rate" align="center" /></div>
          <ProgressBar style={{ marginTop: 14 }} value={96.4} tone="success" label="Billable efficiency — target ≥ 95%" valueLabel="96.4% Compliant" />
        </Card>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card icon="hub" title="Jira Cloud Account Binding" actions={<Badge tone="success" dot>Connected</Badge>}>
          <KeyValue label="Atlassian Cloud ID" value={e.name.toLowerCase().replace(' ', '.') + '@globalhub.atlassian.net'} aside={<IconButton icon="content_copy" size={28} title="Copy" />} />
          <div className="mgh-overline" style={{ margin: '14px 0 8px' }}>Bound worklog projects</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge dot tone="primary">ATLAS (Core Platform)</Badge><Badge dot tone="info">PERF (Infrastructure)</Badge><Button size="sm" variant="ghost" icon="add">Bind Project</Button></div>
          <Toggle style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'var(--mgh-surface-1)' }} checked={sync} onChange={setSync} label="Real-Time Worklog Auto-Sync" description="Sync interval: Every 5m • Webhook Active" />
        </Card>
        <Card icon="history" title="System audit log" actions={<Badge tone="success">Live Feed</Badge>}>
          <ActivityFeed items={[{ icon: 'done_all', tone: 'success', title: 'Bank route verification confirmed', meta: 'Today 09:14 • Compliance Engine' }, { icon: 'sync', tone: 'accent', title: '8.5h logged under ATLAS-3482', meta: 'Yesterday 06:30 • Jira Webhook' }, { icon: 'edit', tone: 'neutral', title: 'Tariff updated: OT threshold 44h', meta: 'Mar 28 • Ana Gómez' }]} />
        </Card>
      </div>
    </div>
  </Page>;
}

window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { dashboard: Dashboard, employees: Employees, profile: EmployeeProfile });

})();

// ---- ScreensPayroll.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, MetricTile, DataTable, TableToolbar, Pagination, ActivityFeed, Tabs, PageHeader, Select, ProgressBar, KeyValue, Stepper, Checkbox, TextField } = window.MyGlobalHubDesignSystem_2a603d;

function PayrollDashboard({ go }) {
  const byEntity = [['Dominicana SRL', 29840, 'DOP / USD'], ['USA Inc.', 13260, 'USD'], ['UK Ltd.', 5820, 'GBP']];
  const comp = [{ label: 'PP-03', a: 39.2, b: 4.9 }, { label: 'PP-04', a: 40.1, b: 5.2 }, { label: 'PP-05', a: 40.8, b: 5.2 }, { label: 'PP-06', a: 41.0, b: 5.8 }, { label: 'PP-07', a: 41.6, b: 5.8 }, { label: 'PP-08', a: 42.3, b: 6.6 }];
  return <Page>
    <PageHeader breadcrumbs={['Payroll & Finance', 'Overview']} title="Payroll Dashboard" status={<Badge tone="success" dot>Payroll ready • Cycle PP-2025-08 • Auto-lock in 4d 18h</Badge>} actions={<><Button variant="secondary" icon="calendar_month">Pay calendar</Button><Button icon="play_arrow" onClick={() => go('processing')}>Start Payroll Run</Button></>} />
    <Grid min={220}>
      <StatCard label="Gross payroll" value="$48,920" unit="USD" icon="payments" delta="+3.2% vs PP-07" />
      <StatCard label="Employer taxes" value="$6,114" unit="USD" icon="account_balance_wallet" tone="accent" footer={<><span>TSS • FICA • NI</span><span>12.5%</span></>} />
      <StatCard label="Net disbursement" value="$38,402" unit="USD" icon="send_money" tone="success" progress={100} footer={<><span style={{ color: 'var(--mgh-success)' }}>100% routed</span><span>5 banks</span></>} />
      <StatCard label="Exceptions" value="3" icon="report" tone="danger" footer={<span style={{ color: 'var(--mgh-danger)' }}>Resolve before lock</span>} />
    </Grid>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 20 }}>
      <Card icon="stacked_bar_chart" title="Regular vs overtime cost" subtitle="Thousands USD per period"><BarChart data={comp} height={200} color="var(--mgh-primary)" color2="var(--mgh-accent)" legend={[['var(--mgh-primary)', 'Regular'], ['var(--mgh-accent)', 'Overtime & premiums']]} /></Card>
      <Card icon="domain" title="By operating entity">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{byEntity.map(([n, v, c]) => <div key={n}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{n} <span style={{ color: 'var(--mgh-ink-3)', fontWeight: 400 }}>{c}</span></span><b style={{ font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{fmt$(v)}</b></div><ProgressBar value={v / 489.2} /></div>)}</div>
      </Card>
    </div>
    <Card icon="event_repeat" title="Upcoming pay periods" bodyStyle={{ paddingTop: 14 }}>
      <DataTable density="compact" rows={[{ id: 'PP-2025-08', range: 'Apr 01 – Apr 14', pay: 'Apr 19', st: 'In approval', g: 48920 }, { id: 'PP-2025-09', range: 'Apr 15 – Apr 28', pay: 'May 03', st: 'Open', g: 49300 }, { id: 'PP-2025-10', range: 'Apr 29 – May 12', pay: 'May 17', st: 'Scheduled', g: 49300 }]} columns={[
        { key: 'id', label: 'Cycle', mono: true, strong: true }, { key: 'range', label: 'Work period' }, { key: 'pay', label: 'Pay date' },
        { key: 'st', label: 'Status', render: r => <Badge size="sm" tone={r.st === 'In approval' ? 'warning' : r.st === 'Open' ? 'info' : 'neutral'}>{r.st}</Badge> }, { key: 'g', label: 'Projected gross', align: 'right', strong: true, render: r => fmt$(r.g) }]} />
    </Card>
  </Page>;
}

function PayrollProcessing({ notify }) {
  const [step, setStep] = React.useState(2); const [sel, setSel] = React.useState([]);
  const names = ['Pre-checks', 'Import Hours', 'Review Exceptions', 'Calculate', 'Approve & Lock', 'Disburse'];
  const steps = names.map((l, i) => ({ label: l, state: i < step ? 'done' : i === step ? 'current' : 'pending', icon: ['rule', 'download', 'report', 'calculate', 'lock', 'send_money'][i], status: i < step ? 'Complete' : i === step ? 'Current Step' : 'Pending' }));
  const ex = [{ id: 1, emp: EMPLOYEES[2], issue: 'Overtime exceeds 10h policy cap', sev: 'High', act: 'Needs VP sign-off' }, { id: 2, emp: EMPLOYEES[4], issue: 'Jira worklog 4.0h short of clock time', sev: 'Medium', act: 'Return to employee' }, { id: 3, emp: EMPLOYEES[11], issue: 'New bank account in 72h cooling period', sev: 'Medium', act: 'Hold allocation' }];
  return <Page>
    <PageHeader breadcrumbs={['Payroll & Finance', 'Pay Periods & Processing', 'PP-2025-08']} title="Payroll Processing" status={<Badge tone="warning" dot>Run #2025-08-A • Step {step + 1} of 6</Badge>}
      actions={<><Button variant="secondary" icon="arrow_back" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Back</Button><Button icon={step === 5 ? 'send_money' : 'arrow_forward'} onClick={() => { if (step < 5) setStep(s => s + 1); notify(step === 5 ? 'Disbursement released to banks' : `${names[step]} completed`); }}>{step === 5 ? 'Release Funds' : 'Continue to ' + names[step + 1]}</Button></>} />
    <Card padding={24}><Stepper steps={steps} /></Card>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
      <MetricTile tone="white" label="Employees" value="86" /><MetricTile tone="white" label="Hours" value="7,382.5h" /><MetricTile tone="white" label="Gross" value="$48,920" /><MetricTile tone="white" label="Deductions" value="$10,518" /><MetricTile tone="success" label="Net" value="$38,402" /><MetricTile tone="danger" label="Exceptions" value="3" />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: 20 }}>
      <Card icon="report" title="Exceptions to resolve" subtitle="Payroll cannot lock while high-severity items are open." bodyStyle={{ paddingTop: 14 }}>
        <DataTable selectable selected={sel} onSelectedChange={setSel} bulkBar={<Button size="sm" icon="done" onClick={() => { notify(`${sel.length} exceptions resolved`); setSel([]); }}>Mark resolved</Button>} rows={ex} columns={[
          { key: 'emp', label: 'Employee', render: r => <EmployeeCell e={r.emp} sub={r.emp.id} /> }, { key: 'issue', label: 'Issue', wrap: true },
          { key: 'sev', label: 'Severity', render: r => <Badge size="sm" tone={r.sev === 'High' ? 'danger' : 'warning'}>{r.sev}</Badge> }, { key: 'act', label: 'Suggested action', render: r => <Button size="sm" variant="ghost">{r.act}</Button> }]} />
      </Card>
      <Card icon="checklist" title="Pre-run checklist">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{['Exchange rates locked (DOP 59.12)', 'TSS & ISR tables — 2025 rev.', 'Jira Cloud sync < 5m old', 'Bank cut-off: FedWire 16:00 ET', 'Dual control approver assigned'].map((t, i) => <Checkbox key={t} checked={i < 4} label={t} />)}</div>
      </Card>
    </div>
  </Page>;
}

function TransferProofs({ period, notify, gross }) {
  const KEY = 'mgh-transfer-proofs';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const [all, setAll] = React.useState(load);
  const [over, setOver] = React.useState(null);
  const inputs = React.useRef({});
  const legs = [{ id: 'bhd', bank: 'Banco BHD León', acct: '•••• 8491', rail: 'ACH', pct: 80 }, { id: 'chase', bank: 'Chase Bank USA', acct: '•••• 2910', rail: 'FedWire', pct: 20 }];
  const save = next => { setAll(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { notify('File too large to persist — kept for this session'); } };
  const attach = (leg, file) => {
    if (!file) return;
    if (!/^(image\/|application\/pdf)/.test(file.type)) { notify('Upload a PDF, PNG or JPG receipt'); return; }
    if (file.size > 5 * 1024 * 1024) { notify('Max file size is 5 MB'); return; }
    const r = new FileReader();
    r.onload = () => {
      const at = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      save({ ...all, [period]: { ...(all[period] || {}), [leg.id]: { name: file.name, type: file.type, size: file.size, data: r.result, at } } });
      notify('Transfer receipt attached • ' + leg.bank);
    };
    r.readAsDataURL(file);
  };
  const remove = leg => { const p = { ...(all[period] || {}) }; delete p[leg.id]; save({ ...all, [period]: p }); };
  const cur = all[period] || {};
  const done = legs.filter(l => cur[l.id]).length;
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
  return <Card icon="receipt" title="Bank transfer receipts" subtitle={period + ' • ' + done + ' of ' + legs.length + ' attached'} padding={20}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {legs.map(l => { const f = cur[l.id]; const hot = over === l.id;
        return <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{l.bank} <span style={{ font: '400 12px var(--font-mono)', color: 'var(--mgh-ink-3)' }}>{l.acct}</span></span>
            <span style={{ font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)', fontVariantNumeric: 'tabular-nums' }}>{fmt$(gross * l.pct / 100)}</span>
          </div>
          {f ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, background: 'var(--mgh-surface-1)' }}>
            {f.type.startsWith('image/') ? <img src={f.data} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} /> : <span style={{ width: 40, height: 40, borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="picture_as_pdf" size={20} color="var(--mgh-danger)" /></span>}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <a href={f.data} target="_blank" download={f.name} style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{f.name}</a>
              <span style={{ font: '400 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{kb(f.size)} • {f.at}</span>
            </div>
            <IconButton icon="swap_horiz" title="Replace" onClick={() => inputs.current[l.id].click()} />
            <IconButton icon="delete" title="Remove" onClick={() => remove(l)} />
          </div>
          : <div role="button" tabIndex={0} onClick={() => inputs.current[l.id].click()} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inputs.current[l.id].click()}
              onDragOver={e => { e.preventDefault(); setOver(l.id); }} onDragLeave={() => setOver(null)} onDrop={e => { e.preventDefault(); setOver(null); attach(l, e.dataTransfer.files[0]); }}
              style={{ padding: '16px 12px', borderRadius: 8, border: '1.5px dashed ' + (hot ? 'var(--mgh-primary)' : 'var(--mgh-surface-4)'), background: hot ? 'var(--mgh-primary-50)' : 'var(--mgh-surface-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', textAlign: 'center', transition: 'all 160ms cubic-bezier(.2,0,0,1)' }}>
            <Icon name="upload_file" size={20} color="var(--mgh-primary)" />
            <span style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>Drop {l.rail} confirmation or <span style={{ color: 'var(--mgh-primary)' }}>browse</span></span>
            <span style={{ font: '400 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>PDF, PNG or JPG • Max 5 MB</span>
          </div>}
          <input ref={el => inputs.current[l.id] = el} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={e => { attach(l, e.target.files[0]); e.target.value = ''; }} />
        </div>; })}
    </div>
  </Card>;
}

function PayStubPreview({ notify, empId }) {
  const empOpts = EMPLOYEES.map(x => x.id + ' • ' + x.name);
  const [who, setWho] = React.useState(() => empOpts.find(o => o.startsWith(empId || '')) || empOpts[0]);
  const e = EMPLOYEES.find(x => who.startsWith(x.id)) || EMPLOYEES[0];
  const calc = DEDUCT(e), ded = calc.lines, net = calc.net, dedTotal = calc.total;
  const [period, setPeriod] = React.useState('PP-2025-08');
  const row = (l, a, b, c, bold) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 110px', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--mgh-surface-2)', font: `${bold ? 700 : 500} 13px var(--font-sans)`, color: bold ? 'var(--mgh-ink)' : 'var(--mgh-ink-2)' }}><span>{l}</span><span style={{ textAlign: 'right' }}>{a}</span><span style={{ textAlign: 'right' }}>{b}</span><span style={{ textAlign: 'right', color: 'var(--mgh-ink)' }}>{c}</span></div>;
  return <Page>
    <PageHeader breadcrumbs={['Payroll & Finance', 'Pay Stubs', e.id]} title="Pay Stub Preview" actions={<><Select size="sm" icon="person" value={who} onChange={setWho} options={empOpts} /><Select size="sm" value={period} onChange={setPeriod} options={['PP-2025-08', 'PP-2025-07', 'PP-2025-06']} /><Button variant="secondary" icon="mail" onClick={() => notify('Pay stub emailed to employee')}>Email</Button><Button variant="dark" icon="download" onClick={() => notify('PDF downloaded')}>Download PDF</Button></>} />
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>
      <div style={{ background: 'var(--mgh-surface-1)', borderRadius: 16, padding: 28, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 4, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          <div style={{ height: 6, background: 'var(--mgh-navy)' }} />
          <div style={{ padding: 36, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><img src="assets/logo-mgh.png" alt="My Global Hub" style={{ height: 52 }} /><div style={{ textAlign: 'right' }}><div className="mgh-overline">Earnings statement</div><div className="mgh-h3">{period}</div><div className="mgh-body">Pay date Apr 19, 2025</div></div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 14, borderRadius: 8, background: 'var(--mgh-surface-page)' }}>
              <div><div className="mgh-overline">Employee</div><div className="mgh-lg">{e.name}</div><div className="mgh-body">{e.id} • {e.role}</div></div>
              <div><div className="mgh-overline">Employer</div><div className="mgh-lg">My Global Hub Dominicana SRL</div><div className="mgh-body">RNC 1-31-88421-7 • Punta Cana</div></div>
            </div>
            <div><div className="mgh-overline" style={{ marginBottom: 4 }}>Earnings</div>{row('Description', 'Hours', 'Rate', 'Amount', true)}{row('Regular', '80.0', fmt$(e.rate), fmt$(e.reg * e.rate))}{row('Overtime 1.5×', e.ot.toFixed(1), fmt$(e.rate * 1.5), fmt$(e.ot * e.rate * 1.5))}{row('Gross pay', '', '', fmt$(e.gross), true)}</div>
            <div><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span className="mgh-overline">Deductions</span><Badge size="sm" tone={calc.exempt ? 'success' : 'info'}>{e.tax.split(' — ')[0]}</Badge></div>{calc.exempt ? row('Tax deductions', '', '', 'Exempt') : ded.map(([l, v]) => row(l, '', '', '−' + fmt$(v)))}{row('Total deductions', '', '', '−' + fmt$(dedTotal), true)}</div>
            <div><div className="mgh-overline" style={{ marginBottom: 8 }}>Direct deposit allocation</div><ProgressBar height={16} segments={[{ value: 80, color: 'var(--mgh-primary)', label: 'Banco BHD León 80%' }, { value: 20, color: 'var(--mgh-navy)', label: 'Chase 20%' }]} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 8, background: 'var(--mgh-navy)', color: '#fff' }}><span className="mgh-overline" style={{ color: 'var(--mgh-nav-text)' }}>Net pay</span><span style={{ font: '800 28px var(--font-sans)', letterSpacing: '-0.56px' }}>{fmt$(net)}</span></div>
            <div style={{ font: '400 11px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{calc.exempt ? 'Tax-exempt profile — no statutory withholdings applied. The payee is responsible for their own tax obligations.' : /DGII/.test(e.tax) ? 'Withholdings computed under Dominican Law 87-01 and the Dominican Tax Code.' : /W-4/.test(e.tax) ? 'Withholdings computed from the employee W-4 and IRS Pub. 15-T tables.' : 'Withholdings computed under HMRC PAYE and NI thresholds.'} Document ID MGH-PS-{period.slice(3)}-{e.id.slice(4)} • SHA-256 verified.</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card title="Summary" padding={20}><div style={{ display: 'grid', gap: 8 }}><KeyValue label="Gross" value={fmt$(e.gross)} /><KeyValue label="Deductions" value={calc.exempt ? 'Exempt' : '−' + fmt$(dedTotal)} /><KeyValue label="Net" value={fmt$(net)} aside={<Badge tone="success">Verified</Badge>} /></div></Card>
        <TransferProofs key={period + e.id} period={period} notify={notify} gross={net} />
        <Card title="Year to date" padding={20}><div style={{ display: 'grid', gap: 8 }}><KeyValue label="YTD gross" value="$36,329.75" /><KeyValue label="YTD withholding" value={fmt$(dedTotal * 8)} /></div></Card>
      </div>
    </div>
  </Page>;
}

function Banking({ notify }) {
  const accounts = [{ id: 1, bank: 'Banco BHD León', code: 'BHD', country: 'Dominican Republic', type: 'Primary ACH', acct: '•••• 8491', routing: 'BHDLDO22', cur: 'DOP / USD', st: 'Verified', vol: 29840 }, { id: 2, bank: 'Chase Bank USA, N.A.', code: 'JPMC', country: 'United States', type: 'Offshore FedWire', acct: '•••• 2910', routing: '021000021', cur: 'USD', st: 'Verified', vol: 13260 }, { id: 3, bank: 'Barclays', code: 'BARC', country: 'United Kingdom', type: 'BACS', acct: '•••• 7712', routing: '20-00-00', cur: 'GBP', st: 'Verified', vol: 5820 }, { id: 4, bank: 'Revolut Business', code: 'REV', country: 'EU', type: 'SEPA', acct: '•••• 0045', routing: 'REVOLT21', cur: 'EUR', st: 'Cooling 72h', vol: 0 }];
  const t = useTable(accounts, { search: ['bank', 'country', 'type'], pageSize: 10 });
  return <Page>
    <PageHeader breadcrumbs={['Payroll & Finance', 'Banking & Allocations']} title="Central Banking & Treasury" description="Funding accounts, payout rails and multi-bank splits for every operating entity." actions={<><Button variant="secondary" icon="history">Audit History</Button><Button icon="add_circle" onClick={() => notify('2FA challenge sent to YubiKey')}>Add Bank Account</Button></>} />
    <Grid min={220}>
      <StatCard label="Treasury balance" value="$412.8k" icon="account_balance" style={{ minHeight: 0 }} />
      <StatCard label="This cycle outflow" value="$48.9k" icon="send_money" tone="accent" style={{ minHeight: 0 }} />
      <StatCard label="Verified rails" value="3 / 4" icon="verified_user" tone="success" style={{ minHeight: 0 }} />
      <StatCard label="Pending verification" value="1" icon="lock_clock" tone="warning" style={{ minHeight: 0 }} />
    </Grid>
    <Card padding={20} icon="account_balance" title="Disbursement accounts">
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search bank, country, rail…" actions={<Button size="sm" variant="secondary" icon="download">Export</Button>} />
      <DataTable style={{ marginTop: 14 }} sort={t.sort} onSort={t.setSort} rows={t.rows} columns={[
        { key: 'bank', label: 'Institution', sortable: true, render: r => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 36, height: 36, borderRadius: 8, background: r.id === 2 ? 'var(--mgh-navy)' : 'var(--mgh-primary-50)', color: r.id === 2 ? '#fff' : 'var(--mgh-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 11px var(--font-sans)' }}>{r.code}</span><div><div style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{r.bank}</div><div style={{ font: '400 11px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{r.country}</div></div></div> },
        { key: 'type', label: 'Rail', sortable: true, render: r => <Badge size="sm" tone="primary" uppercase>{r.type}</Badge> }, { key: 'acct', label: 'Account', mono: true }, { key: 'routing', label: 'BIC / Routing', mono: true }, { key: 'cur', label: 'Currency' },
        { key: 'st', label: 'Status', render: r => <Badge size="sm" dot tone={r.st === 'Verified' ? 'success' : 'warning'}>{r.st}</Badge> }, { key: 'vol', label: 'Cycle volume', align: 'right', sortable: true, strong: true, render: r => fmt$(r.vol) }]} />
    </Card>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <Card icon="call_split" title="Default split rule" subtitle="Applied to contractors in MGH Dominicana SRL"><ProgressBar height={16} label="Allocation ratio summary" valueLabel="100% Allocated (Balanced)" segments={[{ value: 80, color: 'var(--mgh-primary)', label: '80% Primary (DOP/USD)' }, { value: 20, color: 'var(--mgh-navy)', label: '20% USD' }]} /></Card>
      <Card icon="gavel" title="Compliance & 3-Day Verification Policy" tone="muted"><p className="mgh-body" style={{ margin: 0 }}>Bank account modifications require hardware-token 2FA and countersignature from HR Finance leadership. Allocation updates are subject to an auditable 72-hour cooling period to prevent payroll diversion fraud.</p></Card>
    </div>
  </Page>;
}

window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { payroll: PayrollDashboard, processing: PayrollProcessing, paystub: PayStubPreview, banking: Banking });

})();

// ---- ScreensOps.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, MetricTile, DataTable, TableToolbar, Pagination, ActivityFeed, Tabs, PageHeader, Select, ProgressBar, KeyValue, Toggle, TextField, Checkbox } = window.MyGlobalHubDesignSystem_2a603d;

const PROJECTS = [
  { id: 'ATLAS', name: 'Atlas Core Platform', lead: 'Elena Rostova', people: 14, budget: 120000, spent: 84200, hrs: 1610, bill: 94.2, st: 'On track' },
  { id: 'PERF', name: 'Perf Infrastructure', lead: 'David Wu', people: 6, budget: 60000, spent: 51800, hrs: 940, bill: 88.1, st: 'At risk' },
  { id: 'GHV3', name: 'Global Hub v3', lead: 'Grace Okafor', people: 11, budget: 95000, spent: 40100, hrs: 780, bill: 97.0, st: 'On track' },
  { id: 'LAKE', name: 'Insights Lake', lead: 'Priya Natarajan', people: 5, budget: 48000, spent: 22600, hrs: 410, bill: 91.6, st: 'On track' },
  { id: 'CORE', name: 'Core Billing Services', lead: 'Javier Peña', people: 8, budget: 70000, spent: 71900, hrs: 1205, bill: 85.4, st: 'Over budget' },
  { id: 'OPS', name: 'Internal Ops', lead: 'Ana Gómez', people: 9, budget: 30000, spent: 14200, hrs: 520, bill: 0, st: 'Non-billable' }];
const PT = { 'On track': 'success', 'At risk': 'warning', 'Over budget': 'danger', 'Non-billable': 'neutral' };

function JiraIntegration({ notify }) {
  const [auto, setAuto] = React.useState(true); const [map, setMap] = React.useState(true);
  const sprint = [{ label: 'S19', a: 31.2 }, { label: 'S20', a: 33.8 }, { label: 'S21', a: 30.4 }, { label: 'S22', a: 36.1 }, { label: 'S23', a: 38.7 }, { label: 'S24', a: 44.9, hi: true }];
  return <Page>
    <PageHeader breadcrumbs={['Integrations', 'Jira Cloud Sync']} title="Jira Integration" status={<Badge tone="success" dot>Connected • globalhub.atlassian.net • Synced 2m ago</Badge>} actions={<><Button variant="secondary" icon="settings">Field Mapping</Button><Button icon="sync" onClick={() => notify('Full re-sync started — 1,284 worklogs')}>Sync Now</Button></>} />
    <Grid min={220}>
      <StatCard label="Worklogs this period" value="1,284" icon="list_alt" tone="accent" />
      <StatCard label="Hours reconciled" value="98.6%" icon="rule" tone="success" progress={98.6} />
      <StatCard label="Discrepancies" value="2" icon="sync_problem" tone="danger" />
      <StatCard label="Sprint 24 labor cost" value="$44.9k" icon="savings" delta="+16% vs S23" deltaTone="danger" />
    </Grid>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(300px,1fr)', gap: 20 }}>
      <Card icon="bar_chart" title="Sprint cost analytics" subtitle="Labor cost per sprint (thousands USD)"><BarChart data={sprint} height={200} format={v => '$' + v + 'k'} /></Card>
      <Card icon="settings_ethernet" title="Connection">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <KeyValue label="Site" value="globalhub.atlassian.net" mono aside={<Badge tone="success" size="sm">OAuth 2.0</Badge>} />
          <KeyValue label="Webhook" value="/hooks/jira/worklog" mono aside={<Badge tone="success" size="sm" dot>Live</Badge>} />
          <Toggle checked={auto} onChange={setAuto} label="Real-time worklog sync" description="Every 5m + webhook push" />
          <Toggle checked={map} onChange={setMap} label="Bi-directional mapping" description="Write approvals back to Jira as labels" />
        </div>
      </Card>
    </div>
    <Card icon="sync_problem" title="Reconciliation exceptions" bodyStyle={{ paddingTop: 14 }}>
      <DataTable density="compact" rows={[{ id: 1, e: EMPLOYEES[4], key: 'CORE-111', clock: 8, jira: 4, d: 'Apr 08' }, { id: 2, e: EMPLOYEES[11], key: 'LAKE-27', clock: 9, jira: 7.5, d: 'Apr 10' }]} columns={[
        { key: 'e', label: 'Employee', render: r => <EmployeeCell e={r.e} /> }, { key: 'd', label: 'Date' }, { key: 'key', label: 'Issue', render: r => <Badge mono size="sm" tone="primary">{r.key}</Badge> },
        { key: 'clock', label: 'Clock', align: 'right', render: r => fmtH(r.clock) }, { key: 'jira', label: 'Jira', align: 'right', render: r => fmtH(r.jira) },
        { key: 'v', label: 'Variance', align: 'right', render: r => <b style={{ color: 'var(--mgh-danger)' }}>−{fmtH(r.clock - r.jira)}</b> }, { key: 'a', label: '', align: 'right', render: () => <Button size="sm" variant="ghost">Resolve</Button> }]} />
    </Card>
  </Page>;
}

function Projects({ notify }) {
  const [chip, setChip] = React.useState('all');
  const t = useTable(PROJECTS.filter(p => chip === 'all' || p.st === chip), { search: ['name', 'id', 'lead'], pageSize: 10, initialSort: { key: 'spent', dir: 'desc' } });
  return <Page>
    <PageHeader breadcrumbs={['Integrations', 'Projects']} title="Projects" description="Labor budgets and billable utilization by Jira project." actions={<Button icon="add" onClick={() => notify('New project linked')}>Link Jira Project</Button>} />
    <Card padding={20}>
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search project, key, lead…" actions={<Button size="sm" variant="secondary" icon="download">Export</Button>}
        chips={<FilterChips value={chip} onChange={setChip} options={[{ value: 'all', label: 'All', count: PROJECTS.length }, { value: 'On track', label: 'On track' }, { value: 'At risk', label: 'At risk', count: 1, tone: 'warning' }, { value: 'Over budget', label: 'Over budget', count: 1, tone: 'danger' }]} />} />
      <DataTable style={{ marginTop: 14 }} sort={t.sort} onSort={t.setSort} rows={t.rows} columns={[
        { key: 'name', label: 'Project', sortable: true, render: r => <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Badge mono tone="dark">{r.id}</Badge><span style={{ font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{r.name}</span></div> },
        { key: 'lead', label: 'Lead', sortable: true }, { key: 'people', label: 'People', align: 'right', sortable: true },
        { key: 'hrs', label: 'Hours', align: 'right', sortable: true, render: r => r.hrs.toLocaleString() + 'h' },
        { key: 'spent', label: 'Budget used', sortable: true, width: 220, render: r => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ProgressBar style={{ flex: 1 }} value={r.spent / r.budget * 100} tone={r.spent > r.budget ? 'danger' : r.spent / r.budget > .85 ? 'warning' : 'primary'} /><span style={{ font: '600 12px var(--font-sans)', width: 40, textAlign: 'right' }}>{Math.round(r.spent / r.budget * 100)}%</span></div> },
        { key: 'bill', label: 'Billable', align: 'right', sortable: true, render: r => r.bill ? r.bill + '%' : '—' },
        { key: 'st', label: 'Health', render: r => <Badge size="sm" dot tone={PT[r.st]}>{r.st}</Badge> }]} />
    </Card>
  </Page>;
}

function Reports({ notify }) {
  const [rep, setRep] = React.useState('register');
  const t = useTable(EMPLOYEES, { search: ['name', 'id', 'dept'], pageSize: 8, initialSort: { key: 'gross', dir: 'desc' } });
  const tot = EMPLOYEES.reduce((s, e) => s + e.gross, 0);
  return <Page>
    <PageHeader breadcrumbs={['Insights', 'Reports & Register']} title="Executive Payroll Register" status={<Badge tone="primary">PP-2025-08 • All entities • USD</Badge>} actions={<><Button variant="secondary" icon="schedule_send">Schedule</Button><Button variant="dark" icon="download" onClick={() => notify('Register exported (XLSX)')}>Export Register</Button></>} />
    <Tabs value={rep} onChange={setRep} tabs={[{ value: 'register', label: 'Payroll Register' }, { value: 'labor', label: 'Labor Distribution' }, { value: 'tax', label: 'Tax Liability' }, { value: 'ot', label: 'Overtime Analysis' }, { value: 'jira', label: 'Billable vs Non-billable' }]} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}><MetricTile tone="white" label="Headcount" value={EMPLOYEES.length} /><MetricTile tone="white" label="Total hours" value={fmtH(EMPLOYEES.reduce((s, e) => s + e.total, 0))} /><MetricTile tone="white" label="Overtime" value={fmtH(EMPLOYEES.reduce((s, e) => s + e.ot, 0))} /><MetricTile tone="dark" label="Gross" value={fmt$(tot)} /></div>
    <Card padding={20}>
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Filter register…" filters={<><Select size="sm" icon="domain" options={['All entities', 'Dominicana SRL', 'USA Inc.', 'UK Ltd.']} /><Select size="sm" icon="payments" options={['USD', 'DOP', 'GBP']} /></>} actions={<Button size="sm" variant="secondary" icon="print">Print</Button>} />
      <DataTable style={{ marginTop: 14 }} maxHeight={520} density="compact" sort={t.sort} onSort={t.setSort} rows={t.rows} columns={[
        { key: 'id', label: 'ID', mono: true, sortable: true }, { key: 'name', label: 'Employee', sortable: true, strong: true, weight: 600 }, { key: 'dept', label: 'Dept', sortable: true },
        { key: 'reg', label: 'Reg h', align: 'right', sortable: true, render: r => r.reg.toFixed(1) }, { key: 'ot', label: 'OT h', align: 'right', sortable: true, render: r => r.ot.toFixed(1) },
        { key: 'rate', label: 'Rate', align: 'right', sortable: true, render: r => fmt$(r.rate) }, { key: 'gross', label: 'Gross', align: 'right', sortable: true, strong: true, render: r => fmt$(r.gross) },
        { key: 'tax', label: 'Tax', align: 'right', render: r => fmt$(r.gross * .209) }, { key: 'net', label: 'Net', align: 'right', strong: true, weight: 700, render: r => fmt$(r.gross * .791) }]} />
      <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="rows" />
    </Card>
  </Page>;
}

function Administration({ notify }) {
  const users = [{ id: 1, e: { name: 'Elena Rostova', avatar: AVATARS + 'elena-rostova.jpg', role: 'elena@globalhub.com' }, r: 'Lead PM & Approver', ent: 'All', mfa: true, last: '2m ago' }, { id: 2, e: { name: 'Marcus Vance', role: 'marcus@globalhub.com' }, r: 'Supervisor', ent: 'Dominicana SRL', mfa: true, last: '1h ago' }, { id: 3, e: { name: 'Ana Gómez', role: 'ana@globalhub.com' }, r: 'HR Finance Admin', ent: 'All', mfa: true, last: 'Yesterday' }, { id: 4, e: { name: 'Luis Cabrera', avatar: AVATARS + 'person-4.jpg', role: 'luis@globalhub.com' }, r: 'Payroll Specialist', ent: 'Dominicana SRL', mfa: false, last: '3d ago' }];
  const [sel, setSel] = React.useState([]);
  return <Page>
    <PageHeader breadcrumbs={['System', 'Administration']} title="Administration" description="Operating entities, users, roles and approval governance." actions={<Button icon="person_add" onClick={() => notify('Invite sent')}>Invite User</Button>} />
    <Grid min={260}>{[['My Global Hub Dominicana SRL', 'Punta Cana HQ • DOP / USD', 54, 'HQ'], ['My Global Hub USA Inc.', 'Austin, TX • USD', 21, 'Branch'], ['My Global Hub UK Ltd.', 'London • GBP', 11, 'Branch']].map(([n, s, c, tag]) => <Card key={n} padding={20}><div style={{ display: 'flex', justifyContent: 'space-between' }}><Icon name="domain" size={18} color="var(--mgh-primary)" /><Badge size="sm" tone={tag === 'HQ' ? 'primary' : 'neutral'}>{tag}</Badge></div><div className="mgh-lg" style={{ marginTop: 10 }}>{n}</div><div className="mgh-body">{s}</div><div style={{ marginTop: 10, font: '700 13px var(--font-sans)', color: 'var(--mgh-ink)' }}>{c} employees</div></Card>)}</Grid>
    <Card icon="group" title="Users & roles" bodyStyle={{ paddingTop: 14 }}>
      <DataTable selectable selected={sel} onSelectedChange={setSel} bulkBar={<><Button size="sm" variant="secondary" icon="key">Require MFA</Button><Button size="sm" variant="danger" icon="block">Suspend</Button></>} rows={users} columns={[
        { key: 'e', label: 'User', render: r => <EmployeeCell e={r.e} /> }, { key: 'r', label: 'Role', render: r => <Badge size="sm" tone="primary">{r.r}</Badge> }, { key: 'ent', label: 'Entity scope' },
        { key: 'mfa', label: 'MFA', render: r => <Badge size="sm" dot tone={r.mfa ? 'success' : 'danger'}>{r.mfa ? 'Enabled' : 'Missing'}</Badge> }, { key: 'last', label: 'Last active' }, { key: 'x', label: '', align: 'right', render: () => <IconButton icon="more_vert" size={28} title="More" /> }]} />
    </Card>
    <Card icon="account_tree" title="Approval workflow policy" subtitle="Multi-tier, multi-role clearance applied to every bi-weekly timesheet">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}><KeyValue label="Tier 1" value="Direct supervisor" /><KeyValue label="Tier 2" value="Project manager (Jira lead)" /><KeyValue label="Tier 3" value="HR review" /><KeyValue label="Escalation" value="OT > 10h → VP sign-off" aside={<Badge size="sm" tone="warning">Rule</Badge>} /></div>
    </Card>
  </Page>;
}

function CompanySettings({ notify }) {
  const [tab, setTab] = React.useState('general'); const [s, setS] = React.useState({ ot: true, esig: true, lock: true, weekend: false });
  const tg = k => v => setS(x => ({ ...x, [k]: v }));
  return <Page style={{ maxWidth: 1100 }}>
    <PageHeader breadcrumbs={['System', 'Company Settings']} title="Company Settings" actions={<><Button variant="outline">Discard</Button><Button icon="save" onClick={() => notify('Settings saved')}>Save Changes</Button></>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ value: 'general', label: 'General' }, { value: 'pay', label: 'Pay Schedule' }, { value: 'time', label: 'Time & Overtime' }, { value: 'notif', label: 'Notifications' }, { value: 'sec', label: 'Security' }]} />
    <Card icon="apartment" title="Company profile">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}><TextField label="Legal name" value="My Global Hub Dominicana SRL" /><TextField label="RNC (Tax ID)" value="1-31-88421-7" mono /><TextField label="Headquarters" value="Punta Cana, La Altagracia, DR" /><TextField label="Base currency" value="USD" suffix="Multi-currency" /></div>
    </Card>
    <Card icon="event_repeat" title="Pay schedule">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}><Select label="Frequency" options={['Bi-weekly (26 / yr)', 'Semi-monthly', 'Monthly']} /><Select label="Period start" options={['Monday', 'Sunday']} /><TextField label="Submission deadline" value="Day 14, 17:00" /><TextField label="Pay date offset" value="5" suffix="days" /></div>
    </Card>
    <Card icon="rule" title="Time & approval rules">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Toggle checked={s.ot} onChange={tg('ot')} label="Require pre-authorization for overtime" description="Overtime over 44h/week must be approved before it is logged." />
        <Toggle checked={s.esig} onChange={tg('esig')} label="Electronic signature on approval" description="Approvers sign each decision; signatures are hashed into the audit log." />
        <Toggle checked={s.lock} onChange={tg('lock')} label="Auto-lock period after Finance Run" description="Prevents edits once disbursement is batched." />
        <Toggle checked={s.weekend} onChange={tg('weekend')} label="Allow weekend time entry" description="Sunday hours are paid at double rate." />
      </div>
    </Card>
  </Page>;
}

function AuditLog() {
  const ev = [['09:14:02', 'Compliance Engine', 'bank.route.verified', 'MGH-1042 • Banco BHD León', 'success'], ['09:12:47', 'Elena Rostova', 'timesheet.approved', 'MGH-0975 • PP-2025-08', 'success'], ['09:02:10', 'Jira Webhook', 'worklog.synced', 'ATLAS-3482 • 8.5h', 'info'], ['08:58:31', 'Ana Gómez', 'tariff.updated', 'OT threshold 40h → 44h', 'warning'], ['08:41:05', 'System', 'auth.mfa.failed', 'luis@globalhub.com • 186.6.x.x', 'danger'], ['08:30:00', 'Scheduler', 'period.opened', 'PP-2025-09', 'neutral'], ['08:12:44', 'Marcus Vance', 'timesheet.returned', 'MGH-1120 • Jira variance', 'warning'], ['07:55:19', 'API Key mgh_live_7f…', 'webhook.created', 'payroll.locked → erp.globalhub.com', 'info'], ['07:40:02', 'Elena Rostova', 'session.login', 'Chrome • Punta Cana, DR', 'neutral'], ['07:12:30', 'Compliance Engine', 'ledger.hash.verified', 'Block #88214 • SHA-256 OK', 'success']].map(([time, actor, action, target, tone], i) => ({ id: i, time, actor, action, target, tone, hash: (0x9f3a2c + i * 7919).toString(16) + '…' + (0xb81d + i * 131).toString(16) }));
  const [chip, setChip] = React.useState('all');
  const t = useTable(ev.filter(e => chip === 'all' || e.tone === chip), { search: ['actor', 'action', 'target'], pageSize: 10 });
  return <Page>
    <PageHeader breadcrumbs={['System', 'Audit Log']} title="Audit Log" status={<Badge tone="success" icon="verified">Tamper-evident • Hash chain intact</Badge>} actions={<Button variant="dark" icon="download">Export Evidence Pack</Button>} />
    <Card padding={20}>
      <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search actor, event, target…" filters={<><Select size="sm" icon="calendar_month" options={['Today', 'Last 7 days', 'This period']} /><Select size="sm" icon="person" options={['All actors', 'Users', 'System', 'API keys']} /></>}
        chips={<FilterChips value={chip} onChange={setChip} options={[{ value: 'all', label: 'All events', count: ev.length }, { value: 'success', label: 'Verified' }, { value: 'warning', label: 'Changes' }, { value: 'danger', label: 'Security', count: 1, tone: 'danger' }]} />} />
      <DataTable style={{ marginTop: 14 }} maxHeight={560} density="compact" rows={t.rows} columns={[
        { key: 'time', label: 'Timestamp (AST)', mono: true }, { key: 'actor', label: 'Actor', strong: true, weight: 600 },
        { key: 'action', label: 'Event', render: r => <Badge mono size="sm" tone={r.tone === 'neutral' ? 'neutral' : r.tone}>{r.action}</Badge> }, { key: 'target', label: 'Target' },
        { key: 'hash', label: 'Ledger hash', mono: true, render: r => <span style={{ color: 'var(--mgh-ink-3)' }}>{r.hash}</span> }]} />
      <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="events" />
    </Card>
  </Page>;
}

window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { jira: JiraIntegration, projects: Projects, reports: Reports, admin: Administration, settings: CompanySettings, audit: AuditLog });

})();

// ---- ScreensContractors.jsx ----
(function(){
const { Button, IconButton, Badge, Avatar, Icon, Card, FilterChips, StatCard, DataTable, TableToolbar, Pagination, Tabs, PageHeader, Select, KeyValue, Stepper, TextField } = window.MyGlobalHubDesignSystem_2a603d;

const CONTRACTORS = [
  { id: 'CTR-0101', name: 'Juan Pérez', country: 'Venezuela', email: 'juan.perez@proton.me', phone: '+58 412 555 0181', start: 'Feb 01, 2025', end: '', basis: 'Hourly', rate: 10, cur: 'USD', method: 'Coinbase', wallet: '0x4A7c…9E21', walletFull: '0x4A7cB1d93E0f6a2C58b17D0e9F3a5c6B2d8E9E21', asset: 'USDC', network: 'Base', role: 'QA Tester', st: 'Active' },
  { id: 'CTR-0102', name: 'María Fernández', country: 'Venezuela', email: 'mfernandez@gmail.com', phone: '+58 414 555 0127', start: 'Nov 15, 2024', end: '', basis: 'Hourly', rate: 14, cur: 'USD', method: 'Coinbase', wallet: 'maria.f@coinbase', walletFull: 'maria.fernandez@coinbase.com', asset: 'USDC', network: 'Base', role: 'Frontend Developer', st: 'Active' },
  { id: 'CTR-0103', name: 'Diego Salazar', country: 'Venezuela', email: 'dsalazar@outlook.com', phone: '+58 424 555 0163', start: 'Jan 06, 2025', end: 'Dec 31, 2025', basis: 'Hourly', rate: 12, cur: 'USD', method: 'Coinbase', wallet: '0x91fE…04Ac', walletFull: '0x91fE27c4b8D03a5E6f1C9b2A7d4E8f0C3b5904Ac', asset: 'USDC', network: 'Polygon', role: 'Data Analyst', st: 'Active' },
  { id: 'CTR-0104', name: 'Andrés Rojas', country: 'Colombia', email: 'andres.rojas@gmail.com', phone: '+57 310 555 0144', start: 'Sep 02, 2024', end: '', basis: 'Hourly', rate: 18, cur: 'USD', method: 'Coinbase', wallet: '0x2bD8…7f13', walletFull: '0x2bD8e5A1c0F94b3D7a6E2c8B1f5D0a9C4e3b7f13', asset: 'USDC', network: 'Base', role: 'Backend Developer', st: 'Active' },
  { id: 'CTR-0105', name: 'Lucía Torres', country: 'Argentina', email: 'lucia.torres@proton.me', phone: '+54 911 5555 0102', start: 'Mar 10, 2025', end: '', basis: 'Fixed Monthly', rate: 2400, cur: 'USD', method: 'Coinbase', wallet: '0x7Ce0…a5B9', walletFull: '0x7Ce0b3F8d1A24c6E9b5D7f0A3c2E8b1D4f6aa5B9', asset: 'USDC', network: 'Ethereum', role: 'Product Designer', st: 'Active' },
  { id: 'CTR-0106', name: 'Camila Ortiz', country: 'Peru', email: 'camila.ortiz@gmail.com', phone: '+51 987 555 012', start: 'Jun 01, 2024', end: 'Mar 31, 2025', basis: 'Hourly', rate: 16, cur: 'USD', method: 'Coinbase', wallet: '0x5aF3…c8D2', walletFull: '0x5aF3d7B2e9C04a1F6b8D3e5A7c0F2b9D1e4cc8D2', asset: 'USDC', network: 'Base', role: 'Content Writer', st: 'Ended' },
];
const HOURS = { 'CTR-0101': 80, 'CTR-0102': 76, 'CTR-0103': 80, 'CTR-0104': 72, 'CTR-0105': 0 };
const FLOW = ['Timesheet', 'Manager Approval', 'Calculate Amount', 'Create Payment', 'Approve Payment', 'Send via Coinbase', 'Record Tx ID', 'Paid'];
const PST = ['Calculated', 'Pending Approval', 'Approved', 'Sent', 'Paid'];
const PTONE = { Calculated: 'neutral', 'Pending Approval': 'warning', Approved: 'info', Sent: 'info', Paid: 'success' };
const hex = (seed, n) => { let s = '', x = seed; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) % 2147483648; s += (x % 16).toString(16); } return s; };
const amountOf = c => c.basis === 'Fixed Monthly' ? c.rate / 2 : (HOURS[c.id] || 0) * c.rate;
const INIT_PAYMENTS = CONTRACTORS.filter(c => c.st === 'Active').map((c, i) => {
  const st = ['Paid', 'Paid', 'Sent', 'Approved', 'Pending Approval'][i];
  const amt = amountOf(c); const fee = c.network === 'Ethereum' ? 1.84 : c.network === 'Polygon' ? 0.02 : 0.01;
  const sent = st === 'Paid' || st === 'Sent';
  return { id: 'CPAY-2025-08-' + String(i + 1).padStart(3, '0'), cid: c.id, c, period: 'PP-2025-08', hours: c.basis === 'Fixed Monthly' ? null : HOURS[c.id], amount: amt, fee, status: st,
    date: sent ? 'Apr 19, 2025' : '', cbId: sent ? 'CB-' + hex(i + 7, 8).toUpperCase() : '', hash: sent ? '0x' + hex(i + 31, 64) : '', notes: st === 'Paid' ? 'Confirmed on-chain. Contractor acknowledged receipt.' : '' };
});
const fmtUSD = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const explorer = (net, h) => ({ Base: 'https://basescan.org/tx/', Ethereum: 'https://etherscan.io/tx/', Polygon: 'https://polygonscan.com/tx/' }[net] || '#') + h;

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

function ReceiptDrop({ pid, notify }) {
  const KEY = 'mgh-contractor-receipts';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const [all, setAll] = React.useState(load); const [hot, setHot] = React.useState(false); const inp = React.useRef();
  const f = all[pid];
  const save = next => { setAll(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { notify('File too large to persist — kept for this session'); } };
  const attach = file => {
    if (!file) return;
    if (!/^(image\/|application\/pdf)/.test(file.type)) { notify('Upload a PDF, PNG or JPG receipt'); return; }
    if (file.size > 5 * 1024 * 1024) { notify('Max file size is 5 MB'); return; }
    const r = new FileReader();
    r.onload = () => { save({ ...all, [pid]: { name: file.name, type: file.type, size: file.size, data: r.result, at: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } }); notify('Coinbase receipt attached • ' + pid); };
    r.readAsDataURL(file);
  };
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
  return <div>
    {f ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, background: 'var(--mgh-surface-1)' }}>
      {f.type.startsWith('image/') ? <img src={f.data} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} /> : <span style={{ width: 40, height: 40, borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="picture_as_pdf" size={20} color="var(--mgh-danger)" /></span>}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <a href={f.data} target="_blank" download={f.name} style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{f.name}</a>
        <span style={{ font: '400 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{kb(f.size)} • {f.at}</span>
      </div>
      <IconButton icon="swap_horiz" title="Replace" onClick={() => inp.current.click()} />
      <IconButton icon="delete" title="Remove" onClick={() => { const n = { ...all }; delete n[pid]; save(n); }} />
    </div>
    : <div role="button" tabIndex={0} onClick={() => inp.current.click()} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inp.current.click()}
        onDragOver={e => { e.preventDefault(); setHot(true); }} onDragLeave={() => setHot(false)} onDrop={e => { e.preventDefault(); setHot(false); attach(e.dataTransfer.files[0]); }}
        style={{ padding: '16px 12px', borderRadius: 8, border: '1.5px dashed ' + (hot ? 'var(--mgh-primary)' : 'var(--mgh-surface-4)'), background: hot ? 'var(--mgh-primary-50)' : 'var(--mgh-surface-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', textAlign: 'center', transition: 'all 160ms cubic-bezier(.2,0,0,1)' }}>
      <Icon name="upload_file" size={20} color="var(--mgh-primary)" />
      <span style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>Drop Coinbase receipt or <span style={{ color: 'var(--mgh-primary)' }}>browse</span></span>
      <span style={{ font: '400 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>PDF, PNG or JPG • Max 5 MB</span>
    </div>}
    <input ref={inp} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={e => { attach(e.target.files[0]); e.target.value = ''; }} />
  </div>;
}

function Contractors({ go, notify }) {
  const [tab, setTab] = React.useState('contractors'); const [chip, setChip] = React.useState('all');
  const [cur, setCur] = React.useState(CONTRACTORS[0].id);
  const base = CONTRACTORS.filter(c => chip === 'all' || c.st === chip);
  const t = useTable(base, { search: ['name', 'id', 'country', 'role'], pageSize: 10 });
  const c = CONTRACTORS.find(x => x.id === cur);
  const rateTxt = x => x.basis === 'Fixed Monthly' ? fmtUSD(x.rate) + ' / mo' : fmtUSD(x.rate) + ' / hr';
  const active = CONTRACTORS.filter(x => x.st === 'Active');
  return <Page>
    <PageHeader breadcrumbs={['Contractors', tab === 'contractors' ? 'Directory' : 'Contracts']} title="Contractors" description="Independent contractors paid against invoices and approved timesheets — no employee payroll, withholdings or TSS." actions={<><Button variant="secondary" icon="payments" onClick={() => go('contractorPayments')}>Payments</Button><Button icon="person_add" onClick={() => notify('New contractor draft created')}>Add Contractor</Button></>} />
    <Grid min={200}>
      <StatCard label="Active contractors" value={active.length} unit={'/ ' + CONTRACTORS.length} icon="badge" style={{ minHeight: 0 }} />
      <StatCard label="Countries" value={new Set(active.map(x => x.country)).size} icon="public" tone="accent" style={{ minHeight: 0 }} />
      <StatCard label="Due PP-2025-08" value={fmtUSD(active.reduce((s, x) => s + amountOf(x), 0))} unit="USD" icon="request_quote" tone="warning" style={{ minHeight: 0 }} />
      <StatCard label="Paid in USDC" value="100%" icon="currency_bitcoin" tone="success" style={{ minHeight: 0 }} />
    </Grid>
    <Tabs value={tab} onChange={setTab} tabs={[{ value: 'contractors', label: 'Contractors' }, { value: 'contracts', label: 'Contracts' }]} />
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <Card padding={20} style={{ flex: '1 1 520px', minWidth: 0 }}>
        <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search name, ID, country…" chips={<FilterChips value={chip} onChange={setChip} options={[{ value: 'all', label: 'All', count: CONTRACTORS.length }, { value: 'Active', label: 'Active', count: active.length }, { value: 'Ended', label: 'Ended' }]} />} />
        <DataTable style={{ marginTop: 14 }} rows={t.rows} onRowClick={r => setCur(r.id)} activeRow={cur} columns={tab === 'contractors' ? [
          { key: 'name', label: 'Contractor', render: r => <PersonCell c={r} sub={r.id + ' • ' + r.role} /> },
          { key: 'country', label: 'Country' },
          { key: 'rate', label: 'Rate', align: 'right', render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{rateTxt(r)}</span> },
          { key: 'asset', label: 'Payout', render: r => <span style={{ display: 'flex', gap: 4 }}><Badge size="sm" tone="primary">{r.asset}</Badge><Badge size="sm" tone="neutral">{r.network}</Badge></span> },
          { key: 'st', label: 'Status', render: r => <Badge size="sm" dot tone={r.st === 'Active' ? 'success' : 'neutral'}>{r.st}</Badge> }] : [
          { key: 'name', label: 'Contractor', render: r => <PersonCell c={r} sub={r.country} /> },
          { key: 'basis', label: 'Basis' },
          { key: 'start', label: 'Start' },
          { key: 'end', label: 'End', render: r => r.end || '—' },
          { key: 'rate', label: 'Rate', align: 'right', render: r => rateTxt(r) },
          { key: 'cur', label: 'Currency', mono: true }]} />
        <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="contractors" />
      </Card>
      <Card padding={20} style={{ flex: '1 1 320px', maxWidth: 400, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Avatar name={c.name} size={48} /><div style={{ flex: 1, minWidth: 0 }}><div className="mgh-h3">{c.name}</div><div className="mgh-body">{c.role} • {c.country}</div></div><Badge mono tone="dark">{c.id}</Badge></div>
          <Section icon="person" title="Personal information"><KeyValue label="Email" value={c.email} /><KeyValue label="Phone" value={c.phone} mono /><KeyValue label="Country" value={c.country} /></Section>
          <Section icon="contract" title="Contract"><KeyValue label="Start date" value={c.start} /><KeyValue label="End date" value={c.end || 'Open-ended'} /><KeyValue label={c.basis === 'Fixed Monthly' ? 'Fixed monthly fee' : 'Hourly rate'} value={rateTxt(c)} /><KeyValue label="Contract currency" value={c.cur} mono /></Section>
          <Section icon="account_balance_wallet" title="Payment"><KeyValue label="Method" value={c.method} /><KeyValue label={c.walletFull.includes('@') ? 'Coinbase email' : 'Wallet address'} value={c.wallet} mono /><KeyValue label="Preferred currency" value={c.asset} aside={c.asset === 'USDC' && <Badge size="sm" tone="success">Recommended</Badge>} /><KeyValue label="Network" value={c.network} /></Section>
          <div style={{ display: 'flex', gap: 8 }}><Button variant="secondary" icon="edit" style={{ flex: 1 }} onClick={() => notify('Editing ' + c.name)}>Edit</Button><Button icon="receipt_long" style={{ flex: 1 }} onClick={() => go('contractorPayments')}>Payment History</Button></div>
        </div>
      </Card>
    </div>
  </Page>;
}

function ContractorPayments({ notify }) {
  const [pays, setPays] = React.useState(() => INIT_PAYMENTS.map(p => ({ ...p })));
  const [chip, setChip] = React.useState('all'); const [cur, setCur] = React.useState(pays[0].id); const [txDraft, setTxDraft] = React.useState({ cb: '', hash: '' });
  const t = useTable(pays.filter(p => chip === 'all' || p.status === chip), { search: ['id', 'cid'], pageSize: 10 });
  const p = pays.find(x => x.id === cur); const c = p.c;
  const upd = (id, patch) => setPays(ps => ps.map(x => x.id === id ? { ...x, ...patch } : x));
  const stepIdx = { Calculated: 3, 'Pending Approval': 4, Approved: 5, Sent: 6, Paid: 8 }[p.status];
  const steps = FLOW.map((l, i) => ({ label: l, state: i < stepIdx ? 'done' : i === stepIdx ? 'current' : 'todo' }));
  const action = {
    Calculated: { label: 'Create Payment', icon: 'add_card', run: () => { upd(p.id, { status: 'Pending Approval' }); notify('Payment created • awaiting approval'); } },
    'Pending Approval': { label: 'Approve Payment', icon: 'task_alt', run: () => { upd(p.id, { status: 'Approved' }); notify('Payment approved • ' + fmtUSD(p.amount)); } },
    Approved: { label: 'Send via Coinbase', icon: 'send_money', run: () => { upd(p.id, { status: 'Sent', date: 'Apr 19, 2025' }); setTxDraft({ cb: '', hash: '' }); notify('Sent ' + fmtUSD(p.amount) + ' ' + c.asset + ' on ' + c.network); } },
    Sent: { label: 'Record Transaction & Mark Paid', icon: 'verified', run: () => { const cb = p.cbId || txDraft.cb, hash = p.hash || txDraft.hash; if (!cb || !hash) { notify('Enter the Coinbase transaction ID and hash'); return; } upd(p.id, { status: 'Paid', cbId: cb, hash }); notify('Payment recorded as Paid'); } },
  }[p.status];
  const tot = s => pays.filter(x => !s || s.includes(x.status)).reduce((a, x) => a + x.amount, 0);
  return <Page>
    <PageHeader breadcrumbs={['Contractors', 'Payments']} title="Contractor Payments" status={<Badge tone="info" dot>PP-2025-08 • Coinbase Business • USDC</Badge>} actions={<Button variant="secondary" icon="download" onClick={() => notify('Payment register exported')}>Export</Button>} />
    <Grid min={200}>
      <StatCard label="Total due" value={fmtUSD(tot())} unit="USD" icon="request_quote" style={{ minHeight: 0 }} />
      <StatCard label="Awaiting approval" value={pays.filter(x => x.status === 'Pending Approval').length} icon="hourglass_top" tone="warning" style={{ minHeight: 0 }} />
      <StatCard label="In flight" value={fmtUSD(tot(['Approved', 'Sent']))} icon="send_money" tone="accent" style={{ minHeight: 0 }} />
      <StatCard label="Paid" value={fmtUSD(tot(['Paid']))} icon="task_alt" tone="success" style={{ minHeight: 0 }} />
    </Grid>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <Card padding={20} style={{ flex: '1 1 520px', minWidth: 0 }}>
        <TableToolbar search={t.q} onSearch={t.setQ} placeholder="Search payment or contractor ID…" chips={<FilterChips value={chip} onChange={setChip} options={[{ value: 'all', label: 'All', count: pays.length }, ...PST.filter(s => s !== 'Calculated').map(s => ({ value: s, label: s, count: pays.filter(x => x.status === s).length }))]} />} />
        <DataTable style={{ marginTop: 14 }} rows={t.rows} onRowClick={r => setCur(r.id)} activeRow={cur} columns={[
          { key: 'cid', label: 'Contractor', render: r => <PersonCell c={r.c} sub={r.id} /> },
          { key: 'country', label: 'Country', render: r => r.c.country },
          { key: 'hours', label: 'Hours', align: 'right', render: r => r.hours == null ? 'Fixed' : r.hours.toFixed(1) },
          { key: 'rate', label: 'Rate', align: 'right', render: r => r.c.basis === 'Fixed Monthly' ? fmtUSD(r.c.rate) + '/mo' : fmtUSD(r.c.rate) },
          { key: 'amount', label: 'Amount', align: 'right', weight: 700, render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(r.amount)}</span> },
          { key: 'via', label: 'Paid via', render: r => 'Coinbase' },
          { key: 'status', label: 'Status', render: r => <Badge size="sm" dot tone={PTONE[r.status]}>{r.status}</Badge> }]} />
        <Pagination style={{ marginTop: 14 }} page={t.page} pageSize={t.pageSize} total={t.total} onPage={t.setPage} noun="payments" />
      </Card>
      <Card padding={20} style={{ flex: '1 1 320px', maxWidth: 400, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <PersonCell c={c} sub={c.country + ' • ' + c.role} />
            <Badge dot tone={PTONE[p.status]}>{p.status}</Badge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: 14, borderRadius: 8, background: 'var(--mgh-navy)', color: '#fff' }}>
            <div><div className="mgh-overline" style={{ color: 'var(--mgh-nav-text)' }}>Amount sent</div><div style={{ font: '600 11px/14px var(--font-mono)', color: 'var(--mgh-nav-text)', marginTop: 2 }}>{p.id}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ font: '800 26px/30px var(--font-sans)', letterSpacing: '-0.5px' }}>{fmtUSD(p.amount)}</div><div style={{ font: '600 11px/14px var(--font-sans)', color: 'var(--mgh-nav-text)' }}>{p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {c.asset} • {c.network}</div></div>
          </div>
          <div style={{ overflowX: 'auto' }}><Stepper steps={steps} style={{ minWidth: 560 }} /></div>
          <Section icon="receipt_long" title="Transaction">
            <KeyValue label="Payment date" value={p.date || '—'} />
            <KeyValue label="Coinbase transaction ID" value={p.cbId || '—'} mono />
            <KeyValue label="Blockchain tx hash" value={p.hash ? p.hash.slice(0, 10) + '…' + p.hash.slice(-6) : '—'} mono aside={p.hash && <a href={explorer(c.network, p.hash)} target="_blank" style={{ display: 'flex' }}><Icon name="open_in_new" size={16} color="var(--mgh-primary)" /></a>} />
            <KeyValue label="Wallet address" value={c.wallet} mono />
            <KeyValue label="Network" value={c.network} />
            <KeyValue label="Network fee" value={fmtUSD(p.fee)} aside={<Badge size="sm" tone="neutral">Company-paid</Badge>} />
          </Section>
          {p.status === 'Sent' && !p.hash && <div style={{ display: 'grid', gap: 10 }}>
            <TextField label="Coinbase transaction ID" mono value={txDraft.cb} onChange={v => setTxDraft(d => ({ ...d, cb: typeof v === 'string' ? v : v.target.value }))} placeholder="CB-…" />
            <TextField label="Blockchain transaction hash" mono value={txDraft.hash} onChange={v => setTxDraft(d => ({ ...d, hash: typeof v === 'string' ? v : v.target.value }))} placeholder="0x…" />
          </div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="attach_file" size={16} color="var(--mgh-primary)" /><span className="mgh-overline">Supporting document</span></div>
            <ReceiptDrop key={p.id} pid={p.id} notify={notify} />
          </div>
          <Section icon="menu_book" title="Accounting entry">
            <KeyValue label="Debit • Contractor Expense" value={fmtUSD(p.amount)} />
            <KeyValue label="Credit • Coinbase USDC Wallet" value={fmtUSD(p.amount)} />
            <KeyValue label="Debit • Network Fees" value={fmtUSD(p.fee)} />
          </Section>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="mgh-overline">Notes</span>
            <textarea value={p.notes} onChange={e => upd(p.id, { notes: e.target.value })} rows={3} placeholder="Add a note for the payment record…" style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink)', padding: 10, borderRadius: 8, border: 'none', boxShadow: 'inset 0 0 0 1px var(--mgh-surface-3)', resize: 'vertical', outline: 'none' }} />
          </label>
          {action && <Button icon={action.icon} onClick={action.run} style={{ width: '100%' }}>{action.label}</Button>}
        </div>
      </Card>
    </div>
  </Page>;
}

window.__MGH_KIT = Object.assign(window.__MGH_KIT || {}, { contractors: Contractors, contractorPayments: ContractorPayments });

})();

function KitScreen({ route, go, notify, empId }) {
  const fix = v => typeof v === 'string' ? v.replace(/(\.\.\/)+assets\//g, 'assets/') : v;
  window.AVATARS = 'assets/avatars/';
  (window.EMPLOYEES || []).forEach(e => { e.avatar = fix(e.avatar); });
  const K = window.__MGH_KIT || {}; const S = K[route] || K.dashboard;
  return <div style={{ background: '#fff', minHeight: '100%' }}><S go={go} notify={notify} empId={empId} /></div>;
}
module.exports = { KitScreen };
