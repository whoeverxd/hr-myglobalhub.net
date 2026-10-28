const payrollEngine = require('../services/payroll-engine.service');
const reconciliationService = require('../services/reconciliation.service');
const employeesController = require('./employees.controller');

const getClientIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
const { getUserName } = require('../utils/actor');
const { requirePeriodId } = require('../utils/period');

function calculateRun(req, res, next) {
  try {
    const { periodId, entity = 'All', saveAsRun = false } = req.body || {};
    const result = payrollEngine.calculatePeriodPayroll({
      periodId: requirePeriodId(periodId),
      entity,
      saveAsRun: Boolean(saveAsRun),
      user: getUserName(req),
      ip: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function listRuns(req, res, next) {
  try {
    const runs = payrollEngine.listPayrollRuns();
    res.json(runs);
  } catch (err) {
    next(err);
  }
}

function getRunDetails(req, res, next) {
  try {
    const run = payrollEngine.getPayrollRunDetails(req.params.id);
    if (!run) {
      return res.status(404).json({ error: `Payroll run ${req.params.id} not found` });
    }
    res.json(run);
  } catch (err) {
    next(err);
  }
}

function pmApproveRun(req, res, next) {
  try {
    const result = payrollEngine.pmApprovePayrollRun(
      req.params.id,
      getUserName(req),
      getClientIp(req)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function approveRun(req, res, next) {
  try {
    const result = payrollEngine.approvePayrollRun(
      req.params.id,
      getUserName(req),
      getClientIp(req)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

const PAYROLL_STAFF = ['hr', 'finance', 'pm', 'admin'];

// What-if calculation for one employee. Nothing is invented: the employee must exist (and be your own record
// unless you are payroll staff), or the caller gives the rate; hours are always explicit.
function previewEmployee(req, res, next) {
  try {
    const { employeeId, rate, freq, tax, entity, loc, hours, ot = 0 } = req.body || {};
    const bad = (message, status = 400) => res.status(status).json({ error: message });

    const regHours = Number(hours);
    if (hours === undefined || hours === null || hours === '' || !Number.isFinite(regHours) || regHours < 0) {
      return bad('hours requerido');
    }

    let employee = null;
    if (employeeId) {
      const user = req.user || {};
      const own = String(employeeId) === String(user.employeeId || '');
      if (!own && !PAYROLL_STAFF.includes(user.role)) return bad('Forbidden', 403);
      employee = employeesController.getEmployeeById(employeeId);
      if (!employee) return bad(`Employee ${employeeId} not found`, 404);
    } else {
      const numRate = Number(rate);
      if (!Number.isFinite(numRate) || numRate <= 0) return bad('employeeId o rate requerido');
      employee = {
        id: null,
        name: '',
        role: '',
        dept: '',
        entity: entity || 'MGH Dominicana SRL',
        rate: numRate,
        freq: freq || 'Bi-Weekly',
        tax: tax || null,
        loc: loc || null,
      };
    }

    const result = payrollEngine.calculateEmployeePeriodPayroll(employee, {
      regHours,
      otHours: Number(ot) || 0,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

function reconcileParallel(req, res, next) {
  try {
    const { periodId, runId = null, legacyItems = [] } = req.body || {};
    const report = reconciliationService.reconcileParallelRun({
      periodId: requirePeriodId(periodId),
      runId,
      legacyItems,
      user: getUserName(req),
      ip: getClientIp(req),
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
}

function getReconciliationAudit(req, res, next) {
  try {
    const periodId = requirePeriodId(req.params.periodId);
    const history = reconciliationService.getReconciliationHistory(periodId);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  calculateRun,
  listRuns,
  getRunDetails,
  pmApproveRun,
  approveRun,
  previewEmployee,
  reconcileParallel,
  getReconciliationAudit,
};
