const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const workflowsController = require('../src/controllers/workflows.controller');
const attendanceController = require('../src/controllers/attendance.controller');
const leaveController = require('../src/controllers/leave.controller');
const timesheetsController = require('../src/controllers/timesheets.controller');
const activitiesController = require('../src/controllers/activities.controller');

/* ----------------------------------------------------
   1. Multi-HQ Overtime Engine (splitOT)
   ---------------------------------------------------- */
test('Workflow & Tenancy: Overtime splitting calculations adhere to jurisdiction rules', () => {
  // Scenario A: Dominican Republic standard (44h weekly threshold)
  const drHours = [8.8, 8.8, 8.8, 8.8, 8.8, 5]; // 49 hours total
  const drSplit = workflowsController.splitOT(drHours, { rule: 'weekly', weekly: 44 });
  assert.equal(drSplit.total, 49);
  assert.equal(drSplit.regular, 44);
  assert.equal(drSplit.overtime, 5);

  // Scenario B: US standard (40h weekly threshold)
  const usHours = [10, 10, 10, 10, 5]; // 45 hours total
  const usSplit = workflowsController.splitOT(usHours, { rule: 'weekly', weekly: 40 });
  assert.equal(usSplit.total, 45);
  assert.equal(usSplit.regular, 40);
  assert.equal(usSplit.overtime, 5);

  // Scenario C: Daily threshold (e.g., 8 hours per day max regular)
  const dailyHours = [10, 8, 12, 6]; // 36 hours total
  const dailySplit = workflowsController.splitOT(dailyHours, { rule: 'daily', daily: 8 });
  assert.equal(dailySplit.total, 36);
  // day 1: 8 reg, 2 ot
  // day 2: 8 reg, 0 ot
  // day 3: 8 reg, 4 ot
  // day 4: 6 reg, 0 ot
  // Total regular = 8 + 8 + 8 + 6 = 30
  // Total overtime = 2 + 0 + 4 + 0 = 6
  assert.equal(dailySplit.regular, 30);
  assert.equal(dailySplit.overtime, 6);

  // Scenario D: Both Daily & Weekly (California style: max 8h/day, max 40h/week)
  const bothHours = [10, 10, 10, 10, 10]; // 50 hours total
  // Day by day with daily=8: reg=40, ot=10
  const bothSplit = workflowsController.splitOT(bothHours, { rule: 'both', daily: 8, weekly: 35 });
  // Daily passes 40 regular, but weekly cap is 35 -> reg=35, ot=15
  assert.equal(bothSplit.total, 50);
  assert.equal(bothSplit.regular, 35);
  assert.equal(bothSplit.overtime, 15);
});

test('Workflow & Tenancy: Organization configuration retrieval and updates', () => {
  const orgs = workflowsController.listOrganizations();
  assert.ok(Array.isArray(orgs));
  assert.ok(orgs.length >= 3);

  const drOrg = workflowsController.getOrgConfig('MGH Dominicana SRL');
  assert.ok(drOrg);
  assert.equal(drOrg.currency, 'DOP');
  assert.equal(drOrg.ot.weekly, 44);

  // Update DR overtime rule
  const updated = workflowsController.updateOrgConfig(
    'MGH Dominicana SRL',
    { ot: { rule: 'weekly', weekly: 44, daily: 8 } },
    'Admin User',
    '127.0.0.1'
  );
  assert.equal(updated.ot.weekly, 44);
});

/* ----------------------------------------------------
   2. Timesheets State Machine
   ---------------------------------------------------- */
test('Timesheets State Machine: Draft -> Submit -> Multi-level Approve -> Return', () => {
  const empId = 'MGH-TS-TEST'; // own employee id: no leave/activities from other fixtures
  const periodId = 'PP-2025-10'; // 16–31 May 2025
  db.execute(
    `INSERT OR IGNORE INTO employees (id, name, entity, dept, role, type, rate, status) VALUES (?, 'Timesheet Test', 'MGH Dominicana SRL', 'Engineering', 'Developer', 'Full-time', 40, 'Active')`,
    [empId]
  );
  db.execute('DELETE FROM timesheets WHERE employee_id = ? AND period_id = ?', [empId, periodId]);

  // 1. Ensure/create timesheet
  const ts = timesheetsController.ensureTimesheet(empId, periodId, 'Carlos Mendez');
  assert.ok(ts);
  assert.equal(ts.status, 'Draft');
  assert.equal(ts.emp, empId);

  // 2. Rules: nothing to submit without hours; a draft cannot be approved nor have its hours adjusted
  db.execute('DELETE FROM daily_activities WHERE employee_id = ? AND date >= ? AND date <= ?', [empId, '2025-05-16', '2025-05-31']);
  assert.throws(() => timesheetsController.submitTimesheet(ts.id, 'Carlos Mendez'), /No hours recorded/);
  assert.throws(() => timesheetsController.approveTimesheet(ts.id, { role: 'pm' }, 'Joshua Hernandez'), /under review/);
  assert.throws(() => timesheetsController.saveTimesheetHours(ts.id, { reg: 80 }, 'Joshua Hernandez'), /under review/);

  // 3. Hours come from the employee's activities: 8h on Mon 19 May + 9h on Tue 20 May 2025
  activitiesController.createActivity({ empId, date: '2025-05-19', hours: 8, jiraKey: 'TEST-1', description: 'Work' });
  activitiesController.createActivity({ empId, date: '2025-05-20', hours: 9, jiraKey: 'TEST-1', description: 'Work' });
  const live = timesheetsController.listTimesheets({ empId, periodId, live: true })[0];
  assert.equal(live.liveHours, true);
  assert.equal(live.reg + live.ot, 17, 'live preview sums the activities');

  const submitted = timesheetsController.submitTimesheet(ts.id, 'Carlos Mendez');
  assert.equal(submitted.status, 'PM Review');
  assert.equal(submitted.reg + submitted.ot, 17, 'worked hours frozen at submission');
  assert.ok(submitted.history.length >= 1);
  assert.equal(submitted.history[submitted.history.length - 1].to, 'PM Review');

  // Reviewer may adjust hours while under review
  const adjusted = timesheetsController.saveTimesheetHours(ts.id, { ot: 2 }, 'Joshua Hernandez');
  assert.equal(adjusted.ot, 2);

  // 4. Return timesheet (e.g. PM requests correction)
  const returned = timesheetsController.returnTimesheet(
    ts.id,
    { comment: 'Please adjust overtime on Friday' },
    'Joshua Hernandez'
  );
  assert.equal(returned.status, 'Returned');

  // 5. Re-submit timesheet
  const resubmitted = timesheetsController.submitTimesheet(ts.id, 'Carlos Mendez');
  assert.equal(resubmitted.status, 'PM Review');

  // 6. PM Approves (Step 1 -> moves to Owner Approval)
  const step1 = timesheetsController.approveTimesheet(
    ts.id,
    { comment: 'Hours verified against Jira worklogs', role: 'pm' },
    'Joshua Hernandez'
  );
  assert.equal(step1.status, 'Owner Approval');

  // 7. Owner/Admin Approves (Step 2 -> final Approved status)
  const finalApproved = timesheetsController.approveTimesheet(
    ts.id,
    { comment: 'Approved for payroll release', role: 'admin' },
    'Edwin Montalvo'
  );
  assert.equal(finalApproved.status, 'Approved');
  assert.ok(finalApproved.approvedAt);
});

