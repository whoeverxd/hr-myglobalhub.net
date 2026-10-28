// A pay period is always explicit: there is no "default" quincena to fall back on.
function requirePeriodId(periodId) {
  if (typeof periodId !== 'string' || !periodId.trim()) {
    const err = new Error('periodId requerido');
    err.status = 400;
    throw err;
  }
  return periodId.trim();
}

module.exports = { requirePeriodId };
