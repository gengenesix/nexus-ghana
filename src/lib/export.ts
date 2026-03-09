import { formatGHS } from "./ghana";

function escapeCsv(value: any): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(escapeCsv).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSalesCsv(sales: any[]) {
  const headers = ["Date", "Receipt #", "Payment Method", "Subtotal", "Discount", "Total"];
  const rows = sales.map(s => [
    new Date(s.created_at).toLocaleDateString(),
    s.receipt_number || "",
    s.payment_method,
    Number(s.subtotal).toFixed(2),
    Number(s.discount_amount).toFixed(2),
    Number(s.total).toFixed(2),
  ]);
  // Add totals row
  const totalAmount = sales.reduce((sum, s) => sum + Number(s.total), 0);
  rows.push(["", "", "TOTAL", "", "", totalAmount.toFixed(2)]);
  downloadCsv(`sales_export_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

export function exportInventoryCsv(products: any[]) {
  const headers = ["Name", "SKU", "Cost Price", "Selling Price", "Quantity", "Reorder Level", "Stock Value"];
  const rows = products.map(p => [
    p.name,
    p.sku || "",
    Number(p.cost_price).toFixed(2),
    Number(p.selling_price).toFixed(2),
    String(p.qty),
    String(p.reorder_level),
    (Number(p.selling_price) * p.qty).toFixed(2),
  ]);
  const totalValue = products.reduce((s, p) => s + Number(p.selling_price) * p.qty, 0);
  rows.push(["", "", "", "", "", "TOTAL", totalValue.toFixed(2)]);
  downloadCsv(`inventory_export_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

export function exportExpensesCsv(expenses: any[]) {
  const headers = ["Date", "Category", "Description", "Amount", "Paid By"];
  const rows = expenses.map(e => [
    new Date(e.date).toLocaleDateString(),
    e.category,
    e.description || "",
    Number(e.amount).toFixed(2),
    e.paid_by || "",
  ]);
  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);
  rows.push(["", "", "TOTAL", totalAmount.toFixed(2), ""]);
  downloadCsv(`expenses_export_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

export function exportProfitLossCsv(data: { month: string; revenue: number; expenses: number; profit: number }[]) {
  const headers = ["Month", "Revenue (GHS)", "Expenses (GHS)", "Net Profit (GHS)"];
  const rows = data.map(d => [d.month, d.revenue.toFixed(2), d.expenses.toFixed(2), d.profit.toFixed(2)]);
  const totals = data.reduce((acc, d) => ({ revenue: acc.revenue + d.revenue, expenses: acc.expenses + d.expenses, profit: acc.profit + d.profit }), { revenue: 0, expenses: 0, profit: 0 });
  rows.push(["TOTAL", totals.revenue.toFixed(2), totals.expenses.toFixed(2), totals.profit.toFixed(2)]);
  downloadCsv(`profit_loss_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}
