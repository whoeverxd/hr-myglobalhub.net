const express = require('express');
const authController = require('./controllers/auth.controller');
const authService = require('./services/auth.service');
const periodsController = require('./controllers/periods.controller');
const adjustmentsController = require('./controllers/adjustments.controller');
const { currentYearLocal } = require('./utils/today');
const worklogsController = require('./controllers/worklogs.controller');
const proofsController = require('./controllers/proofs.controller');
const employeesController = require('./controllers/employees.controller');
const auditController = require('./controllers/audit.controller');
const payrollController = require('./controllers/payroll.controller');
const attendanceController = require('./controllers/attendance.controller');
const leaveController = require('./controllers/leave.controller');
const workflowsController = require('./controllers/workflows.controller');
const timesheetsController = require('./controllers/timesheets.controller');
const activitiesController = require('./controllers/activities.controller');
const uploadsController = require('./controllers/uploads.controller');
const bankingRailsController = require('./controllers/banking-rails.controller');
const jiraController = require('./controllers/jira.controller');
const signoffController = require('./controllers/signoff.controller');
const rolloutController = require('./controllers/rollout.controller');
const contractorsController = require('./controllers/contractors.controller');
const agileController = require('./controllers/agile.controller');
const jiraService = require('./services/jira.service');
const agileService = require('./services/agile.service');
const { authenticate, requireRole } = require('./middleware/auth.middleware');
const firebaseService = require('./services/firebase.service');
const payrollEngine = require('./services/payroll-engine.service');
const db = require('./db');

const router = express.Router();

const getClientIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
const { getUserName } = require('./utils/actor');
const { devResetAllowed } = require('./utils/runtime');
const isPrivileged = (user) => user && (user.role === 'admin' || user.role === 'pm');

// Nobody but the admin acts on their own record -- the rule timesheets already follow (reviewStepError, below),
// applied wherever an actor could otherwise decide about their own money or their own leave. Posting and approving
// are split by role, but that split is worth nothing when both sides can be the same person deciding about himself.
const actsOnSelf = (user, employeeId) =>
  Boolean(user && user.role !== 'admin' && user.employeeId && employeeId
    && String(employeeId) === String(user.employeeId));

/* ---------- Health ---------- */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mgh-timekeeping-api',
    database: 'Cloud Firestore (Firebase NoSQL)',
    dialect: db.getDialect(),
    firebaseConfigured: firebaseService.isConfigured(),
    // firebaseConfigured only says the credential file parsed. This says whether the
    // data being served actually came from Cloud Firestore on this boot, or from the
    // possibly stale local snapshot after a failed hydration.
    hydration: db.hydrationStatus(),
    auth: 'sessions-rbac',
    time: new Date().toISOString(),
  });
});

/* ---------- Firebase Status ---------- */
router.get('/firebase/status', authenticate, requireRole('admin'), async (req, res) => {
  const status = await firebaseService.testConnection();
  res.json(status);
});

/* ---------- Authentication (Phase 1 & Google Auth) ---------- */
router.post('/auth/login', authController.login);
router.post('/auth/google', authController.loginWithGoogle);
router.get('/auth/firebase-config', authController.getFirebaseConfig);
router.get('/auth/me', authenticate, authController.getMe);
router.post('/auth/logout', authenticate, authController.logout);
router.post('/auth/password', authenticate, authController.changePassword);

/* ---------- System users (Administration screen) ---------- */
router.get('/users', authenticate, requireRole('hr', 'admin'), (req, res, next) => {
  try {
    const rows = db.query(
      `SELECT id, email, name, role, entity, employee_id, avatar, is_active, last_login_at, created_at FROM users ORDER BY created_at ASC`
    );
    res.json(rows.map((u) => ({ ...u, is_active: u.is_active !== 0 })));
  } catch (err) {
    next(err);
  }
});