/* ----------------------------------------------------
   3. Leave Requests Flow & Audit History
   ---------------------------------------------------- */
test('Leave Requests: Full approval lifecycle and audit trail', () => {
  const req = leaveController.createLeaveRequest(
    {
      empId: 'MGH-1044',
      name: 'Luis Rodriguez',
      type: 'Vacation',
      fromDate: '2025-06-01',
      toDate: '2025-06-05',
      reason: 'Annual summer vacation',
    },
    'Luis Rodriguez'
  );

  assert.ok(req);
  assert.equal(req.status, 'Pending Supervisor');
  assert.equal(req.emp, 'MGH-1044');

  // Supervisor reviews and approves -> moves to Pending HR
  const supReview = leaveController.reviewLeaveRequest(
    req.id,
    { action: 'approve', comment: 'Coverage confirmed by team' },
    'Marcus Vance'
  );
  assert.equal(supReview.status, 'Pending HR');

  // HR reviews and finalizes -> moves to Approved
  const hrReview = leaveController.reviewLeaveRequest(
    req.id,
    { action: 'approve', comment: 'Vacation balance verified' },
    'Roberto Gomez'
  );
  assert.equal(hrReview.status, 'Approved');
  assert.ok(hrReview.history.length >= 3);
});

/* ----------------------------------------------------
   4. Attendance Punches & Exceptions Management
   ---------------------------------------------------- */
test('Attendance: Record punch, list punches, and resolve exception', () => {
  const punchDate = '2025-04-20';
  const punch = attendanceController.recordPunch(
    {
      empId: 'MGH-1042',
      date: punchDate,
      clock_in: '08:25',
      lunch_out: '12:30',
      lunch_in: '13:30',
      clock_out: '17:05',
      day_type: 'Workday',
      mode: 'office',
      hours: 7.67,
      overtime: 0,
      note: 'Normal shift',
    },
    'Carlos Mendez'
  );

  assert.ok(punch);
  assert.equal(punch.emp, 'MGH-1042');
  assert.equal(punch.date, punchDate);

  // Retrieve punches
  const punches = attendanceController.listPunches({ empId: 'MGH-1042', date: punchDate });
  assert.ok(punches.length >= 1);
  assert.equal(punches[0].clock_in, '08:25');

  // Retrieve exceptions seeded in the database
  const exceptions = attendanceController.listExceptions();
  assert.ok(Array.isArray(exceptions));
  assert.ok(exceptions.length > 0);

  const targetEx = exceptions[0];
  const resolved = attendanceController.resolveException(
    targetEx.id,
    { status: 'resolved', notes: 'Overtime authorized retroactively by supervisor' },
    'Marcus Vance'
  );
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.notes, 'Overtime authorized retroactively by supervisor');
  assert.equal(resolved.resolved_by, 'Marcus Vance');
});

/* ----------------------------------------------------
   5. Statutory Holidays Management
   ---------------------------------------------------- */
test('Attendance Holidays: List statutory and create/delete holiday', () => {
  const holidays = attendanceController.listHolidays();
  assert.ok(Array.isArray(holidays));
  assert.ok(holidays.length >= 10);

  // Create special company holiday
  const newHol = attendanceController.createHoliday(
    {
      orgId: 'MGH Dominicana SRL',
      date: '2025-10-12',
      description: 'Company Innovation Day',
      paid: true,
      working: false,
    },
    'Roberto Gomez'
  );
  assert.ok(newHol);
  assert.equal(newHol.desc, 'Company Innovation Day');

  // Delete holiday
  const del = attendanceController.deleteHoliday(newHol.id, 'Roberto Gomez');
  assert.equal(del.ok, true);
});
