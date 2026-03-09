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

export function exportCustomersCsv(customers: any[]) {
  const headers = ["Name", "Phone", "Email", "Region", "Loyalty Points", "Notes"];
  const rows = customers.map(c => [
    c.name, c.phone || "", c.email || "", c.region || "",
    String(c.loyalty_points || 0), c.notes || "",
  ]);
  downloadCsv(`customers_export_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

export function exportSuppliersCsv(suppliers: any[]) {
  const headers = ["Name", "Contact Person", "Phone", "Email", "Region", "Notes"];
  const rows = suppliers.map(s => [
    s.name, s.contact_person || "", s.phone || "", s.email || "",
    s.region || "", s.notes || "",
  ]);
  downloadCsv(`suppliers_export_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

export function exportInvoicesCsv(invoices: any[]) {
  const headers = ["Invoice #", "Customer", "Date", "Due Date", "Subtotal", "VAT", "Total", "Status"];
  const rows = invoices.map(i => [
    i.invoice_number, i.customer_name,
    new Date(i.date).toLocaleDateString(), new Date(i.due_date).toLocaleDateString(),
    Number(i.subtotal).toFixed(2), Number(i.vat_amount).toFixed(2),
    Number(i.total).toFixed(2), i.status,
  ]);
  const totalAmount = invoices.reduce((s, i) => s + Number(i.total), 0);
  rows.push(["", "", "", "TOTAL", "", "", totalAmount.toFixed(2), ""]);
  downloadCsv(`invoices_export_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

export function exportProfitLossCsv(data: { month: string; revenue: number; expenses: number; profit: number }[]) {
  const headers = ["Month", "Revenue (GHS)", "Expenses (GHS)", "Net Profit (GHS)"];
  const rows = data.map(d => [d.month, d.revenue.toFixed(2), d.expenses.toFixed(2), d.profit.toFixed(2)]);
  const totals = data.reduce((acc, d) => ({ revenue: acc.revenue + d.revenue, expenses: acc.expenses + d.expenses, profit: acc.profit + d.profit }), { revenue: 0, expenses: 0, profit: 0 });
  rows.push(["TOTAL", totals.revenue.toFixed(2), totals.expenses.toFixed(2), totals.profit.toFixed(2)]);
  downloadCsv(`profit_loss_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
}

// CSV parsing utility for imports
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = "";
      } else { current += ch; }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow).filter(r => r.some(c => c));
  return { headers, rows };
}

export function generateCsvTemplate(type: "products" | "customers"): string {
  if (type === "products") {
    return "Name,SKU,Cost Price,Selling Price,Quantity,Reorder Level\nExample Product,SKU-001,5.00,10.00,100,10";
  }
  return "Name,Phone,Email,Region,Notes\nKwame Asante,0241234567,kwame@example.com,Greater Accra,VIP customer";
}