/* ---------- Bootstrap (initial load) ---------- */
router.get('/bootstrap', authenticate, (req, res, next) => {
  try {
    const privileged = isPrivileged(req.user);
    const isRestricted = !privileged && (req.user && (req.user.role === 'employee' || req.user.role === 'contractor'));
    const myEmpId = req.user ? (req.user.employeeId || req.user.id) : null;
    const myName = req.user ? req.user.name : null;
    const myEmail = req.user ? req.user.email : null;

    const adjustments = isRestricted
      ? adjustmentsController.listAdjustments(myEmpId, myName)
      : adjustmentsController.listAdjustments();

    const worklogs = isRestricted
      ? worklogsController.listWorklogs(myEmpId)
      : worklogsController.listWorklogs();

    const proofs = isRestricted
      ? []
      : proofsController.listProofs();

    const periodOverrides = periodsController.getPeriodOverrides();
    const organizations = workflowsController.listOrganizations();
    const holidays = attendanceController.listHolidays();

    const leaveRequests = isRestricted
      ? leaveController.listLeaveRequests({ empId: myEmpId })
      : leaveController.listLeaveRequests();

    const timesheets = isRestricted
      ? timesheetsController.listTimesheets({ empId: myEmpId })
      : timesheetsController.listTimesheets();

    const exceptions = isRestricted
      ? attendanceController.listExceptions({ empId: myEmpId })
      : attendanceController.listExceptions();

    let contractors = [];
    let contractorPayments = [];

    if (privileged) {
      contractors = contractorsController.listContractors();
      contractorPayments = contractorsController.listContractorPayments();
    } else if (req.user && req.user.role === 'contractor') {
      contractors = contractorsController.listContractors({ id: myEmpId, email: myEmail });
      const ctrId = contractors.length ? contractors[0].id : null;
      contractorPayments = ctrId ? contractorsController.listContractorPayments({ contractorId: ctrId }) : [];
    }

    res.json({
      adjustments,
      worklogs,
      proofs,
      periodOverrides,
      organizations,
      holidays,
      leaveRequests,
      timesheets,
      exceptions,
      contractors,
      contractorPayments,
      currentUser: req.user,
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- Pay periods (RBAC) ---------- */
router.get('/periods/current', authenticate, (req, res, next) => {
  try {
    const current = periodsController.getCurrentPeriod();
    res.json(current);
  } catch (err) {
    next(err);
  }
});

router.get('/periods', authenticate, (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : currentYearLocal();
    const periods = periodsController.listPeriods(year);
    res.json(periods);
  } catch (err) {
    next(err);
  }
});


// Only PM, Finance and Admin can change pay period statuses (Phase 1 & 3)
router.patch('/periods/:id', authenticate, requireRole('pm', 'finance', 'admin'), (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const result = periodsController.updatePeriodStatus(
      id,
      status,
      getUserName(req),
      getClientIp(req)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/* ---------- Payroll adjustments (RBAC) ---------- */
router.get('/adjustments', authenticate, (req, res, next) => {
  try {
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      const myEmpId = req.user.employeeId || req.user.id;
      return res.json(adjustmentsController.listAdjustments(myEmpId, req.user.name));
    }
    res.json(adjustmentsController.listAdjustments());
  } catch (err) {
    next(err);
  }
});

// Supervisors, PM, HR, Finance and Admin can post adjustments
router.post(
  '/adjustments',
  authenticate,
  requireRole('supervisor', 'pm', 'hr', 'finance', 'admin'),
  (req, res, next) => {
    try {
      const target = String((req.body && (req.body.employeeId || req.body.empId)) || '').trim();
      if (actsOnSelf(req.user, target)) {
        return res.status(403).json({ error: 'Forbidden: you cannot post a payroll adjustment on your own record' });
      }
      const adj = adjustmentsController.createAdjustment(
        req.body || {},
        getUserName(req),
        getClientIp(req)
      );
      res.status(201).json(adj);
    } catch (err) {
      next(err);
    }
  }
);

// PM, HR, Finance, and Admin can approve/update adjustments
router.patch(
  '/adjustments/:id',
  authenticate,
  requireRole('pm', 'hr', 'finance', 'admin'),
  (req, res, next) => {
    try {
      const owner = db.getOne('SELECT employee_id FROM payroll_adjustments WHERE id = ?', [req.params.id]);
      if (owner && actsOnSelf(req.user, owner.employee_id)) {
        return res.status(403).json({ error: 'Forbidden: you cannot approve a payroll adjustment on your own record' });
      }
      const updated = adjustmentsController.updateAdjustment(
        req.params.id,
        req.body || {},
        getUserName(req),
        getClientIp(req)
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Jira worklogs (RBAC) ---------- */
router.get('/worklogs', authenticate, (req, res, next) => {
  try {
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      const myEmpId = req.user.employeeId || req.user.id;
      return res.json(worklogsController.listWorklogs(myEmpId));
    }
    res.json(worklogsController.listWorklogs());
  } catch (err) {
    next(err);
  }
});

router.post('/worklogs', authenticate, (req, res, next) => {
  try {
    const body = { ...(req.body || {}) };
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      body.employeeId = req.user.employeeId || req.user.id;
    }
    const log = worklogsController.addWorklog(
      body,
      getUserName(req),
      getClientIp(req)
    );
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

router.delete('/worklogs/:id', authenticate, (req, res, next) => {
  try {
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      const myEmpId = req.user.employeeId || req.user.id;
      const existing = db.getOne('SELECT employee_id FROM worklogs WHERE id = ?', [req.params.id]);
      if (existing && existing.employee_id !== myEmpId) {
        return res.status(403).json({ error: 'Forbidden: you cannot delete another user\'s worklog' });
      }
    }
    worklogsController.deleteWorklog(
      req.params.id,
      getUserName(req),
      getClientIp(req)
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/* ---------- Proof of payment (RBAC) ---------- */
router.get('/proofs', authenticate, (req, res, next) => {
  try {
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      return res.json([]);
    }
    res.json(proofsController.listProofs());
  } catch (err) {
    next(err);
  }
});

// Only Finance and Admin can upload / delete proof of payments
router.post('/proofs', authenticate, requireRole('finance', 'admin'), (req, res, next) => {
  try {
    const proof = proofsController.saveProof(
      req.body || {},
      getUserName(req),
      getClientIp(req)
    );
    res.status(201).json(proof);
  } catch (err) {
    next(err);
  }
});

router.delete('/proofs/:id', authenticate, requireRole('finance', 'admin'), (req, res, next) => {
  try {
    proofsController.deleteProof(
      req.params.id,
      getUserName(req),
      getClientIp(req)
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/* ---------- Employees (RBAC) ---------- */
router.get('/employees', authenticate, (req, res, next) => {
  try {
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      const myEmpId = req.user.employeeId || req.user.id;
      return res.json(employeesController.listEmployees(myEmpId));
    }
    res.json(employeesController.listEmployees());
  } catch (err) {
    next(err);
  }
});

router.get('/employees/:id', authenticate, (req, res, next) => {
  try {
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      const myEmpId = req.user.employeeId || req.user.id;
      if (req.params.id !== myEmpId) {
        return res.status(403).json({ error: 'Forbidden: you can only view your own employee information' });
      }
    }
    const emp = employeesController.getEmployeeById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  } catch (err) {
    next(err);
  }
});

// HR, PM and Admin can create new employee records
router.post('/employees', authenticate, requireRole('pm', 'hr', 'admin'), (req, res, next) => {
  try {
    const result = employeesController.createEmployee(
      req.body || {},
      getUserName(req),
      getClientIp(req),
      req.user && req.user.role
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// Update employee record
router.put('/employees/:id', authenticate, (req, res, next) => {
  try {
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      const myEmpId = req.user.employeeId || req.user.id;
      if (req.params.id !== myEmpId) {
        return res.status(403).json({ error: 'Forbidden: you cannot modify other employees' });
      }
    }
    let body = req.body || {};
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      // Self-service edits are limited to personal contact details; pay, role and org data stay with HR
      const SELF_FIELDS = ['name', 'first_name', 'last_name', 'phone', 'loc'];
      body = Object.fromEntries(Object.entries(body).filter(([k]) => SELF_FIELDS.includes(k)));
    }
    const result = employeesController.updateEmployee(
      req.params.id,
      body,
      { user: getUserName(req), ip: getClientIp(req) }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Forgotten password: HR/Admin (and a PM, for team accounts) issue a one-time password (shown once; replaced at sign-in)
// Remove an employee: preview → delete in cascade (only without payroll history) or deactivate (keeps history)
router.get('/employees/:id/removal', authenticate, requireRole('pm', 'admin'), (req, res, next) => {
  try { res.json(employeesController.employeeRemovalPreview(req.params.id, req.user)); } catch (err) { next(err); }
});
router.delete('/employees/:id', authenticate, requireRole('pm', 'admin'), (req, res, next) => {
  try { res.json(employeesController.deleteEmployee(req.params.id, req.user, getClientIp(req))); } catch (err) { next(err); }
});
router.post('/employees/:id/deactivate', authenticate, requireRole('pm', 'admin'), (req, res, next) => {
  try { res.json(employeesController.deactivateEmployee(req.params.id, req.user, getClientIp(req))); } catch (err) { next(err); }
});
// Login of an employee (role, last sign-in…) for the profile screen; changing the role is admin only
router.get('/employees/:id/account', authenticate, requireRole('pm', 'hr', 'admin'), (req, res, next) => {
  try { res.json(authService.accountForEmployee(req.params.id)); } catch (err) { next(err); }
});
// #admin "Users & roles": by login id, so accounts without an employee (or duplicates) can be managed too
router.put('/users/:id/role', authenticate, requireRole('admin'), (req, res, next) => {
  try { res.json(authService.setUserRole({ userId: req.params.id, role: (req.body || {}).role, actor: req.user, ip: getClientIp(req) })); } catch (err) { next(err); }
});
router.delete('/users/:id', authenticate, requireRole('admin'), (req, res, next) => {
  try { res.json(authService.deleteUser({ userId: req.params.id, actor: req.user, ip: getClientIp(req) })); } catch (err) { next(err); }
});
router.put('/employees/:id/account/role', authenticate, requireRole('admin'), (req, res, next) => {
  try { res.json(authService.setRoleForEmployee({ employeeId: req.params.id, role: (req.body || {}).role, actor: req.user, ip: getClientIp(req) })); } catch (err) { next(err); }
});
router.post('/employees/:id/reset-password', authenticate, requireRole('pm', 'hr', 'admin'), authController.resetEmployeePassword);

/* ---------- Contractors & Contractor Payments (RBAC) ---------- */
router.get('/contractors', authenticate, contractorsController.getContractorsList);
router.get('/contractors/:id', authenticate, contractorsController.getContractorById);
router.post(
  '/contractors',
  authenticate,
  requireRole('hr', 'pm', 'admin'),
  contractorsController.createContractorHandler
);
router.put(
  '/contractors/:id',
  authenticate,
  requireRole('hr', 'pm', 'admin'),
  contractorsController.updateContractorHandler
);
router.delete(
  '/contractors/:id',
  authenticate,
  requireRole('admin'),
  contractorsController.deleteContractorHandler
);

router.get('/contractor-payments', authenticate, contractorsController.getContractorPaymentsList);
// One payroll for everyone: contractors are paid from their approved timesheets in #processing, never twice
router.post('/contractor-payments', authenticate, (req, res) => {
  res.status(410).json({ error: 'Los pagos van por la nómina (#processing): los contratistas cobran desde sus hojas aprobadas.' });
});
router.patch(
  '/contractor-payments/:id',
  authenticate,
  requireRole('pm', 'finance', 'admin'),
  contractorsController.updateContractorPaymentHandler
);

/* ---------- Payroll Processing & Calculation Engine (Phase 3) ---------- */
// Preview or execute a payroll run calculation
router.post(
  '/payroll/calculate',
  authenticate,
  requireRole('pm', 'hr', 'finance', 'admin'),
  payrollController.calculateRun
);

// List all processed payroll runs
router.get('/payroll/runs', authenticate, requireRole('pm', 'finance', 'admin'), payrollController.listRuns);

// Get single payroll run details (Payroll Register)
router.get('/payroll/runs/:id', authenticate, requireRole('pm', 'finance', 'admin'), payrollController.getRunDetails);

// PM First-tier approval (validating reported hours vs activities)
router.post(
  '/payroll/runs/:id/pm-approve',
  authenticate,
  requireRole('pm', 'admin'),
  payrollController.pmApproveRun
);

// Approve a calculated payroll run (Owner / Finance and Admin only)
router.post(
  '/payroll/runs/:id/approve',
  authenticate,
  requireRole('admin', 'finance'),
  payrollController.approveRun
);

// Owner confirms the payment was executed: run → Paid, its timesheets → Paid, period → Paid
router.post('/payroll/runs/:id/paid', authenticate, requireRole('admin'), (req, res, next) => {
  try {
    res.json(payrollEngine.markPayrollRunPaid(req.params.id, getUserName(req), getClientIp(req)));
  } catch (err) {
    next(err);
  }
});

// Real-time preview for an employee compensation breakdown
router.post('/payroll/preview-employee', authenticate, payrollController.previewEmployee);

/* ---------- Banking Rails, Payments & Paystubs (Phase 7) ---------- */
router.get('/payroll/export/nacha', authenticate, requireRole('finance', 'admin'), bankingRailsController.exportNacha);
router.get('/payroll/export/bhd', authenticate, requireRole('finance', 'admin'), bankingRailsController.exportBhd);
router.get('/payroll/export/usdc', authenticate, requireRole('finance', 'admin'), bankingRailsController.exportUsdcBatch);
router.post('/payroll/rails/usdc/confirm', authenticate, requireRole('finance', 'admin'), bankingRailsController.confirmUsdcTransaction);
// Pay stubs issued from saved payroll runs. Payroll staff see any employee and any run status;
// everyone else only sees their own stubs from approved runs.
router.get('/payroll/paystubs', authenticate, (req, res, next) => {
  try {
    const payrollStaff = req.user && ['admin', 'pm', 'hr', 'finance'].includes(req.user.role);
    const empId = payrollStaff ? (req.query.empId || req.query.employeeId) : (req.user && (req.user.employeeId || req.user.id));
    if (!empId) return res.json([]);
    res.json(payrollEngine.listEmployeePaystubs(empId, { issuedOnly: !payrollStaff }));
  } catch (err) {
    next(err);
  }
});
router.get('/payroll/paystub/:employeeId/:periodId', authenticate, (req, res, next) => {
  if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
    const myEmpId = req.user.employeeId || req.user.id;
    if (req.params.employeeId !== myEmpId) {
      return res.status(403).json({ error: 'Forbidden: you can only view your own pay statement' });
    }
  }
  return bankingRailsController.getPaystub(req, res, next);
});
router.get('/payroll/paystub/:employeeId/:periodId/html', authenticate, (req, res, next) => {
  if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
    const myEmpId = req.user.employeeId || req.user.id;
    if (req.params.employeeId !== myEmpId) {
      return res.status(403).send('<h3>Forbidden: you can only view your own pay statement</h3>');
    }
  }
  return bankingRailsController.renderPaystubHtml(req, res, next);
});

/* ---------- Parallel Pilot Reconciliation (Phase 10) ---------- */
router.post(
  '/payroll/reconcile-parallel',
  authenticate,
  requireRole('finance', 'auditor', 'admin'),
  payrollController.reconcileParallel
);

router.get(
  '/payroll/reconcile-parallel/:periodId',
  authenticate,
  requireRole('finance', 'auditor', 'admin'),
  payrollController.getReconciliationAudit
);

/* ---------- Formal Multi-Department Sign-offs (Phase 10) ---------- */
router.post(
  '/payroll/sign-off',
  authenticate,
  requireRole('pm', 'finance', 'auditor', 'admin'),
  signoffController.recordSignoff
);

router.get(
  '/payroll/sign-off/:periodId',
  authenticate,
  signoffController.getSignoffs
);

/* ---------- Progressive Multi-HQ Rollout (Phase 10) ---------- */
router.get(
  '/rollout/status',
  authenticate,
  rolloutController.getRolloutStatus
);

router.patch(
  '/rollout/:orgId',
  authenticate,
  requireRole('admin', 'finance'),
  rolloutController.updateRolloutStage
);

/* ---------- Audit logs (RBAC) ---------- */
// Only Auditor, Finance, and Admin can view full audit trail
router.get('/audit', authenticate, requireRole('auditor', 'finance', 'admin'), (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const entityType = req.query.entity || null;
    res.json(auditController.getAuditLogs({ limit, offset, entityType }));
  } catch (err) {
    next(err);
  }
});

/* ---------- Attendance (Punches, Exceptions, Holidays) ---------- */
router.get('/attendance/punches', authenticate, (req, res, next) => {
  try {
    let { empId, date, dateFrom, dateTo } = req.query;
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      empId = req.user.employeeId || req.user.id;
    }
    res.json(attendanceController.listPunches({ empId, date, dateFrom, dateTo }));
  } catch (err) {
    next(err);
  }
});

router.post('/attendance/punches', authenticate, (req, res, next) => {
  try {
    const body = { ...(req.body || {}) };
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      body.empId = req.user.employeeId || req.user.id;
    }
    const punch = attendanceController.recordPunch(body, getUserName(req), getClientIp(req));
    res.status(201).json(punch);
  } catch (err) {
    next(err);
  }
});

router.get('/attendance/exceptions', authenticate, (req, res, next) => {
  try {
    let { empId, resolved } = req.query;
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      empId = req.user.employeeId || req.user.id;
    }
    res.json(attendanceController.listExceptions({
      empId,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
    }));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/attendance/exceptions/:id',
  authenticate,
  requireRole('supervisor', 'pm', 'hr', 'finance', 'admin'),
  (req, res, next) => {
    try {
      const resolved = attendanceController.resolveException(
        req.params.id,
        req.body || {},
        getUserName(req),
        getClientIp(req)
      );
      res.json(resolved);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/attendance/holidays', authenticate, (req, res, next) => {
  try {
    const { orgId, year } = req.query;
    res.json(attendanceController.listHolidays({ orgId, year: year ? Number(year) : undefined }));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/attendance/holidays',
  authenticate,
  requireRole('hr', 'pm', 'admin'),
  (req, res, next) => {
    try {
      const holiday = attendanceController.createHoliday(req.body || {}, getUserName(req), getClientIp(req));
      res.status(201).json(holiday);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/attendance/holidays/:id',
  authenticate,
  requireRole('hr', 'pm', 'admin'),
  (req, res, next) => {
    try {
      const result = attendanceController.deleteHoliday(req.params.id, getUserName(req), getClientIp(req));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Leave Requests ---------- */
router.get('/leave', authenticate, (req, res, next) => {
  try {
    let { empId, status } = req.query;
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      empId = req.user.employeeId || req.user.id;
    }
    res.json(leaveController.listLeaveRequests({ empId, status }));
  } catch (err) {
    next(err);
  }
});

router.post('/leave', authenticate, (req, res, next) => {
  try {
    const body = { ...(req.body || {}) };
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      body.empId = req.user.employeeId || req.user.id;
      if (req.user.name) body.name = req.user.name;
    }
    const request = leaveController.createLeaveRequest(body, getUserName(req), getClientIp(req));
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/leave/:id/review',
  authenticate,
  (req, res, next) => {
    try {
      // Reviewers approve/reject; an employee may only cancel their own request
      const reviewer = req.user && ['supervisor', 'pm', 'hr', 'finance', 'admin'].includes(req.user.role);
      const own = db.getOne('SELECT employee_id FROM leave_requests WHERE id = ?', [req.params.id]);
      const action = req.body && req.body.action;
      if (!reviewer) {
        const myEmpId = req.user && (req.user.employeeId || req.user.id);
        if (!(action === 'cancel' && own && own.employee_id === myEmpId)) {
          return res.status(403).json({ error: 'Forbidden: only reviewers can approve or reject; employees can cancel their own requests' });
        }
      } else if (action !== 'cancel' && own && actsOnSelf(req.user, own.employee_id)) {
        // Cancelling your own request is always yours to do; approving or rejecting it is not.
        return res.status(403).json({ error: 'Forbidden: you cannot approve or reject your own leave request' });
      }
      const updated = leaveController.reviewLeaveRequest(
        req.params.id,
        // Cancelling your own request is recorded as the employee, not as a supervisor
        action === 'cancel' && own && actsOnSelf(req.user, own.employee_id) ? { ...(req.body || {}), role: 'Employee' } : (req.body || {}),
        getUserName(req),
        getClientIp(req)
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Multi-HQ Organizations & Workflow Engine ---------- */
router.get('/organizations', authenticate, (req, res, next) => {
  try {
    res.json(workflowsController.listOrganizations());
  } catch (err) {
    next(err);
  }
});

router.get('/organizations/:id', authenticate, (req, res, next) => {
  try {
    const config = workflowsController.getOrgConfig(req.params.id);
    if (!config) return res.status(404).json({ error: 'Organization not found' });
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/organizations/:id',
  authenticate,
  requireRole('admin', 'cfo', 'finance'),
  (req, res, next) => {
    try {
      const updated = workflowsController.updateOrgConfig(
        req.params.id,
        req.body || {},
        getUserName(req),
        getClientIp(req)
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/workflows/split-ot', authenticate, (req, res, next) => {
  try {
    const { dailyHours, otConfig } = req.body || {};
    const result = workflowsController.splitOT(dailyHours, otConfig);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/* ---------- Timesheets State Machine ---------- */
router.get('/timesheets', authenticate, (req, res, next) => {
  try {
    let { periodId, empId, live } = req.query;
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      empId = req.user.employeeId || req.user.id;
    }
    res.json(timesheetsController.listTimesheets({ periodId, empId, live: live === '1' || live === 'true' }));
  } catch (err) {
    next(err);
  }
});

router.get('/timesheets/:id', authenticate, (req, res, next) => {
  try {
    const ts = timesheetsController.getTimesheet(req.params.id);
    if (!ts) return res.status(404).json({ error: 'Timesheet not found' });
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      const myEmpId = req.user.employeeId || req.user.id;
      if (ts.emp !== myEmpId) {
        return res.status(403).json({ error: 'Forbidden: you can only view your own timesheet' });
      }
    }
    res.json(ts);
  } catch (err) {
    next(err);
  }
});

router.get(
  '/timesheets/:id/reconciliation',
  authenticate,
  requireRole('pm', 'admin', 'supervisor', 'finance'),
  (req, res, next) => {
    try {
      const data = timesheetsController.getTimesheetReconciliation(req.params.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/timesheets/ensure', authenticate, (req, res, next) => {
  try {
    let { empId, periodId, defaultName } = req.body || {};
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      empId = req.user.employeeId || req.user.id;
      if (req.user.name) defaultName = req.user.name;
    }
    if (!empId || !periodId) {
      return res.status(400).json({ error: 'empId and periodId are required' });
    }
    const ts = timesheetsController.ensureTimesheet(empId, periodId, defaultName);
    res.json(ts);
  } catch (err) {
    next(err);
  }
});

router.post('/timesheets/:id/submit', authenticate, (req, res, next) => {
  try {
    const existing = timesheetsController.getTimesheet(req.params.id);
    if (existing && !isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      const myEmpId = req.user.employeeId || req.user.id;
      if (existing.emp !== myEmpId) {
        return res.status(403).json({ error: 'Forbidden: you cannot submit another user\'s timesheet' });
      }
    }
    const ts = timesheetsController.submitTimesheet(req.params.id, getUserName(req), getClientIp(req));
    res.json(ts);
  } catch (err) {
    next(err);
  }
});

// Two-step review: step 0 (PM review) by supervisor/PM/HR/admin; step 1+ (owner review & payment) by the admin/owner only.
// Nobody but the admin acts on their own sheet.
const REVIEWER_ROLES = ['supervisor', 'pm', 'hr', 'finance', 'admin'];
function reviewStepError(user, ts) {
  if (!ts) return null;
  if (user.role !== 'admin' && user.employeeId && ts.emp === user.employeeId) return 'You cannot review your own timesheet';
  if (Number(ts.stepIdx) >= 1 && user.role !== 'admin') return 'This timesheet is at the owner review step; only the owner (admin) can act on it';
  return null;
}

// PM / owner partial approval of one activity's hours (comment required when not approving all)
router.post('/timesheets/:id/activities/:activityId/review', authenticate, requireRole(...REVIEWER_ROLES), (req, res, next) => {
  try {
    const stepError = reviewStepError(req.user, timesheetsController.getTimesheet(req.params.id));
    if (stepError) return res.status(403).json({ error: stepError });
    res.json(timesheetsController.reviewActivity(req.params.id, req.params.activityId, { ...(req.body || {}), role: req.user.role }, getUserName(req), getClientIp(req)));
  } catch (err) {
    next(err);
  }
});

// Comments on a sheet (reviewers, or the employee who owns it) — persisted in the sheet history
router.post('/timesheets/:id/comments', authenticate, (req, res, next) => {
  try {
    const ts = timesheetsController.getTimesheet(req.params.id);
    if (!ts) return res.status(404).json({ error: 'Timesheet not found' });
    const isOwner = req.user.employeeId && ts.emp === req.user.employeeId;
    if (!isOwner && !REVIEWER_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Not allowed to comment on this timesheet' });
    res.json(timesheetsController.addComment(req.params.id, { comment: (req.body || {}).comment, role: isOwner ? 'Employee' : req.user.role }, getUserName(req), getClientIp(req)));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/timesheets/:id/approve',
  authenticate,
  requireRole('supervisor', 'pm', 'hr', 'finance', 'admin'),
  (req, res, next) => {
    try {
      // Nobody approves their own timesheet (except the admin/owner, who is the last approver)
      const target = timesheetsController.getTimesheet(req.params.id);
      if (target && req.user.role !== 'admin' && req.user.employeeId && target.emp === req.user.employeeId) {
        return res.status(403).json({ error: 'You cannot approve your own timesheet' });
      }
      const stepError = reviewStepError(req.user, target);
      if (stepError) return res.status(403).json({ error: stepError });
      const ts = timesheetsController.approveTimesheet(
        req.params.id,
        req.body || {},
        getUserName(req),
        getClientIp(req)
      );
      res.json(ts);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/timesheets/:id/return',
  authenticate,
  requireRole('supervisor', 'pm', 'hr', 'finance', 'admin'),
  (req, res, next) => {
    try {
      const stepError = reviewStepError(req.user, timesheetsController.getTimesheet(req.params.id));
      if (stepError) return res.status(403).json({ error: stepError });
      const ts = timesheetsController.returnTimesheet(
        req.params.id,
        req.body || {},
        getUserName(req),
        getClientIp(req)
      );
      res.json(ts);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/timesheets/:id/hours',
  authenticate,
  requireRole('supervisor', 'pm', 'hr', 'finance', 'admin'),
  (req, res, next) => {
    try {
      const ts = timesheetsController.saveTimesheetHours(
        req.params.id,
        req.body || {},
        getUserName(req),
        getClientIp(req)
      );
      res.json(ts);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Daily Activities & Deliverable-based Timekeeping ---------- */
router.get('/activities', authenticate, (req, res, next) => {
  try {
    let { empId, employeeId, date, dateFrom, dateTo } = req.query;
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      empId = req.user.employeeId || req.user.id;
      employeeId = req.user.employeeId || req.user.id;
    }
    res.json(activitiesController.listActivities({ empId: empId || employeeId, date, dateFrom, dateTo }));
  } catch (err) {
    next(err);
  }
});

// Roles that may log one meeting for several attendees (POST /activities with `attendees`)
const MEETING_ORGANIZER_ROLES = ['pm', 'supervisor', 'admin'];

// Activities belong to their employee: only they log/change them (admin may correct), and only while the
// quincena's timesheet is still Draft/Returned. After submission corrections go through "return" by the reviewer.
function activityWriteError(user, empId, date) {
  const myEmpId = user && (user.employeeId || user.id);
  if (user && user.role !== 'admin' && empId && empId !== myEmpId) {
    return { status: 403, error: 'You can only log or change your own activities' };
  }
  if (empId && date) {
    const periodId = timesheetsController.periodIdForDate(date);
    const ts = db.getOne('SELECT status FROM timesheets WHERE employee_id = ? AND period_id = ?', [empId, periodId]);
    if (ts && !timesheetsController.EDITABLE.includes(ts.status)) {
      return { status: 409, error: `The ${periodId} timesheet is ${ts.status}; it can no longer be edited` };
    }
  }
  return null;
}

router.post('/activities', authenticate, (req, res, next) => {
  try {
    const body = { ...(req.body || {}) };
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      body.empId = req.user.employeeId || req.user.id;
      body.employeeId = req.user.employeeId || req.user.id;
    }
    // No employee given → the signed-in user's own record (e.g. a PM logging their own time)
    if (!body.employeeId && !body.empId && req.user && req.user.employeeId) {
      body.empId = req.user.employeeId;
      body.employeeId = req.user.employeeId;
    }
    const blocked = activityWriteError(req.user, body.employeeId || body.empId, body.date);
    if (blocked) return res.status(blocked.status).json({ error: blocked.error });
    const attendees = Array.isArray(body.attendees) ? body.attendees.filter(Boolean) : [];
    if (attendees.length) {
      // Only PM / supervisor / admin log a meeting for other people, and only meetings
      if (!req.user || !MEETING_ORGANIZER_ROLES.includes(req.user.role)) {
        return res.status(403).json({ error: 'Only a PM, supervisor or admin can add meeting attendees' });
      }
      if ((body.workType || body.work_type) !== 'Reunión') {
        return res.status(400).json({ error: 'Attendees can only be added to a meeting (workType Reunión)' });
      }
      return res.status(201).json(activitiesController.createMeeting(body, attendees, getUserName(req), getClientIp(req)));
    }
    const activity = activitiesController.createActivity(
      body,
      getUserName(req),
      getClientIp(req)
    );
    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
});

router.put('/activities/:id', authenticate, (req, res, next) => {
  try {
    const existing = db.getOne('SELECT employee_id, date FROM daily_activities WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Activity not found' });
    const body = req.body || {};
    // Both the current day and the new one (if the date moves) must be on an editable sheet
    for (const date of new Set([existing.date, body.date || existing.date])) {
      const blocked = activityWriteError(req.user, existing.employee_id, date);
      if (blocked) return res.status(blocked.status).json({ error: blocked.error });
    }
    res.json(activitiesController.updateActivity(req.params.id, body, getUserName(req), getClientIp(req)));
  } catch (err) {
    next(err);
  }
});

router.delete('/activities/:id', authenticate, (req, res, next) => {
  try {
    const existing = db.getOne('SELECT employee_id, date FROM daily_activities WHERE id = ?', [req.params.id]);
    if (existing) {
      const blocked = activityWriteError(req.user, existing.employee_id, existing.date);
      if (blocked) return res.status(blocked.status).json({ error: blocked.error });
    }
    const result = activitiesController.deleteActivity(
      req.params.id,
      getUserName(req),
      getClientIp(req)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/activities/summary', authenticate, (req, res, next) => {
  try {
    let { empId, employeeId, date } = req.query;
    if (!isPrivileged(req.user) && req.user && (req.user.role === 'employee' || req.user.role === 'contractor')) {
      empId = req.user.employeeId || req.user.id;
      employeeId = req.user.employeeId || req.user.id;
    }
    res.json(activitiesController.getActivitySummary(empId || employeeId, date));
  } catch (err) {
    next(err);
  }
});

/* ---------- File Attachments & Secure Uploads ---------- */
router.post('/upload', authenticate, uploadsController.uploadFile);
router.get('/uploads', authenticate, uploadsController.listFiles);
router.get('/uploads/:id', uploadsController.serveFile);
router.get('/uploads/download/:id', uploadsController.downloadFile);
router.delete('/uploads/:id', authenticate, uploadsController.deleteFile);

/* ---------- Projects & Jira Integration (Phase 7 & PM CRUD) ---------- */
// Project access: PM / HR / finance / admin see and manage every project. Employees, contractors and supervisors
// only see projects they are members of (project_members by employee id, or their profile's project).
const PROJECT_SCOPED_ROLES = ['employee', 'contractor', 'supervisor'];
const projectScoped = (user) => !!user && PROJECT_SCOPED_ROLES.includes(String(user.role || '').toLowerCase());
function requireProjectMember(req, res, next) {
  if (!projectScoped(req.user)) return next();
  if (!agileService.resolveProject(req.params.key)) return res.status(404).json({ error: 'Project not found' });
  if (!agileService.isMember(req.params.key, req.user.employeeId)) {
    return res.status(403).json({ error: 'You are not a member of this project' });
  }
  return next();
}
// Task-level access for scoped roles: member of the task's project; changes only on tasks assigned to them
function taskAccess({ write = false } = {}) {
  return (req, res, next) => {
    if (!projectScoped(req.user)) return next();
    const task = agileService.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!agileService.isMember(task.project_id, req.user.employeeId)) return res.status(403).json({ error: 'You are not a member of this project' });
    if (write) {
      if (task.assignee_id && task.assignee_id !== req.user.employeeId) return res.status(403).json({ error: 'You can only update tasks assigned to you' });
      const b = req.body || {};
      const newAssignee = b.assignee_id || b.assigneeId;
      if (newAssignee && newAssignee !== req.user.employeeId) return res.status(403).json({ error: 'Only a PM can assign tasks to other people' });
    }
    return next();
  };
}
function listProjectsScoped(req, res, next) {
  try {
    const list = jiraService.listProjects();
    if (!projectScoped(req.user)) return res.json(list);
    const mine = new Set(agileService.projectsForEmployee(req.user.employeeId).map((p) => p.key));
    return res.json(list.filter((p) => mine.has(p.key)));
  } catch (err) {
    return next(err);
  }
}

router.get('/jira/status', authenticate, jiraController.getStatus);
router.get('/jira/projects', authenticate, listProjectsScoped);
router.post('/jira/projects', authenticate, requireRole('pm', 'admin'), jiraController.createProject);
router.put('/jira/projects/:key', authenticate, requireRole('pm', 'admin'), jiraController.updateProject);
router.delete('/jira/projects/:key', authenticate, requireRole('pm', 'admin'), jiraController.deleteProject);

router.get('/projects', authenticate, listProjectsScoped);
router.post('/projects', authenticate, requireRole('pm', 'admin'), jiraController.createProject);
router.put('/projects/:key', authenticate, requireRole('pm', 'admin'), jiraController.updateProject);
router.delete('/projects/:key', authenticate, requireRole('pm', 'admin'), jiraController.deleteProject);

router.post('/jira/projects/link', authenticate, requireRole('pm', 'admin'), jiraController.linkProject);
router.get('/jira/projects/:key/issues', authenticate, requireProjectMember, jiraController.getProjectIssues);
router.post('/jira/projects/:key/sync', authenticate, requireRole('pm', 'admin'), jiraController.syncProject);
router.get('/jira/issues', authenticate, jiraController.searchIssues);
router.post('/jira/sync-issues', authenticate, requireRole('pm', 'supervisor', 'admin'), jiraController.syncIssues);
router.post('/jira/sync', authenticate, requireRole('pm', 'supervisor', 'admin'), jiraController.syncWorklogs);

/* ---------- Native Agile Management: Sprints, Tasks, Statuses & Cloner ---------- */
// Sprints
router.get('/projects/:key/sprints', authenticate, requireProjectMember, agileController.listSprints);
router.post('/projects/:key/sprints', authenticate, requireRole('pm', 'admin'), agileController.createSprint);
router.put('/sprints/:id', authenticate, requireRole('pm', 'admin'), agileController.updateSprint);
router.post('/sprints/:id/start', authenticate, requireRole('pm', 'admin'), agileController.startSprint);
router.post('/sprints/:id/complete', authenticate, requireRole('pm', 'admin'), agileController.completeSprint);
router.delete('/sprints/:id', authenticate, requireRole('pm', 'admin'), agileController.deleteSprint);

// Tasks: members see their projects' tasks; they create tasks (assigned to themselves) and update tasks assigned
// to them; PM/admin manage everything
router.get('/tasks/search', authenticate, (req, res, next) => {
  try {
    const { query = '', projectKey, assigneeId, limit = 15, mine } = req.query;
    const projectIds = projectScoped(req.user) ? agileService.projectsForEmployee(req.user.employeeId).map((p) => p.id) : null;
    const assignee = mine === '1' || mine === 'true' ? req.user.employeeId : assigneeId;
    res.json(agileService.searchAllTasks({ query, projectKey, assigneeId: assignee, limit, projectIds }));
  } catch (err) {
    next(err);
  }
});
router.get('/projects/:key/tasks', authenticate, requireProjectMember, agileController.listTasks);
router.post('/projects/:key/tasks', authenticate, requireProjectMember, (req, res, next) => {
  if (projectScoped(req.user)) {
    const body = { ...(req.body || {}) };
    delete body.assignee_id; delete body.assignee_name; delete body.assigneeName;
    req.body = { ...body, assigneeId: req.user.employeeId };
  }
  return agileController.createTask(req, res, next);
});
router.get('/tasks/:id', authenticate, taskAccess(), agileController.getTask);
router.put('/tasks/:id', authenticate, taskAccess({ write: true }), agileController.updateTask);
router.patch('/tasks/:id/move', authenticate, taskAccess({ write: true }), agileController.moveTask);
router.delete('/tasks/:id', authenticate, requireRole('pm', 'admin'), agileController.deleteTask);

// Workflow Statuses (Configurable per project)
router.get('/projects/:key/statuses', authenticate, requireProjectMember, agileController.getStatuses);
router.post('/projects/:key/statuses', authenticate, requireRole('pm', 'admin'), agileController.createStatus);
router.put('/projects/:key/statuses', authenticate, requireRole('pm', 'admin'), agileController.updateStatuses);
router.delete('/projects/:key/statuses/:id', authenticate, requireRole('pm', 'admin'), agileController.deleteStatus);

// Jira Legacy Cloner
router.post('/jira/clone-issue', authenticate, requireRole('pm', 'admin'), agileController.cloneJiraIssue);

// Project Members
router.get('/projects/:key/members', authenticate, requireProjectMember, agileController.listMembers);
router.post('/projects/:key/members', authenticate, requireRole('pm', 'admin'), agileController.addMember);
router.delete('/projects/:key/members/:userId', authenticate, requireRole('pm', 'admin'), agileController.removeMember);

/* ---------- Dev helper ---------- */
router.post('/dev/reset', authenticate, requireRole('admin'), (req, res) => {
  // Wipes and re-seeds the database: never on Firestore/Postgres, and only in tests or with ALLOW_DEV_RESET=true
  if (!devResetAllowed(db.getDialect())) {
    return res.status(404).json({ error: 'Not found' });
  }
  db.reset();
  res.json({ ok: true, message: 'Database reset and re-seeded' });
});

module.exports = router;
