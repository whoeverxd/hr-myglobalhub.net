// Pay-period rules shared with the frontend (see frontend/src/lib/payroll.js).
// Quincenas PP-{YYYY}-{NN}: 1-15 and 16-end of month, 24 per year (same rule as frontend/src/lib/periodService.js).

const STATUSES = [
  'Draft', 'Open', 'Awaiting Employee Submission', 'Awaiting Supervisor Approval',
  'Awaiting Project Manager Approval', 'Awaiting HR Approval', 'Awaiting Finance Approval',
  'Processing Payroll', 'Approved', 'Paid', 'Closed', 'Archived',
];
const LOCKED = ['Approved', 'Paid', 'Closed', 'Archived'];
// Sealed periods: immutable. Corrections only via Payroll Adjustments in the next open period.
const SEALED = ['Closed', 'Archived'];

function periodId(year, n) {
  return `PP-${year}-${String(n).padStart(2, '0')}`;
}

function buildPeriods(year, overrides = {}, payOffsetDays = 6) {
  // Quincenal calendar (24 periods per year: 1-15 and 16-end of month)
  const out = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const pad = (v) => String(v).padStart(2, '0');

  for (let m = 0; m < 12; m++) {
    const lastDay = new Date(year, m + 1, 0).getDate();

    // Q1: 01 to 15
    const q1Num = m * 2 + 1;
    const q1Id = `PP-${year}-${pad(q1Num)}`;
    const q1Start = `${year}-${pad(m + 1)}-01`;
    const q1End = `${year}-${pad(m + 1)}-15`;
    const q1PayDate = `${year}-${pad(m + 1)}-20`;
    let q1Status = overrides[q1Id] || (todayStr > q1End ? 'Closed' : (todayStr >= q1Start ? 'Open' : 'Draft'));
    out.push({
      id: q1Id,
      n: q1Num,
      start: q1Start,
      end: q1End,
      payDate: q1PayDate,
      cutoff: `${q1End}T23:59`,
      status: q1Status,
      locked: LOCKED.includes(q1Status),
    });

    // Q2: 16 to lastDay (quincena de fin de mes)
    const q2Num = m * 2 + 2;
    const q2Id = `PP-${year}-${pad(q2Num)}`;
    const q2Start = `${year}-${pad(m + 1)}-16`;
    const q2End = `${year}-${pad(m + 1)}-${pad(lastDay)}`;
    const payNextMonth = m === 11 ? new Date(year + 1, 0, 5) : new Date(year, m + 1, 5);
    const q2PayDate = `${payNextMonth.getFullYear()}-${pad(payNextMonth.getMonth() + 1)}-${pad(payNextMonth.getDate())}`;
    let q2Status = overrides[q2Id] || (todayStr > q2End ? 'Closed' : (todayStr >= q2Start ? 'Open' : 'Draft'));
    out.push({
      id: q2Id,
      n: q2Num,
      start: q2Start,
      end: q2End,
      payDate: q2PayDate,
      cutoff: `${q2End}T23:59`,
      status: q2Status,
      locked: LOCKED.includes(q2Status),
    });
  }
  return out;
}


module.exports = { STATUSES, LOCKED, SEALED, buildPeriods };
