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

export function calculateTaxes(subtotal: number, taxes: { vat: boolean; nhil: boolean; getfl: boolean }) {
  const vatAmount = taxes.vat ? subtotal * TAX_RATES.VAT : 0;
  const nhilAmount = taxes.nhil ? subtotal * TAX_RATES.NHIL : 0;
  const getflAmount = taxes.getfl ? subtotal * TAX_RATES.GETFL : 0;
  const totalTax = vatAmount + nhilAmount + getflAmount;
  return { vatAmount, nhilAmount, getflAmount, totalTax, total: subtotal + totalTax };
}
