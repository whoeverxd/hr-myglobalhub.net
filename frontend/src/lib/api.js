// Thin client for the Node/Express backend (../backend). In development Vite proxies /api
// to http://localhost:5050 (see vite.config.js). Set VITE_API_URL to point elsewhere.
//
// VITE_API_URL replaces the default wholesale -- the `/api` prefix included. A production
// build made with `https://api.myglobalhub.net` therefore sent POST /auth/login to the
// host root and every call 404'd, with the login down in production. The server always
// mounts its routes under /api (server.js: app.use('/api', routes)), so normalise here
// and accept both spellings instead of leaving the trap armed for the next deploy.
const RAW_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';
const BASE = /\/api\/?$/.test(RAW_BASE)
  ? RAW_BASE.replace(/\/$/, '')
  : RAW_BASE.replace(/\/$/, '') + '/api';

const TOKEN_KEY = 'mgh-auth-token';
const USER_KEY = 'mgh-auth-user';

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

async function request(method, path, body) {
  const token = getToken();
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    console.warn(`[api] ${method} ${path}: sin respuesta`, cause);
    const err = new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    err.network = true;
    err.method = method;
    err.path = path;
    throw err;
  }

  if (!res.ok) {
    let msg = '';
    let code = null;
    try {
      const data = await res.json();
      msg = data.error || data.message || '';
      code = data.code || null;
    } catch {
      /* not JSON */
    }
    // The screen shows only the problem in words; method, path and status stay on the error and in the console
    console.warn(`[api] ${method} ${path} → ${res.status}`, msg);
    const err = new Error(errorMessage(res.status, msg));
    err.status = res.status;
    err.code = code;
    err.method = method;
    err.path = path;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// The server's own sentence when it gave one; otherwise what the status means for the user.
// Server errors (5xx) never show internal details.
export function errorMessage(status, serverMsg) {
  if (status >= 500) {
    return status === 502 || status === 503 || status === 504
      ? 'El servidor no está disponible en este momento. Inténtalo de nuevo en unos minutos.'
      : 'El servidor tuvo un problema al procesar la solicitud. Inténtalo de nuevo; si sigue pasando, avisa al administrador.';
  }
  if (serverMsg) return serverMsg;
  return {
    400: 'Los datos enviados no son válidos. Revisa el formulario.',
    401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
    403: 'No tienes permiso para hacer esta acción.',
    404: 'No se encontró el registro. Puede que alguien lo haya eliminado; recarga la página.',
    409: 'La acción choca con el estado actual de los datos. Recarga la página e inténtalo de nuevo.',
    413: 'El archivo es demasiado grande.',
  }[status] || 'No se pudo completar la acción.';
}

export const api = {
  // Auth & Session
  getToken,
  setToken,
  getStoredUser,
  login: async (email, password) => {
    const data = await request('POST', '/auth/login', { email, password });
    if (data.token) {
      setToken(data.token);
      setStoredUser(data.user);
    }
    return data;
  },
  loginWithGoogle: async (idToken) => {
    const data = await request('POST', '/auth/google', { idToken });
    if (data.token) {
      setToken(data.token);
      setStoredUser(data.user);
    }
    return data;
  },
  getFirebaseConfig: () => request('GET', '/auth/firebase-config'),
  me: () => request('GET', '/auth/me'),
  // { newPassword, currentPassword?, googleIdToken? } — see auth.service.changePassword
  changePassword: (payload) => request('POST', '/auth/password', payload),
  employeeRemoval: (employeeId) => request('GET', `/employees/${encodeURIComponent(employeeId)}/removal`),
  deleteEmployee: (employeeId) => request('DELETE', `/employees/${encodeURIComponent(employeeId)}`),
  deactivateEmployee: (employeeId) => request('POST', `/employees/${encodeURIComponent(employeeId)}/deactivate`),
  employeeAccount: (employeeId) => request('GET', `/employees/${encodeURIComponent(employeeId)}/account`),
  setEmployeeRole: (employeeId, role) => request('PUT', `/employees/${encodeURIComponent(employeeId)}/account/role`, { role }),
  setUserRole: (userId, role) => request('PUT', `/users/${encodeURIComponent(userId)}/role`, { role }),
  deleteUser: (userId) => request('DELETE', `/users/${encodeURIComponent(userId)}`),
  resetEmployeePassword: (employeeId) => request('POST', `/employees/${encodeURIComponent(employeeId)}/reset-password`),
  logout: async () => {
    try {
      await request('POST', '/auth/logout');
    } catch {
      /* ignore */
    }
    setToken(null);
    setStoredUser(null);
  },

  // Health & Bootstrap
  health: () => request('GET', '/health'),
  bootstrap: () => request('GET', '/bootstrap'),

  // Pay periods
  periods: (year) => request('GET', `/periods${year ? `?year=${year}` : ''}`),
  currentPeriod: () => request('GET', '/periods/current'),
  setPeriodStatus: (id, status) => request('PATCH', `/periods/${encodeURIComponent(id)}`, { status }),


  // Payroll adjustments
  adjustments: () => request('GET', '/adjustments'),
  createAdjustment: (adj) => request('POST', '/adjustments', adj),
  updateAdjustment: (id, patch) => request('PATCH', `/adjustments/${encodeURIComponent(id)}`, patch),

  // Jira worklogs
  worklogs: () => request('GET', '/worklogs'),
  addWorklog: (log) => request('POST', '/worklogs', log),
  deleteWorklog: (id) => request('DELETE', `/worklogs/${encodeURIComponent(id)}`),

  // Proof of payment
  proofs: () => request('GET', '/proofs'),
  saveProof: (proof) => request('POST', '/proofs', proof),
  deleteProof: (id) => request('DELETE', `/proofs/${encodeURIComponent(id)}`),

  // Employees
  employees: () => request('GET', '/employees'),
  createEmployee: (emp) => request('POST', '/employees', emp),
  updateEmployee: (id, emp) => request('PUT', `/employees/${encodeURIComponent(id)}`, emp),

  // Contractors & Contractor Payments
  contractors: () => request('GET', '/contractors'),
  getContractor: (id) => request('GET', `/contractors/${encodeURIComponent(id)}`),
  createContractor: (ctr) => request('POST', '/contractors', ctr),
  updateContractor: (id, patch) => request('PUT', `/contractors/${encodeURIComponent(id)}`, patch),
  deleteContractor: (id) => request('DELETE', `/contractors/${encodeURIComponent(id)}`),
  contractorPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/contractor-payments${q ? `?${q}` : ''}`);
  },
  createContractorPayment: (pay) => request('POST', '/contractor-payments', pay),
  updateContractorPayment: (id, patch) =>
    request('PATCH', `/contractor-payments/${encodeURIComponent(id)}`, patch),

  // Audit Logs (RBAC: auditor, finance, admin)
  auditLogs: (entity) => request('GET', `/audit${entity ? `?entity=${encodeURIComponent(entity)}` : ''}`),

  // Payroll Calculation Engine & Runs (Phase 3)
  calculatePayroll: ({ periodId = 'PP-2025-08', entity = 'All', saveAsRun = false } = {}) =>
    request('POST', '/payroll/calculate', { periodId, entity, saveAsRun }),
  payrollRuns: () => request('GET', '/payroll/runs'),
  payrollRunDetails: (id) => request('GET', `/payroll/runs/${encodeURIComponent(id)}`),
  pmApprovePayrollRun: (id) => request('POST', `/payroll/runs/${encodeURIComponent(id)}/pm-approve`),
  approvePayrollRun: (id) => request('POST', `/payroll/runs/${encodeURIComponent(id)}/approve`),
  previewEmployeePayroll: (payload) => request('POST', '/payroll/preview-employee', payload),

  // Attendance (Punches, Exceptions, Holidays)
  punches: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/attendance/punches${q ? `?${q}` : ''}`);
  },
  recordPunch: (punch) => request('POST', '/attendance/punches', punch),
  exceptions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/attendance/exceptions${q ? `?${q}` : ''}`);
  },
  resolveException: (id, patch) => request('PATCH', `/attendance/exceptions/${encodeURIComponent(id)}`, patch),
  holidays: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/attendance/holidays${q ? `?${q}` : ''}`);
  },
  createHoliday: (holiday) => request('POST', '/attendance/holidays', holiday),
  deleteHoliday: (id) => request('DELETE', `/attendance/holidays/${encodeURIComponent(id)}`),

  // Leave Requests
  leaveRequests: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/leave${q ? `?${q}` : ''}`);
  },
  createLeaveRequest: (req) => request('POST', '/leave', req),
  reviewLeaveRequest: (id, review) => request('PATCH', `/leave/${encodeURIComponent(id)}/review`, review),

  // Multi-HQ Organizations & Workflow Engine
  organizations: () => request('GET', '/organizations'),
  orgConfig: (id) => request('GET', `/organizations/${encodeURIComponent(id)}`),
  updateOrgConfig: (id, patch) => request('PATCH', `/organizations/${encodeURIComponent(id)}`, patch),
  splitOT: (dailyHours, otConfig) => request('POST', '/workflows/split-ot', { dailyHours, otConfig }),

  // Timesheets State Machine
  timesheets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/timesheets${q ? `?${q}` : ''}`);
  },
  getTimesheet: (id) => request('GET', `/timesheets/${encodeURIComponent(id)}`),
  ensureTimesheet: (empId, periodId, defaultName) =>
    request('POST', '/timesheets/ensure', { empId, periodId, defaultName }),
  submitTimesheet: (id) => request('POST', `/timesheets/${encodeURIComponent(id)}/submit`),
  approveTimesheet: (id, data) => request('POST', `/timesheets/${encodeURIComponent(id)}/approve`, data),
  returnTimesheet: (id, data) => request('POST', `/timesheets/${encodeURIComponent(id)}/return`, data),
  saveTimesheetHours: (id, hours) => request('PUT', `/timesheets/${encodeURIComponent(id)}/hours`, hours),
  // Reviewer partial approval of one activity: { approvedHours, comment } (comment required if not all hours)
  reviewActivity: (id, activityId, payload) => request('POST', `/timesheets/${encodeURIComponent(id)}/activities/${encodeURIComponent(activityId)}/review`, payload),
  addTimesheetComment: (id, comment) => request('POST', `/timesheets/${encodeURIComponent(id)}/comments`, { comment }),
  markPayrollRunPaid: (id) => request('POST', `/payroll/runs/${encodeURIComponent(id)}/paid`),
  timesheetReconciliation: (id) => request('GET', `/timesheets/${encodeURIComponent(id)}/reconciliation`),

  // Daily Activities & Deliverable-based Timekeeping
  activities: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/activities${q ? `?${q}` : ''}`);
  },
  createActivity: (act) => request('POST', '/activities', act),
  updateActivity: (id, act) => request('PUT', `/activities/${encodeURIComponent(id)}`, act),
  deleteActivity: (id) => request('DELETE', `/activities/${encodeURIComponent(id)}`),
  activitySummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/activities/summary${q ? `?${q}` : ''}`);
  },

  // Secure File Attachments & Uploads
  uploadFile: (payload) => request('POST', '/upload', payload),
  listFiles: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/uploads${q ? `?${q}` : ''}`);
  },
  deleteFile: (id) => request('DELETE', `/uploads/${encodeURIComponent(id)}`),

  // Banking Rails, Payment Files & Paystubs
  exportNacha: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/payroll/export/nacha${q ? `?${q}` : ''}`);
  },
  exportBhd: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/payroll/export/bhd${q ? `?${q}` : ''}`);
  },
  exportUsdc: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/payroll/export/usdc${q ? `?${q}` : ''}`);
  },
  confirmUsdc: (payload) => request('POST', '/payroll/rails/usdc/confirm', payload),
  users: () => request('GET', '/users'),
  paystubs: (empId) => request('GET', `/payroll/paystubs${empId ? `?empId=${encodeURIComponent(empId)}` : ''}`),
  getPaystub: (employeeId, periodId) =>
    request('GET', `/payroll/paystub/${encodeURIComponent(employeeId)}/${encodeURIComponent(periodId)}`),
  getPaystubUrl: (employeeId, periodId) =>
    `/api/payroll/paystub/${encodeURIComponent(employeeId)}/${encodeURIComponent(periodId)}/html`,

  // Jira Cloud Integration & Worklog Sync
  jiraStatus: () => request('GET', '/jira/status'),
  jiraProjects: () => request('GET', '/jira/projects'),
  createProject: (payload) => request('POST', '/jira/projects', payload),
  updateProject: (key, payload) => request('PUT', `/jira/projects/${encodeURIComponent(key)}`, payload),
  deleteProject: (key) => request('DELETE', `/jira/projects/${encodeURIComponent(key)}`),
  linkJiraProject: (payload) => request('POST', '/jira/projects/link', payload),
  jiraProjectIssues: (projectKey, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/jira/projects/${encodeURIComponent(projectKey)}/issues${q ? `?${q}` : ''}`);
  },
  syncProjectIssues: (projectKey, payload = {}) =>
    request('POST', `/jira/projects/${encodeURIComponent(projectKey)}/sync`, payload),
  jiraIssues: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/jira/issues${q ? `?${q}` : ''}`);
  },
  syncJiraIssues: (payload = {}) => request('POST', '/jira/sync-issues', payload),
  syncJiraWorklogs: (payload = {}) => request('POST', '/jira/sync', payload),

  // Native Agile Management (Jira Replacement)
  projectSprints: (projectKey) => request('GET', `/projects/${encodeURIComponent(projectKey)}/sprints`),
  createSprint: (projectKey, payload) => request('POST', `/projects/${encodeURIComponent(projectKey)}/sprints`, payload),
  updateSprint: (sprintId, payload) => request('PUT', `/sprints/${encodeURIComponent(sprintId)}`, payload),
  startSprint: (sprintId, payload = {}) => request('POST', `/sprints/${encodeURIComponent(sprintId)}/start`, payload),
  completeSprint: (sprintId, payload = {}) => request('POST', `/sprints/${encodeURIComponent(sprintId)}/complete`, payload),
  deleteSprint: (sprintId) => request('DELETE', `/sprints/${encodeURIComponent(sprintId)}`),

  projectTasks: (projectKey, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/projects/${encodeURIComponent(projectKey)}/tasks${q ? `?${q}` : ''}`);
  },
  createTask: (projectKey, payload) => request('POST', `/projects/${encodeURIComponent(projectKey)}/tasks`, payload),
  getTask: (taskId) => request('GET', `/tasks/${encodeURIComponent(taskId)}`),
  updateTask: (taskId, payload) => request('PUT', `/tasks/${encodeURIComponent(taskId)}`, payload),
  moveTask: (taskId, payload) => request('PATCH', `/tasks/${encodeURIComponent(taskId)}/move`, payload),
  deleteTask: (taskId) => request('DELETE', `/tasks/${encodeURIComponent(taskId)}`),
  searchTasks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/tasks/search${q ? `?${q}` : ''}`);
  },

  projectStatuses: (projectKey) => request('GET', `/projects/${encodeURIComponent(projectKey)}/statuses`),
  createProjectStatus: (projectKey, payload) => request('POST', `/projects/${encodeURIComponent(projectKey)}/statuses`, payload),
  updateProjectStatuses: (projectKey, payload) => request('PUT', `/projects/${encodeURIComponent(projectKey)}/statuses`, payload),
  deleteProjectStatus: (projectKey, statusId) => request('DELETE', `/projects/${encodeURIComponent(projectKey)}/statuses/${encodeURIComponent(statusId)}`),

  cloneJiraIssue: (payload) => request('POST', '/jira/clone-issue', payload),

  projectMembers: (projectKey) => request('GET', `/projects/${encodeURIComponent(projectKey)}/members`),
  addProjectMember: (projectKey, payload) => request('POST', `/projects/${encodeURIComponent(projectKey)}/members`, payload),
  removeProjectMember: (projectKey, userId) => request('DELETE', `/projects/${encodeURIComponent(projectKey)}/members/${encodeURIComponent(userId)}`),
};

