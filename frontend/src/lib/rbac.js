/* MGH Timekeeping — authorization + tenancy engine (prototype; mirrors the planned back-end policy service).
   One central matrix: permission → { role: scope | false }. Menus, routes, buttons and engines call can(perm, record).
   Tenancy: one active organization; every record carries its organization (employee.entity) and nothing crosses it.
   A person holds a role per organization (membership). Scopes: self < team < department < project < organization < global. */
(function () {
  const LS_P = 'mgh-rbac-persona', LS_O = 'mgh-rbac-org';
  // My Global Hub is the single (umbrella) company. Its products — Arawaki (e-commerce), Wokokai (social network),
  // Treslog (shipping app) — are PROJECTS inside it, not separate legal entities / tenants.
  const DR = 'MGH Dominicana SRL';
  const ORGS = [
    { id: DR, short: 'Dominicana', country: 'Dominican Republic', currency: 'DOP', timezone: 'America/Santo_Domingo', language: 'es', locale: 'es-DO', hour12: false, workdays: 'Mon–Fri', payroll: 'Quincenal • DGII (ISR + TSS)' },
  ];
  const SCOPES = ['self', 'team', 'department', 'project', 'organization', 'global'];
  const SCOPE_LABEL = { self: 'Self', team: 'Team', department: 'Department', project: 'Project', organization: 'Organization', global: 'Global' };
  const PERSONAS = [];
  const R = ['Platform Admin', 'Org Admin', 'HR', 'Payroll', 'CFO', 'Manager', 'Supervisor', 'Employee', 'Contractor'];
  const G = 'global', O = 'organization', D = 'department', T = 'team', S = 'self', N = false;
  // row helper: values in R order
  const row = (module, label, ...v) => ({ module, label, grants: Object.fromEntries(R.map((r, i) => [r, v[i] === undefined ? N : v[i]])) });
  //                                                          PAdm OrgA  HR    Payr  CFO   Mgr   Sup   Emp   Ctr
  const MATRIX = {
    'dashboard.executive.view':   row('Dashboard', 'View executive dashboard',      G, O, O, O, G, O, T, N, N),
    'ops.view':                   row('Dashboard', 'Operations Center',             G, O, O, O, G, O, N, N, N),
    'dashboard.payroll.view':     row('Dashboard', 'View payroll dashboard',        G, O, N, O, G, O, N, N, N),
    'employees.view':             row('Employees', 'View employees',                G, O, O, O, G, O, T, S, S),
    'employees.create':           row('Employees', 'Create employees',              G, O, O, N, N, O, N, N, N),
    'employees.edit':             row('Employees', 'Edit employees',                G, O, O, N, N, O, N, N, N),
    'profile.edit':               row('Employees', 'Edit own profile (contact details)', S, S, S, S, S, S, S, S, S),
    'employees.compensation.view':row('Employees', 'View salary & bank data',       G, O, O, O, G, O, N, S, S),
    // PMs and supervisors are employees too: they log, see and submit their OWN time (approved by the next step)
    'timesheets.self':            row('Timekeeping', 'Use My Time Entry',           N, N, N, N, N, S, S, S, S),
    'timesheets.edit':            row('Timekeeping', 'Edit own timesheet (Draft/Returned)', N, N, N, N, N, S, S, S, S),
    'timesheets.submit':          row('Timekeeping', 'Submit own timesheet',        N, N, N, N, N, S, S, S, S),
    'timesheets.view':            row('Timekeeping', 'View team timesheets',        G, O, O, O, G, O, T, N, N),
    'timesheets.approve':         row('Approvals', 'Approve timesheets (at assigned step)', G, O, O, O, G, O, T, N, N),
    'timesheets.approve.any':     row('Approvals', 'Override: act on any workflow step', G, O, N, N, N, N, N, N, N),
    'attendance.dashboard.view':  row('Attendance', 'View attendance dashboard',    G, O, O, O, G, O, T, N, N),
    'attendance.view':            row('Attendance', 'View attendance',              G, O, O, O, G, O, T, S, S),
    'attendance.exceptions.manage': row('Attendance', 'Review / correct exceptions', G, O, O, O, N, O, T, N, N),
    'attendance.rules.manage':    row('Attendance', 'Manage attendance rules',      G, O, O, N, N, N, N, N, N),
    'holidays.manage':            row('Attendance', 'Manage holidays',              G, O, O, N, N, O, N, N, N),
    // PMs, supervisors and finance are employees too: they request their OWN leave
    'leave.request':              row('Leave', 'Request leave',                     G, O, O, S, S, S, S, S, S),
    // Mirrors PATCH /leave/:id/review: supervisor, pm, hr, finance and admin may approve/reject at any step
    'leave.approve.supervisor':   row('Leave', 'Approve leave (supervisor step)',   G, O, O, O, G, O, O, N, N),
    'leave.approve.hr':           row('Leave', 'Approve leave (HR step)',           G, O, O, O, G, O, O, N, N),
    'leave.cancel':               row('Leave', 'Cancel pending leave',              G, O, O, N, N, N, N, S, S),
    'payroll.view':               row('Payroll', 'View pay periods & register',     G, O, N, O, G, O, N, N, N),
    'payroll.process':            row('Payroll', 'Run payroll processing',          G, O, N, O, N, N, N, N, N),
    'payroll.generate':           row('Payroll', 'Generate pay stubs / mark paid',  G, O, N, O, N, N, N, N, N),
    'periods.manage':             row('Payroll', 'Open / lock pay periods',         G, O, N, O, N, N, N, N, N),
    'adjustments.manage':         row('Payroll', 'Create payroll adjustments',      G, O, N, O, N, N, N, N, N),
    'banking.view':               row('Payroll', 'View banking & allocations',      G, O, N, O, G, N, N, N, N),
    'payslips.view':              row('Payroll', 'View pay stubs',                  G, O, O, O, G, N, N, S, S),
    'reports.view':               row('Reports', 'View reports',                    G, O, O, O, G, O, T, N, N),
    'reports.export':             row('Reports', 'Export reports (PDF/Excel/CSV)',  G, O, O, O, G, O, T, N, N),
    'contractors.view':           row('Contractors', 'View contractors',            G, O, O, O, G, O, N, N, S),
    'contractors.pay':            row('Contractors', 'Release contractor payments', G, O, N, O, N, O, N, N, N),
    'jira.view':                  row('Projects / Jira', 'View Jira sync',          G, O, N, N, N, O, T, N, N),
    'projects.view':              row('Projects / Jira', 'View projects (members see only their own)', G, O, N, N, G, O, T, S, S),
    'admin.org':                  row('Administration', 'Organizations & Multi-HQ', G, O, N, N, N, N, N, N, N),
    'workflows.manage':           row('Administration', 'Configure approval workflow & overtime', G, O, N, N, N, N, N, N, N),
    'audit.view':                 row('Administration', 'View audit logs',          G, O, O, O, G, N, N, N, N),
    'languages.manage':           row('Administration', 'Manage languages',         G, O, N, N, N, N, N, N, N),
    'settings.manage':            row('Administration', 'Company settings',         G, O, N, N, N, N, N, N, N),
    'rbac.view':                  row('Administration', 'View roles & permissions', G, O, O, N, N, N, N, N, N),
  };
  // Every route declares its permission (any-of). Missing route → denied.
  const ROUTES = {
    dashboard: ['dashboard.executive.view'], ops: ['ops.view'], payroll: ['dashboard.payroll.view'],
    mytime: ['timesheets.self', 'timesheets.approve'], myentry: ['timesheets.self'], mysheets: ['timesheets.self'], myhistory: ['timesheets.self'], addEmployee: ['employees.create'], empCreated: ['employees.create'],
    approvals: ['timesheets.approve', 'payroll.generate'], queue: ['timesheets.approve', 'timesheets.view'], timesheets: ['timesheets.view'],
    employees: ['employees.view'], profile: ['employees.view'],
    attendance: ['attendance.dashboard.view'], attWorkday: ['attendance.view'], attDaily: ['attendance.view'], actDaily: ['attendance.view'], attCalendar: ['attendance.view'], attExceptions: ['attendance.exceptions.manage'],
    attLeave: ['leave.request', 'leave.approve.supervisor', 'leave.approve.hr'], attHolidays: ['attendance.view'], attReports: ['reports.view'], attRules: ['attendance.rules.manage'],
    periods: ['payroll.view'], adjustments: ['adjustments.manage'], processing: ['payroll.process'], paystub: ['payslips.view'], banking: ['banking.view'], reports: ['reports.view'],
    contractors: ['contractors.view'], contractorPayments: ['contractors.pay'],
    jira: ['jira.view'], projects: ['projects.view'],
    admin: ['admin.org'], workflows: ['workflows.manage'], audit: ['audit.view'], languages: ['languages.manage'], settings: ['settings.manage'], permissions: ['rbac.view'],
    login: [],
  };

  const ld = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  let activeUser = (() => {
    try {
      const u = localStorage.getItem('mgh-auth-user') || localStorage.getItem('mgh-user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  })();

  function mapRole(r) {
    if (!r) return 'Employee';
    const s = String(r).toLowerCase().trim();
    if (s === 'admin' || s === 'platform admin' || s === 'org admin') return 'Platform Admin';
    if (s === 'pm' || s === 'manager') return 'Manager';
    if (s === 'supervisor') return 'Supervisor';
    if (s === 'hr') return 'HR';
    if (s === 'finance' || s === 'cfo') return 'Payroll';
    if (s === 'auditor') return 'Platform Admin';
    if (s === 'contractor') return 'Contractor';
    return 'Employee';
  }

  let org = ld(LS_O, DR);

  const P = () => {
    if (activeUser) {
      const matchedOrg = (typeof API !== 'undefined' && API.orgSettings) ? API.orgSettings(activeUser.entity) : null;
      const uOrg = matchedOrg ? matchedOrg.id : (activeUser.entity || org || DR);
      const uRole = mapRole(activeUser.role);
      const uEmp = activeUser.employeeId || activeUser.employee_id || null;
      return {
        id: activeUser.id,
        person: activeUser.name || 'User',
        title: activeUser.role || 'Employee',
        emp: uEmp,
        email: activeUser.email || '',
        avatar: activeUser.avatar || null,
        memberships: { [uOrg]: uRole },
        team: teamOf(activeUser.name, uEmp)
      };
    }
    return {
      id: 'guest',
      person: 'Guest',
      title: 'Guest',
      emp: null,
      email: '',
      memberships: { [DR]: 'Employee' }
    };
  };

  const roleNow = () => {
    if (activeUser) return mapRole(activeUser.role);
    return null;
  };

  // Position of a workflow step among the enabled steps (-1 = unknown / disabled)
  const stepIndex = key => { const W = window.MGH_WF; if (!W) return -1; return W.steps().findIndex(x => x.key === key); };
  const me = () => ({ ...P(), role: roleNow(), org: (activeUser && activeUser.entity) || org });
  // Mirrors the backend (routes.js REVIEWER_ROLES / reviewStepError): the first step can be reviewed by
  // supervisor, PM, HR, finance and admin ('timesheets.approve'); later steps (owner approval) only by the admin.
  const scopeOf = perm => {
    const role = roleNow(); if (!role) return false;
    if (/^timesheets\.approve\./.test(perm)) { const k = perm.split('.')[2]; if (stepIndex(k) === 0) return MATRIX['timesheets.approve'].grants[role] || false; return MATRIX['timesheets.approve.any'].grants[role] || false; }
    const m = MATRIX[perm]; return m ? m.grants[role] : false;
  };
  const DATA = () => (window.__MGH_DATA && (window.__MGH_DATA.ALL_EMP || window.__MGH_DATA.EMPLOYEES)) || [];
  // A supervisor's team: employees whose manager (employees.mgr, stored as a name or an employee id) is them
  function teamOf(name, emp) {
    const n = String(name || '').toLowerCase().trim();
    return DATA().filter(e => {
      const m = String(e.mgr || '').toLowerCase().trim();
      return m && e.id !== emp && ((n && m === n) || (emp && m === String(emp).toLowerCase()));
    }).map(e => e.id);
  }
  function inScope(scope, t) {
    if (!scope) return false;
    if (t == null) return true;
    const u = P();
    const e = typeof t === 'string' ? DATA().find(x => x.id === t) || { id: t } : t;
    // tenancy: never cross organizations (compare resolved org ids, so 'My Global Hub Dominicana SRL' = 'MGH Dominicana SRL')
    if (e.entity && API.orgSettings(e.entity).id !== API.orgSettings(org).id) return false;
    if (scope === 'global' || scope === 'organization') return true;

    // Determine if the target record matches the active user (self scope)
    const uEmpDigits = u.emp ? String(u.emp).replace(/\D/g, '') : '';
    const isSelf = Boolean(
      (t === u.id || (u.emp && t === u.emp)) ||
      (e.id && (e.id === u.emp || e.id === u.id || (uEmpDigits && e.id === 'CTR-' + uEmpDigits))) ||
      (e.cid && (e.cid === u.emp || (uEmpDigits && e.cid === 'CTR-' + uEmpDigits))) ||
      (e.contractorId && (e.contractorId === u.emp || (uEmpDigits && e.contractorId === 'CTR-' + uEmpDigits))) ||
      (e.emp && (e.emp === u.emp || e.emp === u.id)) ||
      (e.employeeId && (e.employeeId === u.emp || (uEmpDigits && e.employeeId === 'CTR-' + uEmpDigits))) ||
      (e.employee_id && (e.employee_id === u.emp || (uEmpDigits && e.employee_id === 'CTR-' + uEmpDigits))) ||
      (e.email && u.email && String(e.email).toLowerCase() === String(u.email).toLowerCase())
    );
    if (isSelf) return true;
    if (scope === 'self') return false;
    // No team can be derived (nobody reports to them by name / id) → everyone the backend returned to them
    if (scope === 'team') return !(u.team || []).length || u.team.includes(e.id);
    if (scope === 'department') return (u.depts || []).includes(e.dept) || (u.team || []).includes(e.id);
    if (scope === 'project') return (u.projects || []).includes(e.project);
    return false;
  }
  const fire = () => { window.dispatchEvent(new Event('mgh-rbac')); window.dispatchEvent(new Event('mgh-wf')); window.dispatchEvent(new Event('mgh-att')); };
  const API = {
    ROLES: R, PERSONAS, ROLE_IDS: R, MATRIX, ROUTES, SCOPES, SCOPE_LABEL, ORGS,
    get role() { return roleNow(); }, get org() { return (activeUser && activeUser.entity) || org; },
    orgSettings(o) {
      const raw = o || (activeUser && activeUser.entity) || org || '';
      const target = String(raw).toLowerCase().trim();
      const match = ORGS.find(x => {
        const idLower = x.id.toLowerCase();
        const shortLower = (x.short || '').toLowerCase();
        return idLower === target ||
               shortLower === target ||
               target.includes(shortLower) ||
               (target.includes('dominicana') && idLower.includes('dominicana'));
      });
      return match || ORGS[0];
    },
    orgs() { return Object.keys(P().memberships); },
    me, person(r) { return (activeUser && activeUser.name) || r; },
    /** The signed-in backend user ({ id, role, employeeId, … }) or null */
    get user() { return activeUser; },
    setUser(user) {
      activeUser = user;
      try {
        if (user) {
          localStorage.setItem('mgh-auth-user', JSON.stringify(user));
          localStorage.setItem('mgh-user', JSON.stringify(user));
        } else {
          localStorage.removeItem('mgh-auth-user');
          localStorage.removeItem('mgh-user');
        }
      } catch (e) {}
      if (user && user.entity) {
        const match = API.orgSettings(user.entity);
        org = match ? match.id : user.entity;
      }
      fire();
    },
    setOrg(o) { org = o; try { localStorage.setItem(LS_O, o); } catch (e) {} fire(); return true; },
    scopeOf,
    /** can('perm') → role holds it in the active organization; can('perm', record) → record inside scope + organization */
    can(perm, target) { return inScope(scopeOf(perm), target); },
    canAny(perms, target) { return perms.some(p => API.can(p, target)); },
    visible(list, perm) { return list.filter(e => API.can(perm, e)); },
    canRoute(route) { const p = ROUTES[route]; if (!p) return false; return !p.length || API.canAny(p); },
    routePerms(route) { return ROUTES[route] || null; },
    homeRoute() { const order = ['dashboard', 'mytime', 'approvals', 'periods', 'attDaily', 'attendance', 'contractors', 'reports', 'permissions']; return order.find(x => API.canRoute(x)) || 'login'; },
  };
  window.MGH_RBAC = API;
})();
