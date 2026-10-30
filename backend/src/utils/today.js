// Business "today" is Santo Domingo time (America/Santo_Domingo: UTC-4 all year, no DST), the same date the
// frontend shows. UTC would already be "tomorrow" every evening from 20:00 local time.
const SANTO_DOMINGO_OFFSET_MS = 4 * 3600e3;

// YYYY-MM-DD in Santo Domingo. Reads Date.now() so callers (and tests) share one clock.
function todayLocal(now = Date.now()) {
  const ms = now instanceof Date ? now.getTime() : Number(now);
  return new Date(ms - SANTO_DOMINGO_OFFSET_MS).toISOString().slice(0, 10);
}

function currentYearLocal(now = Date.now()) {
  return Number(todayLocal(now).slice(0, 4));
}

// An instant for a row we write ourselves. Same shape the Firestore adapter already stamps on created_at, so
// ordering by a timestamp never compares two different spellings of the same moment.
function nowStamp(now = Date.now()) {
  const ms = now instanceof Date ? now.getTime() : Number(now);
  return new Date(ms).toISOString();
}

module.exports = { todayLocal, currentYearLocal, nowStamp };
