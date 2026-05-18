export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Eastern",
  "Central",
  "Northern",
  "Volta",
  "Upper East",
  "Upper West",
  "Brong-Ahafo",
  "Bono East",
  "Ahafo",
  "Western North",
  "Oti",
  "North East",
  "Savannah",
] as const;

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "telecel_cash", label: "Telecel Cash" },
  { value: "airteltigo", label: "AirtelTigo Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
] as const;

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Stock Purchase",
  "Transport",
  "Marketing",
  "Maintenance",
  "Insurance",
  "Miscellaneous",
] as const;

export const TAX_RATES = {
  VAT: 0.15,
  NHIL: 0.025,
  GETFL: 0.01,
} as const;

export function formatGHS(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Ghana Payroll Calculations ────────────────────────────────────────────────

/**
 * Ghana SSNIT contributions (Tier 1).
 * Employee: 5.5% of basic salary.
 * Employer: 13% of basic salary (10.5% SSNIT + 2.5% NHIA).
 */
export function calculateSSNIT(basicSalary: number): {
  employeeSSNIT: number;
  employerSSNIT: number;
  nhia: number;
  totalEmployer: number;
} {
  const employeeSSNIT = basicSalary * 0.055;
  const nhia          = basicSalary * 0.025;
  const employerSSNIT = basicSalary * 0.105; // 10.5% net to SSNIT Trust
  return {
    employeeSSNIT: Math.round(employeeSSNIT * 100) / 100,
    employerSSNIT: Math.round(employerSSNIT * 100) / 100,
    nhia:          Math.round(nhia * 100) / 100,
    totalEmployer: Math.round((employerSSNIT + nhia) * 100) / 100,
  };
}

/**
 * Ghana PAYE (Pay As You Earn) — 2024 monthly tax bands.
 * Taxable income = Gross salary − Employee SSNIT contribution.
 *
 * Monthly bands:
 *   ≤ 490        → 0%
 *   next 110     → 5%
 *   next 130     → 10%
 *   next 3 000   → 17.5%
 *   next 16 395  → 25%
 *   remainder    → 35%
 */
const PAYE_BANDS: Array<{ limit: number; rate: number }> = [
  { limit: 490,   rate: 0.00 },
  { limit: 110,   rate: 0.05 },
  { limit: 130,   rate: 0.10 },
  { limit: 3000,  rate: 0.175 },
  { limit: 16395, rate: 0.25 },
  { limit: Infinity, rate: 0.35 },
];

export function calculatePAYE(monthlyTaxableIncome: number): number {
  let remaining = Math.max(0, monthlyTaxableIncome);
  let paye = 0;
  for (const band of PAYE_BANDS) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, band.limit);
    paye      += taxable * band.rate;
    remaining -= taxable;
  }
  return Math.round(paye * 100) / 100;
}

/**
 * Full payroll calculation for one employee.
 */
export interface PayrollResult {
  grossSalary:      number;
  ssnit_employee:   number;
  ssnit_employer:   number;
  nhia:             number;
  taxableIncome:    number;
  paye:             number;
  totalDeductions:  number;
  netPay:           number;
}

export function calculatePayroll(params: {
  basicSalary:        number;
  housingAllowance?:  number;
  transportAllowance?: number;
  otherAllowances?:   number;
  otherDeductions?:   number;
}): PayrollResult {
  const basic     = params.basicSalary;
  const housing   = params.housingAllowance   ?? 0;
  const transport = params.transportAllowance ?? 0;
  const otherAllow = params.otherAllowances   ?? 0;
  const otherDed  = params.otherDeductions    ?? 0;

  const grossSalary    = basic + housing + transport + otherAllow;
  const ssnit          = calculateSSNIT(basic);
  const taxableIncome  = grossSalary - ssnit.employeeSSNIT;
  const paye           = calculatePAYE(taxableIncome);
  const totalDeductions = ssnit.employeeSSNIT + paye + otherDed;

  return {
    grossSalary:    Math.round(grossSalary * 100) / 100,
    ssnit_employee: ssnit.employeeSSNIT,
    ssnit_employer: ssnit.totalEmployer,
    nhia:           ssnit.nhia,
    taxableIncome:  Math.round(taxableIncome * 100) / 100,
    paye,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPay:         Math.round((grossSalary - totalDeductions) * 100) / 100,
  };
}

export function calculateTaxes(subtotal: number, taxes: { vat: boolean; nhil: boolean; getfl: boolean }) {
  const vatAmount = taxes.vat ? subtotal * TAX_RATES.VAT : 0;
  const nhilAmount = taxes.nhil ? subtotal * TAX_RATES.NHIL : 0;
  const getflAmount = taxes.getfl ? subtotal * TAX_RATES.GETFL : 0;
  const totalTax = vatAmount + nhilAmount + getflAmount;
  return { vatAmount, nhilAmount, getflAmount, totalTax, total: subtotal + totalTax };
}
