/* MGH Timekeeping — Attendance engine (prototype). Single source for punches, daily status, exceptions,
   leave and holidays. My Time Entry writes punches here; Timekeeping/Reports read from here. */
(function () {
  if (window.MGH_ATT) return;
  const LS = { rules: 'mgh-att-rules', ex: 'mgh-att-ex', leave: 'mgh-att-leave', hol: 'mgh-att-hol', ovr: 'mgh-att-ovr', alerted: 'mgh-att-alerted' };
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const WF = () => window.MGH_WF;
  const TODAY = '2025-04-15', NOW_MIN = 9 * 60 + 15;
  const tm = s => { if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0');
  const iso = d => d.toISOString().slice(0, 10);
  const D = s => new Date(s + 'T00:00:00Z');
  const addD = (s, n) => iso(new Date(D(s).getTime() + n * 864e5));
  const dow = s => D(s).getUTCDay();
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

  const DEFAULT_RULES = { start: '08:30', shift: 8, grace: 10, maxLate: 30, minLunch: 30, maxHours: 12, autoLunch: true, flexible: false };
  const ORGS = ['MGH Dominicana SRL', 'MGH USA Inc.', 'MGH UK Ltd.'];
  const SEED_HOL = [
    ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-01-01', "New Year's Day", true, false], ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-01-06', 'Epiphany', true, false],
    ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-01-21', 'Our Lady of Altagracia', true, false], ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-01-27', 'Duarte Day (observed)', true, false],
    ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-02-27', 'Independence Day', true, false], ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-04-18', 'Good Friday', true, false],
    ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-05-05', 'Labor Day (observed)', true, false], ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-06-19', 'Corpus Christi', true, false],
    ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-08-16', 'Restoration Day', true, false], ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-09-24', 'Our Lady of Mercedes', true, false],
    ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-11-10', 'Constitution Day (observed)', true, false], ['MGH Dominicana SRL', 'Dominican Republic', 'National', '2025-12-25', 'Christmas Day', true, false],
    ['MGH USA Inc.', 'United States', 'Federal', '2025-01-01', "New Year's Day", true, false], ['MGH USA Inc.', 'United States', 'Federal', '2025-05-26', 'Memorial Day', true, false],
    ['MGH USA Inc.', 'United States', 'Federal', '2025-07-04', 'Independence Day', true, false], ['MGH USA Inc.', 'United States', 'Federal', '2025-09-01', 'Labor Day', true, false],
    ['MGH USA Inc.', 'United States', 'Federal', '2025-11-27', 'Thanksgiving', true, false], ['MGH USA Inc.', 'United States', 'Federal', '2025-12-25', 'Christmas Day', true, false],
    ['MGH UK Ltd.', 'United Kingdom', 'England', '2025-04-18', 'Good Friday', true, false], ['MGH UK Ltd.', 'United Kingdom', 'England', '2025-04-21', 'Easter Monday', true, false],
    ['MGH UK Ltd.', 'United Kingdom', 'England', '2025-05-05', 'Early May bank holiday', true, false], ['MGH UK Ltd.', 'United Kingdom', 'England', '2025-12-25', 'Christmas Day', true, false],
  ].map((h, i) => ({ id: 'H' + (i + 1), org: h[0], country: h[1], region: h[2], date: h[3], desc: h[4], paid: h[5], working: h[6] }));
  const LEAVE_TYPES = ['Vacation', 'Sick', 'Personal', 'Bereavement', 'Jury Duty', 'Maternity', 'Paternity', 'Unpaid'];
  const SEED_LEAVE = [];

  let rulesMap = (() => { const r = load(LS.rules, {}); return r && r.shift != null ? { '*': r } : (r || {}); })();
  const rulesFor = org => ({ ...DEFAULT_RULES, ...(rulesMap['*'] || {}), ...((org && rulesMap[org]) || {}) });
  let rules = rulesFor('*');
  let exState = load(LS.ex, {});
  let leave = load(LS.leave, null) || SEED_LEAVE;
  let hol = load(LS.hol, null) || SEED_HOL;
  let ovr = load(LS.ovr, {});
  let roster = [];
  const fire = () => window.dispatchEvent(new Event('mgh-att'));
  const persist = () => { save(LS.rules, rulesMap); save(LS.ex, exState); save(LS.leave, leave); save(LS.hol, hol); save(LS.ovr, ovr); };
  const actor = () => WF() ? WF().person() : 'User', role = () => window.MGH_RBAC ? window.MGH_RBAC.role : 'Admin', can = (p, t) => !window.MGH_RBAC || window.MGH_RBAC.can(p, t);
  const audit = (a, t, tone) => { if (WF()) WF().log(a, actor(), t, tone || 'info'); };
  const alert = (roles, text, ref) => { if (WF() && WF().alert) WF().alert(roles, text, ref); };

  function genPunch(e, d) {
    return { in: '', lo: '', li: '', out: '', mode: 'office' };
  }
  const holidayOn = (e, d) => hol.find(h => h.date === d && h.org === (e.entity || ORGS[0]));
  const leaveOn = (emp, d) => leave.find(l => l.emp === emp && l.status === 'Approved' && d >= l.from && d <= l.to);

  function day(e, d) {
    const rules = rulesFor(e.entity);
    const wk = dow(d), weekend = wk === 0 || wk === 6, future = d > TODAY, today = d === TODAY;
    const h = holidayOn(e, d), lv = leaveOn(e.id, d), key = e.id + '|' + d;
    const base = weekend || future ? { in: '', lo: '', li: '', out: '', mode: 'office' } : genPunch(e, d);
    const p = { ...base, ...(ovr[key] || {}) };
    const a = tm(p.in), b = tm(p.out), lo = tm(p.lo), li = tm(p.li);
    const end = b != null ? b : today && a != null ? NOW_MIN : null;
    let lunch = lo != null && li != null && li > lo ? li - lo : 0, autoLunch = false;
    const gross = a != null && end != null ? Math.max(0, end - a) : 0;
    if (!lunch && rules.autoLunch && gross > 6 * 60 && b != null) { lunch = rules.minLunch; autoLunch = true; }
    const hours = Math.max(0, gross - lunch) / 60;
    const startM = tm(rules.start), shiftEnd = startM + rules.shift * 60 + 60;
    const lateBy = a != null ? a - startM : 0;
    const ex = [];
    if (!weekend && !future && !lv && !(h && !h.working)) {
      if (a == null && b != null) ex.push(['missing_in', 'Missing Clock In', 'high']);
      if (a != null && b == null && !today) ex.push(['missing_out', 'Missing Clock Out', 'high']);
      if (!rules.flexible && a != null && lateBy > rules.grace) ex.push(['late', 'Late Arrival • ' + lateBy + ' min', lateBy > rules.maxLate ? 'high' : 'medium']);
      if (!rules.flexible && b != null && b < shiftEnd - rules.grace) ex.push(['early', 'Early Departure • ' + hm(b), 'medium']);
      if (rules.flexible && b != null && hours < rules.shift - 0.25) ex.push(['early', 'Short day • ' + hours.toFixed(1) + 'h', 'medium']);
      if (hours > rules.shift + 0.25 && b != null) ex.push(['overtime', 'Overtime • ' + (hours - rules.shift).toFixed(1) + 'h', 'low']);
      if (p.dup) ex.push(['duplicate', 'Duplicate Entries • clock-in recorded twice', 'medium']);
      if (lo != null && li != null && li < lo) ex.push(['overlap', 'Overlapping Time • lunch in before lunch out', 'high']);
      if (hours > rules.maxHours || (lo != null && li != null && li > lo && li - lo < rules.minLunch)) ex.push(['invalid', 'Invalid Shift • ' + (hours > rules.maxHours ? 'over ' + rules.maxHours + 'h' : 'lunch under ' + rules.minLunch + ' min'), 'high']);
    }
    const exceptions = ex.map(([type, label, sev]) => { const id = key + '|' + type, st = exState[id] || {}; return { id, emp: e.id, name: e.name, dept: e.dept, sup: e.mgr, date: d, type, label, sev, status: st.status || 'Open', comments: st.comments || [], history: st.history || [] }; });
    const openMissing = exceptions.some(x => (x.type === 'missing_in' || x.type === 'missing_out' || x.type === 'overlap' || x.type === 'duplicate') && !['Approved', 'Corrected', 'Closed'].includes(x.status));
    let status;
    if (weekend) status = 'Weekend';
    else if (future) status = lv ? (lv.type === 'Sick' ? 'Sick' : 'Vacation') : h && !h.working ? 'Holiday' : 'Scheduled';
    else if (lv) status = lv.type === 'Sick' ? 'Sick' : 'Vacation';
    else if (h && !h.working) status = 'Holiday';
    else if (a == null && b == null) status = 'Absent';
    else if (openMissing) status = 'Pending Review';
    else if (p.mode === 'remote') status = 'Remote';
    else if (p.mode === 'training') status = 'Training';
    else if (p.mode === 'trip') status = 'Business Trip';
    else if (!rules.flexible && lateBy > rules.grace) status = 'Late';
    else status = 'Present';
    const paidLeaveH = (lv && lv.type !== 'Unpaid') || (h && h.paid && !h.working) ? 8 : 0;
    return { emp: e.id, name: e.name, dept: e.dept, sup: e.mgr, entity: e.entity, date: d, weekend, future, today, punches: p, hours, lunch, autoLunch, status, holiday: h || null, leave: lv || null, exceptions, paidLeaveH, inProgress: today && a != null && b == null };
  }

  const STATUS_COLOR = {
    Present: ['rgba(113,219,166,.25)', '#006C47'], Late: ['#FFF1D6', '#8A5A00'], Absent: ['#FFDAD6', '#BA1A1A'], Holiday: ['#E2E4EA', '#43474D'],
    Vacation: ['#DCEBFF', '#1F5FAD'], Sick: ['#D8F1F8', '#00739F'], Remote: ['#EFE5FF', '#5B2EA6'], Training: ['#E3F4EE', '#2C6E5A'],
    'Business Trip': ['#E5E8FF', '#334296'], 'Pending Review': ['#FFE4D1', '#A3460A'], Weekend: ['transparent', '#A0A3AA'], Scheduled: ['transparent', '#A0A3AA'],
  };
  const LEAVE_TONE = { 'Pending Supervisor': 'warning', 'Pending HR': 'warning', Approved: 'success', Rejected: 'danger', Cancelled: 'neutral' };

  const API = {
    TODAY, ORGS, LEAVE_TYPES, STATUS_COLOR, LEAVE_TONE,
    STATUSES: ['Present', 'Late', 'Absent', 'Holiday', 'Vacation', 'Sick', 'Remote', 'Training', 'Business Trip', 'Pending Review'],
    setRoster(list) { roster = list; if (!load(LS.alerted, false)) { save(LS.alerted, true); API.alertToday(); } },
    get roster() { return roster; },
    get rules() { return { ...rules }; },
    rulesFor, hasOverride(org) { return !!rulesMap[org]; },
    setRules(r, org) { if (!can('attendance.rules.manage')) return false; const k = org && org !== '*' ? org : '*'; rulesMap[k] = { ...(k === '*' ? rulesFor('*') : rulesFor(k)), ...r }; rules = rulesFor('*'); persist(); audit('attendance.rules.updated', (k === '*' ? 'All organizations' : k) + ' • ' + Object.keys(r).map(x => x + '=' + r[x]).join(', '), 'warning'); fire(); return true; },
    clearRules(org) { if (!can('attendance.rules.manage')) return; if (!org || org === '*') return; delete rulesMap[org]; persist(); audit('attendance.rules.reset', org + ' • inherits default rules', 'warning'); fire(); },
    addD, dow, tm, hm,
    day(emp, d) { const e = roster.find(x => x.id === emp) || { id: emp, name: emp, entity: ORGS[0] }; return day(e, d); },
    range(from, to) { const out = []; for (let d = from; d <= to; d = addD(d, 1)) out.push(d); return out; },
    daily(d, filter) { return roster.filter(e => !filter || filter(e)).map(e => day(e, d)); },
    month(y, m) { const first = y + '-' + String(m).padStart(2, '0') + '-01'; const days = []; for (let d = first; d.slice(5, 7) === String(m).padStart(2, '0'); d = addD(d, 1)) days.push(d); return days; },
    summary(d, filter) {
      const L = API.daily(d, filter).filter(x => !x.weekend); const c = s => L.filter(x => x.status === s).length;
      const exAll = L.flatMap(x => x.exceptions);
      const scheduled = L.filter(x => !['Holiday', 'Vacation', 'Sick'].includes(x.status)).length;
      const present = L.filter(x => ['Present', 'Late', 'Remote', 'Training', 'Business Trip', 'Pending Review'].includes(x.status)).length;
      return { total: L.length, present, absent: c('Absent'), late: c('Late') + exAll.filter(x => x.type === 'late' && L.find(y => y.emp === x.emp).status !== 'Late').length, early: exAll.filter(x => x.type === 'early').length,
        missingOut: exAll.filter(x => x.type === 'missing_out').length, missingIn: exAll.filter(x => x.type === 'missing_in').length, onLeave: c('Vacation') + c('Sick'), remote: c('Remote'), field: c('Training') + c('Business Trip'),
        pct: scheduled ? Math.round(present / scheduled * 1000) / 10 : 100, holiday: c('Holiday') };
    },
    exceptions(from, to) { const out = []; API.range(from, to).forEach(d => roster.forEach(e => out.push(...day(e, d).exceptions))); return out; },
    canManage(x) { return can('attendance.exceptions.manage', x && x.emp); },
    exAction(x, action, comment, fix) {
      const st = exState[x.id] || { status: 'Open', comments: [], history: [] };
      if (action === 'comment' && !can('attendance.view', x.emp)) return { ok: false, msg: 'Outside your scope' };
      if (action !== 'comment' && !API.canManage(x)) return { ok: false, msg: 'Only Supervisor, Manager, HR or Admin can ' + action };
      const at = new Date().toISOString();
      if (action === 'comment') { if (!comment || !comment.trim()) return { ok: false, msg: 'Write a comment first' }; st.comments = [...(st.comments || []), { at, actor: actor(), text: comment.trim() }]; }
      else if (action === 'correct') {
        const k = x.emp + '|' + x.date, cur = { ...(ovr[k] || {}) };
        Object.keys(fix || {}).forEach(f => { if (fix[f] !== undefined) cur[f] = fix[f]; });
        if (cur.in && cur.out && tm(cur.out) <= tm(cur.in)) return { ok: false, msg: 'Clock out must be after clock in' };
        if (x.type === 'duplicate') cur.dup = false;
        ovr[k] = cur; st.status = 'Corrected';
        if (x.emp === 'MGH-1042') window.dispatchEvent(new CustomEvent('mgh-att-punch', { detail: { emp: x.emp, date: x.date, punches: cur } }));
      } else st.status = { review: 'In Review', approve: 'Approved', close: 'Closed', reopen: 'Open' }[action] || st.status;
      st.history = [...(st.history || []), { at, actor: actor(), role: role(), action, comment: comment || '' }];
      exState[x.id] = st; persist();
      audit('attendance.exception.' + action, x.emp + ' • ' + x.date + ' • ' + x.label + (comment ? ' • "' + comment + '"' : ''), action === 'correct' ? 'warning' : 'info');
      if (action === 'correct' || action === 'approve') alert(['Employee'], 'Attendance ' + (action === 'correct' ? 'corrected' : 'exception approved') + ': ' + x.label + ' • ' + x.date, x.emp + ' • ' + x.date);
      fire(); return { ok: true };
    },
    /* Punch sync from My Time Entry & Workday records (single source of truth) */
    punch({ emp, date, in: cin, out: cout, mode = 'office', hours, overtime, note }) {
      API.setPunches(emp, date, { in: cin, out: cout, mode, hours, overtime, note });
    },
    loadBackendPunches(list) {
      if (!Array.isArray(list)) return;
      let changed = false;
      list.forEach(p => {
        const empId = p.emp || p.employee_id;
        const d = p.date;
        if (!empId || !d) return;
        const k = empId + '|' + d;
        ovr[k] = {
          ...(ovr[k] || {}),
          in: p.clock_in || (ovr[k] && ovr[k].in) || '',
          lo: p.lunch_out || (ovr[k] && ovr[k].lo) || '',
          li: p.lunch_in || (ovr[k] && ovr[k].li) || '',
          out: p.clock_out || (ovr[k] && ovr[k].out) || '',
          mode: p.mode || (ovr[k] && ovr[k].mode) || 'office',
          hours: p.hours,
          overtime: p.overtime,
          note: p.note
        };
        changed = true;
      });
      if (changed) { save(LS.ovr, ovr); fire(); }
    },
    setPunches(emp, d, p) { const k = emp + '|' + d, prev = JSON.stringify(ovr[k] || {}); ovr[k] = { ...(ovr[k] || {}), in: p.in || '', lo: p.lo || '', li: p.li || '', out: p.out || '', mode: p.mode || 'office', ...(p.hours != null ? { hours: p.hours } : {}), ...(p.overtime != null ? { overtime: p.overtime } : {}) }; if (prev !== JSON.stringify(ovr[k])) { save(LS.ovr, ovr); fire(); } },
    /* ---------- leave ---------- */
    leave() { return leave.slice(); },
    leaveOn,
    requestLeave(r) {
      if (!can('leave.request', r.emp)) return { ok: false, msg: 'Not allowed to request leave for this employee' };
      if (!r.emp || !r.type || !r.from || !r.to) return { ok: false, msg: 'Employee, type and dates are required' };
      if (r.to < r.from) return { ok: false, msg: 'End date must be on or after start date' };
      if (leave.some(l => l.emp === r.emp && !['Rejected', 'Cancelled'].includes(l.status) && !(r.to < l.from || r.from > l.to))) return { ok: false, msg: 'Overlaps an existing request' };
      const id = 'LV-' + (1000 + leave.length + 1), at = new Date().toISOString();
      const l = { id, ...r, status: 'Pending Supervisor', history: [{ at, actor: actor(), role: role(), to: 'Submitted', comment: r.reason || '' }] };
      leave = [l, ...leave]; persist(); audit('leave.requested', id + ' • ' + r.name + ' • ' + r.type + ' ' + r.from + ' → ' + r.to, 'info');
      alert(['Supervisor'], 'Leave request: ' + r.name + ' • ' + r.type + ' ' + r.from + (r.to !== r.from ? ' → ' + r.to : ''), id); alert(['Employee'], 'Leave request submitted.', id);
      fire(); return { ok: true, l };
    },
    leaveCan(l) { return (l.status === 'Pending Supervisor' && can('leave.approve.supervisor', l.emp)) || (l.status === 'Pending HR' && can('leave.approve.hr', l.emp)); },
    leaveAct(l, action, comment) {
      if (action === 'cancel') { if (!can('leave.cancel', l.emp)) return { ok: false, msg: 'Not allowed to cancel this request' }; if (!['Pending Supervisor', 'Pending HR'].includes(l.status)) return { ok: false, msg: 'Only pending requests can be cancelled' }; }
      else if (!API.leaveCan(l)) return { ok: false, msg: 'Waiting for ' + (l.status === 'Pending HR' ? 'HR' : 'Supervisor') };
      if (action === 'reject' && !(comment || '').trim()) return { ok: false, msg: 'A reason is required' };
      const from = l.status, to = action === 'cancel' ? 'Cancelled' : action === 'reject' ? 'Rejected' : l.status === 'Pending Supervisor' ? 'Pending HR' : 'Approved';
      const at = new Date().toISOString();
      leave = leave.map(x => x.id === l.id ? { ...x, status: to, history: [...x.history, { at, actor: actor(), role: role(), to, comment: comment || '' }] } : x);
      persist(); audit('leave.' + to.toLowerCase().replace(/\s+/g, '_'), l.id + ' • ' + l.name + ' • ' + from + ' → ' + to + (comment ? ' • "' + comment + '"' : ''), to === 'Rejected' ? 'warning' : 'success');
      if (to === 'Pending HR') alert(['HR'], 'Leave request awaiting HR: ' + l.name + ' • ' + l.type, l.id);
      if (to === 'Approved') { alert(['Employee'], 'Leave approved: ' + l.type + ' ' + l.from + (l.to !== l.from ? ' → ' + l.to : ''), l.id); alert(['Payroll'], 'Leave approved • ' + l.name + ' • ' + (l.type === 'Unpaid' ? 'unpaid' : 'paid') + ' credit', l.id); if (l.emp === 'MGH-1042') window.dispatchEvent(new Event('mgh-att-leave')); }
      if (to === 'Rejected') alert(['Employee'], 'Leave rejected: ' + l.type + ' • ' + comment, l.id);
      fire(); return { ok: true, to };
    },
    /* ---------- holidays ---------- */
    holidays(org) { return hol.filter(h => !org || h.org === org).sort((a, b) => a.date.localeCompare(b.date)); },
    addHoliday(h) { if (!can('holidays.manage')) return { ok: false, msg: 'Not allowed' }; if (!h.date || !h.desc) return { ok: false, msg: 'Date and description are required' }; if (hol.some(x => x.org === h.org && x.date === h.date)) return { ok: false, msg: 'A holiday already exists on that date' }; const n = { id: 'H' + Date.now(), paid: true, working: false, ...h }; hol = [...hol, n]; persist(); audit('holiday.created', h.org + ' • ' + h.date + ' • ' + h.desc, 'warning'); fire(); return { ok: true }; },
    updateHoliday(id, patch) { if (!can('holidays.manage')) return; hol = hol.map(h => h.id === id ? { ...h, ...patch } : h); persist(); const h = hol.find(x => x.id === id); audit('holiday.updated', h.org + ' • ' + h.date + ' • ' + Object.keys(patch).map(k => k + '=' + patch[k]).join(', '), 'warning'); fire(); },
    removeHoliday(id) { if (!can('holidays.manage')) return; const h = hol.find(x => x.id === id); hol = hol.filter(x => x.id !== id); persist(); audit('holiday.deleted', h.org + ' • ' + h.date + ' • ' + h.desc, 'warning'); fire(); },
    /* ---------- notifications ---------- */
    alertToday() {
      const prev = addD(TODAY, -1), L = roster.map(e => day(e, prev)).concat(roster.map(e => day(e, TODAY)));
      const mo = L.flatMap(x => x.exceptions).filter(x => x.type === 'missing_out'), late = roster.map(e => day(e, TODAY)).filter(x => x.status === 'Late'), abs = roster.map(e => day(e, TODAY)).filter(x => x.status === 'Absent');
      if (mo.length) alert(['Supervisor'], mo.length + ' missing clock-out(s) on ' + prev, 'Attendance');
      if (late.length) alert(['Supervisor'], late.length + ' late arrival(s) today', 'Attendance');
      if (abs.length) alert(['Supervisor', 'HR'], abs.length + ' unjustified absence(s) today', 'Attendance');
    },
  };
  window.MGH_ATT = API;
})();
