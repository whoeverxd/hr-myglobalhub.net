/**
 * Precise monetary and rounding helpers to avoid floating-point math issues.
 */

function round2(num) {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

function round4(num) {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 10000) / 10000;
}

function toCents(amount) {
  return Math.round((Number(amount) || 0) * 100);
}

function fromCents(cents) {
  return (Number(cents) || 0) / 100;
}

function sumCents(...amounts) {
  const totalCents = amounts.reduce((acc, a) => acc + toCents(a), 0);
  return fromCents(totalCents);
}

function formatCurrency(amount, currency = 'USD') {
  const val = round2(amount);
  const formatted = val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  switch (currency) {
    case 'DOP':
      return `RD$ ${formatted}`;
    case 'GBP':
      return `£${formatted}`;
    case 'EUR':
      return `€${formatted}`;
    case 'USD':
    default:
      return `$${formatted}`;
  }
}

module.exports = {
  round2,
  round4,
  toCents,
  fromCents,
  sumCents,
  formatCurrency,
};
