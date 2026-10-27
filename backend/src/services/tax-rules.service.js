const { round2, round4 } = require('../utils/money');

const DEFAULT_CONFIG = {
  version: '2025.1',
  dopFxRate: 60.50, // 1 USD = 60.50 DOP
  gbpFxRate: 0.79,  // 1 USD = 0.79 GBP
};

/**
 * Progressive tax bracket calculator
 * brackets: [ [cap, rate], ... ]
 */
function calculateProgressiveBracket(annualTaxableAmount, brackets) {
  let tax = 0;
  let previousCap = 0;

  for (const [cap, rate] of brackets) {
    if (annualTaxableAmount <= previousCap) break;
    const taxableInChunk = Math.min(annualTaxableAmount, cap) - previousCap;
    tax += taxableInChunk * rate;
    previousCap = cap;
  }

  return tax;
}

/**
 * Dominican Republic Statutory Deductions (TSS & DGII ISR)
 */
function calculateDominicanRepublicDeductions(grossPay, periodsPerYear, config = DEFAULT_CONFIG) {
  const fx = config.dopFxRate;
  const annualGross = grossPay * periodsPerYear;

  // TSS Deductions (Health and Pension)
  const afpRate = 0.0287; // 2.87% AFP
  const sfsRate = 0.0304; // 3.04% SFS
  const afpAmount = round2(grossPay * afpRate);
  const sfsAmount = round2(grossPay * sfsRate);
  const totalTssPeriod = afpAmount + sfsAmount;

  // DGII ISR: Net taxable income = Gross minus TSS employee contributions
  const annualTaxableDop = (annualGross - (totalTssPeriod * periodsPerYear)) * fx;

  const dgiiBrackets = [
    [416220.00, 0.00],
    [624329.00, 0.15],
    [867123.00, 0.20],
    [Infinity, 0.25],
  ];

  const annualIsrDop = calculateProgressiveBracket(annualTaxableDop, dgiiBrackets);
  const periodIsrUsd = round2(annualIsrDop / fx / periodsPerYear);

  return [
    { label: 'TSS — SFS (Salud 3.04%)', code: 'TSS_SFS', rate: '3.04%', amount: sfsAmount, statutory: true },
    { label: 'TSS — AFP (Pensión 2.87%)', code: 'TSS_AFP', rate: '2.87%', amount: afpAmount, statutory: true },
    { label: 'DGII — Retención ISR', code: 'DGII_ISR', rate: 'Escala Progresiva', amount: Math.max(0, periodIsrUsd), statutory: true },
  ];
}

/**
 * United States Statutory Deductions (IRS Federal, FICA & State)
 */
function calculateUnitedStatesDeductions(grossPay, periodsPerYear, location = '') {
  const annualGross = grossPay * periodsPerYear;

  // FICA: Social Security (6.2%) + Medicare (1.45%)
  const socialSecurity = round2(grossPay * 0.0620);
  const medicare = round2(grossPay * 0.0145);

  // Federal Income Tax (Single filer standard deduction $14,600)
  const standardDeduction = 14600;
  const taxableFederalAnnual = Math.max(0, annualGross - standardDeduction);

  const federalBrackets = [
    [11925, 0.10],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [Infinity, 0.32],
  ];

  const annualFederalTax = calculateProgressiveBracket(taxableFederalAnnual, federalBrackets);
  const periodFederalTax = round2(annualFederalTax / periodsPerYear);

  // State Tax estimate (0% for TX/FL/WA, 5% default for other states)
  const noStateTaxStates = ['TX', 'FL', 'WA', 'Austin, TX', 'Seattle, WA', 'Miami, FL'];
  const hasNoStateTax = noStateTaxStates.some((s) => location.includes(s));
  const stateTaxRate = hasNoStateTax ? 0 : 0.05;
  const periodStateTax = round2(grossPay * stateTaxRate);

  const lines = [
    { label: 'Social Security (FICA 6.2%)', code: 'US_SOC_SEC', rate: '6.20%', amount: socialSecurity, statutory: true },
    { label: 'Medicare (FICA 1.45%)', code: 'US_MEDICARE', rate: '1.45%', amount: medicare, statutory: true },
    { label: 'Federal Income Tax (W-4)', code: 'US_FED_TAX', rate: 'Progressive', amount: periodFederalTax, statutory: true },
  ];

  if (periodStateTax > 0) {
    lines.push({ label: 'State Income Tax (Est. 5%)', code: 'US_STATE_TAX', rate: '5.00%', amount: periodStateTax, statutory: true });
  }

  return lines;
}

/**
 * United Kingdom Statutory Deductions (HMRC PAYE & NI)
 */
function calculateUnitedKingdomDeductions(grossPay, periodsPerYear) {
  const annualGross = grossPay * periodsPerYear;
  const personalAllowance = 12570;
  const taxableAnnual = Math.max(0, annualGross - personalAllowance);

  // PAYE Brackets
  const payeBrackets = [
    [37700, 0.20],
    [112570, 0.40],
    [Infinity, 0.45],
  ];
  const annualPaye = calculateProgressiveBracket(taxableAnnual, payeBrackets);
  const periodPaye = round2(annualPaye / periodsPerYear);

  // National Insurance
  const niBrackets = [
    [37700, 0.08],
    [Infinity, 0.02],
  ];
  const annualNi = calculateProgressiveBracket(taxableAnnual, niBrackets);
  const periodNi = round2(annualNi / periodsPerYear);

  return [
    { label: 'HMRC — PAYE Income Tax', code: 'UK_PAYE', rate: '20%–45%', amount: periodPaye, statutory: true },
    { label: 'National Insurance (Class 1)', code: 'UK_NI', rate: '8% / 2%', amount: periodNi, statutory: true },
  ];
}

/**
 * Calculate all deductions according to employee tax profile and jurisdiction
 */
function calculateTaxDeductions({ grossPay, frequency = 'Bi-Weekly', taxProfile = '', entity = '', location = '', isExempt = false, config = DEFAULT_CONFIG }) {
  const periodsMap = {
    'Weekly': 52,
    'Bi-Weekly': 26,
    'Semi-Monthly': 24,
    'Monthly': 12,
  };
  const periodsPerYear = periodsMap[frequency] || 26;

  if (isExempt || /Exempt|Contractor/i.test(taxProfile)) {
    return {
      isExempt: true,
      lines: [],
      totalDeductions: 0,
    };
  }

  let lines = [];
  if (/DGII|TSS|Dominicana/i.test(taxProfile) || /Dominicana/i.test(entity)) {
    lines = calculateDominicanRepublicDeductions(grossPay, periodsPerYear, config);
  } else if (/W-4|USA/i.test(taxProfile) || /USA/i.test(entity)) {
    lines = calculateUnitedStatesDeductions(grossPay, periodsPerYear, location);
  } else if (/PAYE|HMRC|UK/i.test(taxProfile) || /UK/i.test(entity)) {
    lines = calculateUnitedKingdomDeductions(grossPay, periodsPerYear);
  }

  const totalDeductions = round2(lines.reduce((acc, l) => acc + l.amount, 0));

  return {
    isExempt: false,
    lines,
    totalDeductions,
  };
}

module.exports = {
  DEFAULT_CONFIG,
  calculateTaxDeductions,
  calculateDominicanRepublicDeductions,
  calculateUnitedStatesDeductions,
  calculateUnitedKingdomDeductions,
};
