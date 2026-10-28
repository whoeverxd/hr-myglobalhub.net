const payrollEngine = require('../services/payroll-engine.service');
const reconciliationService = require('../services/reconciliation.service');
const employeesController = require('./employees.controller');

const getClientIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
const { getUserName } = require('../utils/actor');

function calculateRun(req, res, next) {
  try {
    const { periodId = 'PP-2025-08', entity = 'All', saveAsRun = false } = req.body || {};
    const result = payrollEngine.calculatePeriodPayroll({
      periodId,
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

function previewEmployee(req, res, next) {
  try {
    const { employeeId, rate, freq, tax, entity, loc, hours = 80, ot = 0 } = req.body || {};

    let employee = null;
    if (employeeId) {
      employee = employeesController.getEmployeeById(employeeId);
    }

    if (!employee) {
      employee = {
        id: employeeId || 'PREVIEW-01',
        name: 'Preview Contributor',
        role: 'Engineering',
        dept: 'Engineering',
        entity: entity || 'My Global Hub Dominicana SRL',
        rate: Number(rate) || 50,
        freq: freq || 'Bi-Weekly',
        tax: tax || 'DGII ISR + TSS (Dominican Republic)',
        loc: loc || 'Punta Cana, DR',
      };
    }

    const result = payrollEngine.calculateEmployeePeriodPayroll(employee, {
      regHours: Number(hours) || 80,
      otHours: Number(ot) || 0,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

function reconcileParallel(req, res, next) {
  try {
    const { periodId = 'PP-2025-08', runId = null, legacyItems = [] } = req.body || {};
    const report = reconciliationService.reconcileParallelRun({
      periodId,
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
    const periodId = req.params.periodId || 'PP-2025-08';
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
