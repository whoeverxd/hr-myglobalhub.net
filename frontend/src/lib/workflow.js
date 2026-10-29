/* MGH Timekeeping — approval workflow engine (prototype; mirrors the planned back-end state machine).
   Steps come from config (per organization), never hard-coded in screens. Persisted in localStorage. */
(function () {
  if (window.MGH_WF) return;
  const LS = { cfg: 'mgh-wf-config', ts: 'mgh-wf-timesheets', notes: 'mgh-wf-notifications', audit: 'mgh-wf-audit', role: 'mgh-wf-role' };
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const ROLES = {
    Employee: { person: 'Empleado', id: '' },
    Supervisor: { person: 'PM / Supervisor', id: '' },
    Manager: { person: 'PM / Supervisor', id: '' },
    PM: { person: 'PM / Supervisor', id: '' },
    Owner: { person: 'Owner / Admin', id: '' },
    'Org Admin': { person: 'Owner / Admin', id: '' },
    'Platform Admin': { person: 'Owner / Admin', id: '' },
    Payroll: { person: 'Owner / Admin', id: '' },
    Admin: { person: 'Owner / Admin', id: '' },
  };
  const CATALOG = {
    pm: { key: 'pm', label: 'Supervisión PM', role: 'Manager', review: 'Supervisión PM' },
    owner: { key: 'owner', label: 'Aprobación Dueño & Pago', role: 'Platform Admin', review: 'Aprobación Dueño' },
    supervisor: { key: 'supervisor', label: 'Supervisión PM', role: 'Manager', review: 'Supervisión PM' },
    manager: { key: 'manager', label: 'Aprobación Dueño & Pago', role: 'Platform Admin', review: 'Aprobación Dueño' },
    payroll: { key: 'payroll', label: 'Aprobación Dueño & Pago', role: 'Platform Admin', review: 'Aprobación Dueño' },
  };
  const DEFAULT_CFG = {
    steps: [
      { key: 'pm', label: 'Supervisión PM', role: 'Manager', enabled: true },
      { key: 'owner', label: 'Aprobación Dueño & Pago', role: 'Platform Admin', enabled: true },
    ],
    ot: { rule: 'weekly', weekly: 44, daily: 8 },
  };
  const STATUS_TONE = {
    'Draft': 'neutral', 'Submitted': 'info', 'PM Review': 'warning', 'Supervisión PM': 'warning', 'Owner Approval': 'orange', 'Aprobación Dueño': 'orange', 'Supervisor Review': 'warning', 'Manager Review': 'orange', 'HR Review': 'warning', 'CFO Review': 'warning',
    'Payroll Review': 'purple', 'Approved': 'success', 'Paid': 'paid', 'Returned': 'danger', 'Rejected': 'rejected', 'Cancelled': 'neutral',
  };
  // Badge colours per spec (bg, fg)
  const STATUS_COLOR = {
    neutral: ['#EAEDFF', '#43474D'], info: ['#E0F3FB', '#00739F'], warning: ['#FFF1D6', '#8A5A00'], orange: ['#FFE4D1', '#A3460A'],
    purple: ['#EFE5FF', '#5B2EA6'], success: ['rgba(113,219,166,.2)', '#006C47'], paid: ['#006C47', '#FFFFFF'], danger: ['#FFDAD6', '#BA1A1A'], rejected: ['#93000A', '#FFFFFF'],
  };

  let cfgMap = (() => { const v = load(LS.cfg, null); if (!v) return {}; return v.steps ? { '*': v } : v; })();
  const ORGK = () => (window.MGH_RBAC ? window.MGH_RBAC.org : '*');
  const cfgGet = () => {
    const k = ORGK();
    if (!cfgMap[k] || !Array.isArray(cfgMap[k].steps) || cfgMap[k].steps.length !== 2 || cfgMap[k].steps[0].key !== 'pm') {
      cfgMap[k] = JSON.parse(JSON.stringify(DEFAULT_CFG));
    }
    if (!cfgMap[k].ot) cfgMap[k].ot = { ...DEFAULT_CFG.ot };
    cfgMap[k].steps.forEach(s => { if (s.label) s.label = s.label.replace(/\s*\((Joshua|Edwin)\)/, ''); });
    return cfgMap[k];
  };
  let sheets = load(LS.ts, {});
  let notes = load(LS.notes, []);
  let audit = load(LS.audit, []);
  const RB = () => window.MGH_RBAC; const curRole = () => RB() ? RB().role : 'Manager';

  const fire = () => window.dispatchEvent(new Event('mgh-wf'));
  const persist = () => { save(LS.cfg, cfgMap); save(LS.ts, sheets); save(LS.notes, notes); save(LS.audit, audit); };
  const steps = () => cfgGet().steps.filter(s => s.enabled);
  const key = (emp, period) => emp + '|' + period;
  const nowIso = () => new Date().toISOString();
  // Who actually acted (history): the signed-in user's name
  const actorFor = r => (RB() && RB().ROLE_IDS.includes(r) && RB().person(r)) || (ROLES[r] || {}).person || r;
  // Who is EXPECTED to act at a step: the role label ("PM / Supervisor", "Owner / Admin"), never the viewer's name
  const roleLabel = r => (ROLES[r] || {}).person || r || '—';

  const routeOf = rec => (rec && rec.route && rec.route.length ? rec.route : steps());
  function reviewOf(step) { return (CATALOG[step.key] || {}).review || step.label + ' Review'; }

  // A record created from a backend status starts with no invented history; real events are appended as they happen
  function seedHistory() {
    return [];
  }

  /* ---------- backend organization config ---------- */
  let remote = null; // { id, steps } as last returned by the backend
  let saver = null;  // (orgId, patch) => Promise<updated org config>
  const FE_ROLE = { pm: 'Manager', manager: 'Manager', supervisor: 'Supervisor', hr: 'HR', finance: 'Payroll', cfo: 'Payroll', admin: 'Platform Admin', owner: 'Platform Admin' };
  const BE_ROLE = { Manager: 'pm', PM: 'pm', Supervisor: 'supervisor', HR: 'hr', Payroll: 'finance', CFO: 'finance', 'Platform Admin': 'admin', 'Org Admin': 'admin', Owner: 'admin', Admin: 'admin' };
  // The backend walks every step it stores (it has no "enabled" flag), so only enabled steps are sent.
  // Label / review of a step the backend already has are kept: they are the status names of sheets under review.
  function toBackendSteps(list) {
    return list.filter(s => s.enabled).map(s => {
      const b = remote && remote.steps.find(x => x.key === s.key), c = CATALOG[s.key] || {};
      const role = BE_ROLE[s.role] || String(s.role || '').toLowerCase();
      return { ...(b || {}), key: s.key, label: b && b.label ? b.label : s.label, role, review: (b && b.review) || c.review || s.label, enabled: true };
    });
  }
  // Apply a change locally, PATCH it, and roll back if the backend refuses it
  function commit(apply, patchOf, onSaved) {
    const k = ORGK(), before = JSON.parse(JSON.stringify(cfgGet()));
    const rollback = msg => { cfgMap[k] = before; persist(); fire(); return { ok: false, msg }; };
    apply(); persist(); fire();
    if (!remote || !saver) return Promise.resolve(rollback('La configuración de la organización no se ha cargado del servidor'));
    return Promise.resolve().then(() => saver(remote.id, patchOf())).then(updated => {
      if (updated && updated.id) API.applyOrgConfig(updated);
      if (onSaved) onSaved();
      fire();
      return { ok: true };
    }).catch(err => rollback((err && err.message) || 'Error al guardar'));
  }

  const API = {
    ROLES, CATALOG, STATUS_TONE, STATUS_COLOR,
    get config() { return JSON.parse(JSON.stringify(cfgGet())); },
    get role() { return curRole(); },
    person(r) { return r ? roleLabel(r) : actorFor(curRole()); },
    setRole(r) { if (RB()) RB().setRole(r); fire(); },
    steps,
    statusColor(st) { return STATUS_COLOR[STATUS_TONE[st] || 'neutral']; },

    /* ---------- config ----------
       The organization config lives in the backend (GET/PATCH /organizations/:id): computeHours reads its OT rule and
       submit/approve read its steps. applyOrgConfig() loads it; every change is PATCHed through the saver registered
       by the app (setRemoteSaver) and reverted locally if the server refuses it. Changes return a Promise
       resolving to { ok, msg } (or false synchronously when the change itself is invalid). */
    applyOrgConfig(o) {
      if (!o || !o.id) return;
      remote = { id: o.id, steps: Array.isArray(o.steps) ? o.steps.map(s => ({ ...s })) : [] };
      const c = cfgGet();
      if (o.ot && o.ot.rule) c.ot = { rule: o.ot.rule, daily: Number(o.ot.daily) || c.ot.daily, weekly: Number(o.ot.weekly) || c.ot.weekly };
      const known = remote.steps.filter(s => DEFAULT_CFG.steps.some(d => d.key === s.key));
      if (known.length) {
        c.steps = DEFAULT_CFG.steps.map(d => {
          const b = known.find(s => s.key === d.key);
          return { ...d, enabled: !!b && b.enabled !== false, role: b ? (FE_ROLE[String(b.role || '').toLowerCase()] || d.role) : d.role };
        });
      }
      persist(); fire();
    },
    get remoteReady() { return !!(remote && saver); },
    setRemoteSaver(fn) { saver = typeof fn === 'function' ? fn : null; },
    setSteps(list) {
      if (RB() && !RB().can('workflows.manage')) return false;
      return commit(() => { cfgGet().steps = list.map(s => ({ key: s.key, label: s.label, role: s.role, enabled: !!s.enabled })); },
        () => ({ steps: toBackendSteps(cfgGet().steps) }), () => API.log('workflow.config.updated', 'Workflow', steps().map(s => s.label).join(' → '), 'warning'));
    },
    moveStep(i, d) { const l = cfgGet().steps.slice(), j = i + d; if (j < 0 || j >= l.length) return false; [l[i], l[j]] = [l[j], l[i]]; return API.setSteps(l); },
    toggleStep(i) { const l = cfgGet().steps.slice(); if (l[i].enabled && steps().length === 1) return false; l[i] = { ...l[i], enabled: !l[i].enabled }; return API.setSteps(l); },
    setStepRole(i, r) { const l = cfgGet().steps.slice(); l[i] = { ...l[i], role: r }; return API.setSteps(l); },
    addStep(k) { if (!CATALOG[k] || cfgGet().steps.some(s => s.key === k)) return false; const c = CATALOG[k], l = cfgGet().steps.slice(); const pi = l.findIndex(s => s.key === 'payroll'); l.splice(pi < 0 ? l.length : pi, 0, { key: c.key, label: c.label, role: c.role, enabled: true }); return API.setSteps(l); },
    removeStep(i) { const l = cfgGet().steps.slice(); if (l.length <= 1) return false; l.splice(i, 1); return API.setSteps(l); },
    resetConfig() { return API.setSteps(JSON.parse(JSON.stringify(DEFAULT_CFG.steps))); },
    setOT(o) {
      if (RB() && !RB().can('workflows.manage')) return false;
      return commit(() => { cfgGet().ot = { ...cfgGet().ot, ...o }; }, () => ({ ot: { ...cfgGet().ot } }), () => API.log('overtime.rule.updated', 'Organization', API.otLabel(), 'warning'));
    },
    otLabel() { const o = cfgGet().ot; return o.rule === 'weekly' ? 'Weekly > ' + o.weekly + 'h' : o.rule === 'daily' ? 'Daily > ' + o.daily + 'h' : o.rule === 'both' ? 'Daily > ' + o.daily + 'h + Weekly > ' + o.weekly + 'h' : 'Custom • daily ' + o.daily + 'h / weekly ' + o.weekly + 'h'; },
    /* Splits a week of daily hours into regular/overtime per the org rule. Returns per-day OT array. */
    splitOT(dayHours) {
      const o = cfgGet().ot, useDaily = o.rule === 'daily' || o.rule === 'both' || o.rule === 'custom', useWeekly = o.rule === 'weekly' || o.rule === 'both' || o.rule === 'custom';
      const ot = dayHours.map(h => useDaily ? Math.max(0, h - o.daily) : 0);
      if (useWeekly) { let reg = 0; dayHours.forEach((h, i) => { const r = h - ot[i]; const room = Math.max(0, o.weekly - reg); const extra = Math.max(0, r - room); ot[i] += extra; reg += r - extra; }); }
      return ot;
    },

    /* ---------- timesheets ---------- */
    ensure(emp, name, period, seedStatus) {
      const k = key(emp, period); if (sheets[k]) return sheets[k];
      const st = steps(); let status = 'Draft', stepIdx = -1, history = [];
      const rec = { emp, name, period };
      if (seedStatus === 'Approved') {
        stepIdx = 2; status = 'Approved'; history = seedHistory(rec, 2);
      } else if (seedStatus === 'Owner' || seedStatus === 'Aprobación Dueño') {
        stepIdx = 1; status = 'Aprobación Dueño'; history = seedHistory(rec, 1);
      } else if (seedStatus === 'Submitted' || seedStatus === 'PM' || seedStatus === 'Supervisión PM' || seedStatus === 'In Review' || seedStatus === 'Awaiting PM') {
        stepIdx = 0; status = 'Supervisión PM'; history = seedHistory(rec, 0);
      } else {
        stepIdx = -1; status = 'Draft'; history = [];
      }
      sheets[k] = { ...rec, status, stepIdx, history, flags: [], route: st.map(s => ({ ...s })) }; save(LS.ts, sheets); return sheets[k];
    },
    // opts.replace: the list is the complete set the backend returns to this user → sheets cached in the browser
    // that the backend doesn't have any more are dropped (they made dashboards count stale records)
    syncFromBackend(backendList, opts) {
      if (!Array.isArray(backendList)) return;
      if (opts && opts.replace) sheets = {};
      backendList.forEach(ts => {
        const k = key(ts.emp || ts.employee_id, ts.period || ts.period_id);
        const st = steps();
        let status = ts.status || 'Draft';
        // Backend review labels depend on the org config; map them onto the local two-step flow
        if (['Submitted', 'In Review', 'PM Review', 'Supervisor Review'].includes(status)) status = 'Supervisión PM';
        if (['Owner Approval', 'Owner Approval Review', 'Manager Review'].includes(status)) status = 'Aprobación Dueño';
        let stepIdx = -1;
        if (status === 'Supervisión PM') stepIdx = 0;
        else if (status === 'Aprobación Dueño') stepIdx = 1;
        else if (status === 'Approved') stepIdx = 2;
        else if (status === 'Paid') stepIdx = 3;
        else stepIdx = -1;

        const parsedHistory = typeof ts.history_json === 'string' ? JSON.parse(ts.history_json || '[]') : (Array.isArray(ts.history) ? ts.history : []);
        sheets[k] = {
          emp: ts.emp || ts.employee_id,
          name: ts.name || ts.employee_name,
          period: ts.period || ts.period_id,
          status,
          stepIdx,
          history: parsedHistory,
          flags: [],
          route: st.map(s => ({ ...s }))
        };
      });
      save(LS.ts, sheets);
      fire();
    },
    get(emp, period) { return sheets[key(emp, period)] || null; },
    all(period) { return Object.values(sheets).filter(s => !period || s.period === period); },
    routeOf,
    pendingStep(rec) { const st = routeOf(rec); return rec && rec.stepIdx >= 0 && rec.stepIdx < st.length ? st[rec.stepIdx] : null; },
    editable(rec) { return !!rec && ['Draft', 'Returned'].includes(rec.status); },
    canEdit(rec) { return API.editable(rec) && !!RB() && RB().can('timesheets.edit', rec.emp); },
    // Backend rule: nobody but the admin approves / returns their own sheet
    isOwnSheet(rec) { const m = RB() && RB().me(); return !!(rec && m && m.emp && rec.emp === m.emp && RB().role !== 'Platform Admin'); },
    canAct(rec) { const p = API.pendingStep(rec); return !!p && !!RB() && !API.isOwnSheet(rec) && RB().can('timesheets.approve.' + p.key, rec.emp) && !['Returned', 'Rejected', 'Cancelled', 'Paid'].includes(rec.status); },
    canPay(rec) { return !!rec && rec.status === 'Approved' && !!RB() && RB().can('payroll.generate', rec.emp); },
    whyNot(rec) {
      if (!rec) return 'No timesheet';
      if (['Paid', 'Rejected', 'Cancelled'].includes(rec.status)) return 'Read-only • ' + rec.status;
      if (rec.status === 'Approved') return RB() && RB().can('payroll.generate', rec.emp) ? '' : 'Only Payroll can generate the pay stub';
      if (API.editable(rec)) return 'Waiting for the employee to submit';
      const p = API.pendingStep(rec);
      if (p && API.isOwnSheet(rec) && RB().scopeOf('timesheets.approve.' + p.key)) return 'No puedes aprobar tu propia hoja';
      return p ? 'Waiting for ' + p.label + ' (' + roleLabel(p.role) + ')' : '';
    },
    transition(rec, to, comment, opts) {
      const from = rec.status, by = (opts && opts.actor) || actorFor(curRole()), r = (opts && opts.role) || curRole();
      rec.status = to; rec.history = [...rec.history, { at: nowIso(), actor: by, role: r, from, to, comment: comment || '' }];
      sheets[key(rec.emp, rec.period)] = rec;
      API.log('timesheet.' + to.toLowerCase().replace(/\s+/g, '_'), by, rec.emp + ' • ' + rec.period + ' • ' + from + ' → ' + to + (comment ? ' • "' + comment + '"' : ''), /Return|Reject/.test(to) ? 'warning' : 'success');
      return rec;
    },
    logEdit(emp, period, what) { const k = emp + period + what; clearTimeout(API._et && API._et[k]); API._et = API._et || {}; API._et[k] = setTimeout(() => { API.log('timesheet.edited', actorFor(curRole()), emp + ' • ' + period + ' • ' + what, 'info'); fire(); }, 1200); },
    alert(toRoles, text, ref) { const at = nowIso(); toRoles.forEach(r => notes.unshift({ id: at + r + Math.random().toString(36).slice(2, 6), at, role: r, org: ORGK(), text, ref: ref || '', read: false })); notes = notes.slice(0, 200); save(LS.notes, notes); fire(); },
    notify(toRoles, text, rec) { const at = nowIso(); toRoles.forEach(r => notes.unshift({ id: at + r + Math.random().toString(36).slice(2, 6), at, role: r, org: ORGK(), text, ref: rec ? rec.emp + ' • ' + rec.period : '', read: false })); notes = notes.slice(0, 200); },
    submit(emp, period) {
      const rec = sheets[key(emp, period)]; if (!rec) return { ok: false, msg: 'No timesheet' };
      if (!API.editable(rec)) return { ok: false, msg: 'Already submitted' };
      if (!RB() || !RB().can('timesheets.submit', emp)) return { ok: false, msg: 'Only the employee can submit' };
      API.transition(rec, 'Submitted', 'Jornada sometida para supervisión del PM');
      const st = steps(); rec.route = st.map(s => ({ ...s })); rec.stepIdx = 0;
      if (st[0]) API.transition(rec, reviewOf(st[0]), '', { actor: 'System', role: 'System' }); else API.transition(rec, 'Approved', '', { actor: 'System', role: 'System' });
      API.notify(['Employee'], 'Timesheet submitted.', rec); if (st[0]) API.notify([st[0].role], 'Timesheet awaiting your review.', rec);
      persist(); fire(); return { ok: true, rec };
    },
    approve(rec, comment) {
      if (!API.canAct(rec)) return { ok: false, msg: API.whyNot(rec) || 'Not allowed for ' + curRole() };
      const st = routeOf(rec), cur = st[rec.stepIdx]; rec.stepIdx += 1;
      const next = st[rec.stepIdx];
      API.transition(rec, next ? reviewOf(next) : 'Approved', comment);
      API.notify(['Employee'], cur.label + ' approved.', rec);
      if (next) API.notify([next.role], 'Timesheet awaiting your review.', rec); else API.notify(['Payroll'], 'Payroll approved.', rec);
      persist(); fire(); return { ok: true, rec, next };
    },
    returnToEmployee(rec, comment) {
      if (!API.canAct(rec)) return { ok: false, msg: API.whyNot(rec) || 'Not allowed for ' + curRole() };
      if (!comment || !comment.trim()) return { ok: false, msg: 'A reason is required' };
      rec.stepIdx = -1; API.transition(rec, 'Returned', comment);
      API.notify(['Employee'], 'Returned for corrections.', rec); persist(); fire(); return { ok: true, rec };
    },
    reject(rec, comment) {
      if (!API.canAct(rec)) return { ok: false, msg: API.whyNot(rec) || 'Not allowed for ' + curRole() };
      if (!comment || !comment.trim()) return { ok: false, msg: 'A reason is required' };
      API.transition(rec, 'Rejected', comment); API.notify(['Employee'], 'Timesheet rejected.', rec); persist(); fire(); return { ok: true, rec };
    },
    markPaid(rec) {
      if (!API.canPay(rec)) return { ok: false, msg: API.whyNot(rec) };
      API.transition(rec, 'Paid', 'Marcado como pagado'); API.notify(['Employee', 'Payroll'], 'Payment completed.', rec); persist(); fire(); return { ok: true, rec };
    },
    /* Timeline for display: Draft, Submitted, each enabled step, Approved, Paid */
    timeline(rec) {
      const st = API.editable(rec) ? steps() : routeOf(rec), h = (rec && rec.history) || [];
      const last = to => [...h].reverse().find(x => x.to === to);
      const lastFrom = from => [...h].reverse().find(x => x.from === from && x.to !== 'Returned' && x.to !== 'Rejected');
      const sub = last('Submitted');
      const items = [
        { label: 'Borrador', done: true, meta: '' },
        { label: 'Sometido', done: !API.editable(rec), meta: sub ? sub.at : '' }
      ];
      st.forEach((s, i) => {
        const d = rec && rec.stepIdx > i && !API.editable(rec);
        const ev = d ? lastFrom(reviewOf(s)) : null;
        items.push({
          label: s.label,
          step: s,
          done: d,
          current: rec && rec.stepIdx === i && !API.editable(rec) && !['Rejected', 'Returned'].includes(rec.status),
          meta: ev ? ev.at : '',
          who: ev ? ev.actor : roleLabel(s.role)
        });
      });
      const ap = rec && ['Approved', 'Paid'].includes(rec.status), pd = rec && rec.status === 'Paid';
      items.push({ label: 'Aprobado', done: ap, meta: ap && last('Approved') ? last('Approved').at : '' });
      items.push({ label: 'Pagado', done: pd, current: rec && rec.status === 'Approved', meta: pd && last('Paid') ? last('Paid').at : '' });
      return items;
    },

    /* ---------- notifications & audit ---------- */
    notifications(r) { return notes.filter(n => n.role === (r || curRole()) && (!n.org || n.org === ORGK())); },
    unread(r) { return API.notifications(r).filter(n => !n.read).length; },
    markAllRead(r) { notes.forEach(n => { if (n.role === (r || curRole()) && (!n.org || n.org === ORGK())) n.read = true; }); save(LS.notes, notes); fire(); },
    log(action, actor, target, tone) { audit.unshift({ at: nowIso(), actor, action, target, tone: tone || 'success', org: ORGK(), role: curRole() }); audit = audit.slice(0, 500); save(LS.audit, audit); },
    audit() { return audit.filter(a => !a.org || a.org === ORGK()); },
  };
  window.MGH_WF = API;
})();

