/**
 * Centralized Pay Period & Quincena Service
 * Calculates the exact active period based on the current date (today)
 * or any given date, used consistently across all views (Dashboard, My Work,
 * Approvals, Pay Periods, Timesheets, Payroll Processing, etc.).
 */

export const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MONTHS_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

/**
 * Returns the exact quincenal pay period for any date.
 * If day <= 15: 1 al 15 del mes.
 * If day > 15: 15/16 al fin de mes (e.g. 15 al 31 de octubre).
 */
export function getQuincenaForDate(dateInput = new Date()) {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan, 9 = Oct, 10 = Nov
  const day = d.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const isFirstHalf = day <= 15;
  const periodNumber = month * 2 + (isFirstHalf ? 1 : 2);
  const pad = (n) => String(n).padStart(2, '0');
  const code = `PP-${year}-${pad(periodNumber)}`;

  const startDay = isFirstHalf ? 1 : 15;
  const endDay = isFirstHalf ? 15 : lastDay;

  const startDate = `${year}-${pad(month + 1)}-${pad(startDay)}`;
  const endDate = `${year}-${pad(month + 1)}-${pad(endDay)}`;

  const monthName = MONTHS_ES[month];
  const monthShort = MONTHS_SHORT_ES[month];

  const range = isFirstHalf
    ? `01 ${monthShort} – 15 ${monthShort}, ${year}`
    : `${startDay} ${monthShort} – ${endDay} ${monthShort}, ${year}`;

  const rangeShort = isFirstHalf
    ? `01 ${monthShort} – 15 ${monthShort}`
    : `${startDay} ${monthShort} – ${endDay} ${monthShort}`;

  const label = isFirstHalf
    ? `1 al 15 de ${monthName} ${year}`
    : `${startDay} al ${endDay} de ${monthName} ${year}`;

  // Next pay date (typically 5 days after period close)
  const payDateObj = new Date(year, month, endDay + 5);
  const payDate = `${payDateObj.getFullYear()}-${pad(payDateObj.getMonth() + 1)}-${pad(payDateObj.getDate())}`;

  // Cutoff
  const cutoff = `${endDate}T23:59`;

  // Dynamic phase / status relative to today
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const isCurrent = todayStr >= startDate && todayStr <= endDate;

  let status = 'Open';
  let phase = 'Fase de Registro y Aprobación';

  if (isCurrent) {
    status = 'Open';
    phase = 'Periodo Actual • En Curso';
  } else if (todayStr > endDate) {
    status = 'Awaiting Supervisor Approval';
    phase = 'Fase de Aprobación';
  } else {
    status = 'Draft';
    phase = 'Periodo Futuro • Programado';
  }

  // Days remaining in this period
  const msRemaining = new Date(`${endDate}T23:59:59`).getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  const DOW_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DOW_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const days = [];
  for (let dNum = startDay; dNum <= endDay; dNum++) {
    const curDate = new Date(year, month, dNum);
    const dateStr = `${year}-${pad(month + 1)}-${pad(dNum)}`;
    const dow = curDate.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isToday = dateStr === todayStr;

    days.push({
      dateStr,
      dayNum: dNum,
      dow,
      dowShort: DOW_ES[dow],
      dowFull: DOW_FULL[dow],
      isWeekend,
      isToday,
      dateObj: curDate,
    });
  }

  return {
    id: code,
    code,
    periodNumber,
    year,
    month,
    monthName,
    monthShort,
    isFirstHalf,
    startDay,
    endDay,
    lastDay,
    startDate,
    endDate,
    dateFrom: startDate,
    dateTo: endDate,
    periodId: code,
    payDate,
    cutoff,
    range,
    rangeShort,
    rangeParen: `(${range})`,
    label,
    status,
    phase,
    isCurrent,
    daysRemaining,
    days,
  };
}

export const calculateQuincena = getQuincenaForDate;


/**
 * Returns the currently active pay period based on real local time.
 */
export function getCurrentPeriod() {
  return getQuincenaForDate(new Date());
}

/**
 * Generates all 24 quincenas of any given year.
 */
export function getPeriodsForYear(year = new Date().getFullYear()) {
  const periods = [];
  for (let m = 0; m < 12; m++) {
    periods.push(getQuincenaForDate(new Date(year, m, 5)));
    periods.push(getQuincenaForDate(new Date(year, m, 20)));
  }
  return periods;
}

// Global hook for design system and window utilities
if (typeof window !== 'undefined') {
  window.MGH_PERIOD = {
    get current() {
      return getCurrentPeriod();
    },
    forDate: getQuincenaForDate,
    forYear: getPeriodsForYear,
  };
}
