const db = require('./src/db');
const timesheetsController = require('./src/controllers/timesheets.controller');

const empId = 'MGH-1042';
const periodId = 'PP-2025-10';
db.execute('DELETE FROM timesheets WHERE employee_id = ? AND period_id = ?', [empId, periodId]);

const ts = timesheetsController.ensureTimesheet(empId, periodId, 'Carlos Mendez');
console.log('Ensure ts:', ts.step_index, typeof ts.step_index);

const sub = timesheetsController.submitTimesheet(ts.id, 'Carlos Mendez');
console.log('Submitted ts:', sub.step_index, typeof sub.step_index);

const ret = timesheetsController.returnTimesheet(ts.id, { comment: 'test' }, 'Joshua');
console.log('Returned ts:', ret.step_index, typeof ret.step_index);

const resub = timesheetsController.submitTimesheet(ts.id, 'Carlos Mendez');
console.log('Resubmitted ts:', resub.step_index, typeof resub.step_index);

const current = db.getOne('SELECT * FROM timesheets WHERE id = ?', [ts.id]);
console.log('Current in db:', current.step_index, typeof current.step_index);

const emp = db.getOne(`SELECT entity FROM employees WHERE id = ?`, [current.employee_id]);
console.log('Emp:', emp);
const { getOrgConfig } = require('./src/controllers/workflows.controller');
const orgCfg = getOrgConfig(emp ? emp.entity : 'MGH Dominicana SRL');
console.log('OrgCfg steps:', orgCfg ? orgCfg.steps : null);

try {
  const step1 = timesheetsController.approveTimesheet(ts.id, { comment: 'ok', role: 'pm' }, 'Joshua');
  console.log('Step 1:', step1);
} catch (e) {
  console.error('Error in approveTimesheet:', e);
}
