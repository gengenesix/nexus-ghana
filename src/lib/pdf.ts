import jsPDF from "jspdf";
import { formatGHS } from "./ghana";
import { NEXIS_ICON_B64 } from "./nexisLogoBase64";

/* ─── Brand palette (RGB) ──────────────────────────────────────────────── */
const FOREST      = [26,  58,  34]  as [number,number,number];
const FOREST_DARK = [15,  35,  20]  as [number,number,number];
const LIME        = [163, 230, 53]  as [number,number,number];
const CREAM       = [250, 246, 237] as [number,number,number];
const CREAM_DARK  = [220, 212, 195] as [number,number,number];
const WHITE       = [255, 255, 255] as [number,number,number];
const MUTED       = [120, 140, 125] as [number,number,number];
const RED         = [200,  48,  44] as [number,number,number];
const GREEN_OK    = [ 34, 120,  60] as [number,number,number];

/* ─── Shared helpers ────────────────────────────────────────────────────── */

function drawHeader(doc: jsPDF, rightLabel: string, rightSub?: string) {
  const W = doc.internal.pageSize.width;

  // Forest header band
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, W, 44, "F");

  // Nexis icon
  try {
    doc.addImage(NEXIS_ICON_B64, "PNG", 10, 4, 36, 36);
  } catch {
    // fallback wordmark letter
    doc.setTextColor(...LIME);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("N", 16, 30);
  }

  // "NEXIS" wordmark
  doc.setTextColor(...LIME);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("NEXIS", 52, 20);

  // Sub tagline
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Business Management · Ghana", 52, 29);

  // Right label (INVOICE / RECEIPT / STATEMENT)
  doc.setTextColor(...LIME);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(rightLabel, W - 14, 22, { align: "right" });

  if (rightSub) {
    doc.setTextColor(220, 240, 220);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(rightSub, W - 14, 32, { align: "right" });
  }
}

function drawRule(doc: jsPDF, y: number, color: [number,number,number] = CREAM_DARK) {
  const W = doc.internal.pageSize.width;
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(14, y, W - 14, y);
}

function drawFooter(doc: jsPDF) {
  const W  = doc.internal.pageSize.width;
  const pH = doc.internal.pageSize.height;

  doc.setFillColor(...FOREST);
  doc.rect(0, pH - 14, W, 14, "F");

  doc.setTextColor(...LIME);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("NEXIS", 14, pH - 5);

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Powered by Nexis Business Management · nexisgh.com", W / 2, pH - 5, { align: "center" });

  const pageNum = `Page ${(doc as any).internal.getCurrentPageInfo().pageNumber}`;
  doc.setTextColor(...LIME);
  doc.text(pageNum, W - 14, pH - 5, { align: "right" });
}

function sectionLabel(doc: jsPDF, label: string, y: number) {
  const W = doc.internal.pageSize.width;
  doc.setFillColor(...CREAM);
  doc.roundedRect(14, y - 5, W - 28, 9, 2, 2, "F");
  doc.setTextColor(...FOREST);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text(label.toUpperCase(), 18, y + 0.5);
  return y + 8;
}

function tableHeader(doc: jsPDF, cols: Array<{label:string; x:number; align?:"left"|"right"}>, y: number) {
  const W = doc.internal.pageSize.width;
  doc.setFillColor(...FOREST);
  doc.rect(14, y - 5, W - 28, 10, "F");
  doc.setTextColor(...LIME);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  cols.forEach(c => doc.text(c.label, c.x, y + 1, { align: c.align ?? "left" }));
  return y + 12;
}

function kvRow(doc: jsPDF, label: string, value: string, y: number, bold = false, valueColor: [number,number,number] = FOREST) {
  const W = doc.internal.pageSize.width;
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(label, 110, y);
  doc.setTextColor(...valueColor);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.text(value, W - 14, y, { align: "right" });
  return y + 8;
}

/* ─── Invoice ───────────────────────────────────────────────────────────── */

interface BusinessData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  customer_name: string;
  date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  nhil_amount: number;
  getfl_amount: number;
  total: number;
  notes?: string;
  apply_vat: boolean;
  apply_nhil: boolean;
  apply_getfl: boolean;
}

export const generateInvoicePDF = (invoice: InvoiceData, business: BusinessData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.width;

  drawHeader(doc, "INVOICE", invoice.invoice_number);

  /* ── Business + Invoice meta ── */
  let y = 54;

  // Left: business
  doc.setTextColor(...FOREST);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(business.name || "Nexis Business", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  if (business.address) doc.text(business.address, 14, y + 7);
  if (business.phone)   doc.text(business.phone,   14, y + 13);
  if (business.email)   doc.text(business.email,   14, y + 19);

  // Right: invoice meta
  const mx = W - 14;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Invoice No:", mx - 36, y);
  doc.text("Issue Date:", mx - 36, y + 7);
  doc.text("Due Date:",   mx - 36, y + 14);

  doc.setTextColor(...FOREST);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.invoice_number, mx, y,      { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(invoice.date,           mx, y + 7,  { align: "right" });
  const overdue = new Date(invoice.due_date) < new Date();
  doc.setTextColor(...(overdue ? RED : FOREST));
  doc.text(invoice.due_date,       mx, y + 14, { align: "right" });

  /* ── Bill To ── */
  y += 30;
  drawRule(doc, y);
  y += 8;
  doc.setFillColor(...CREAM);
  doc.roundedRect(14, y - 1, W - 28, 20, 2, 2, "F");
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", 20, y + 5);
  doc.setTextColor(...FOREST);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.customer_name, 20, y + 13);

  /* ── Items table ── */
  y += 28;
  drawRule(doc, y);
  y += 8;

  y = tableHeader(doc, [
    { label: "DESCRIPTION", x: 20 },
    { label: "AMOUNT",      x: W - 20, align: "right" },
  ], y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...FOREST);
  doc.text("Goods / Services", 20, y);
  doc.text(formatGHS(invoice.subtotal), W - 14, y, { align: "right" });
  y += 14;

  drawRule(doc, y);
  y += 10;

  // Tax rows
  if (invoice.apply_vat && invoice.vat_amount > 0) {
    y = kvRow(doc, "VAT (15%)",   formatGHS(invoice.vat_amount),   y);
  }
  if (invoice.apply_nhil && invoice.nhil_amount > 0) {
    y = kvRow(doc, "NHIL (2.5%)", formatGHS(invoice.nhil_amount),  y);
  }
  if (invoice.apply_getfl && invoice.getfl_amount > 0) {
    y = kvRow(doc, "GETFL (1%)",  formatGHS(invoice.getfl_amount), y);
  }

  /* ── Total highlight ── */
  y += 6;
  doc.setFillColor(...FOREST);
  doc.roundedRect(14, y - 2, W - 28, 16, 3, 3, "F");
  doc.setTextColor(...LIME);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL DUE", 20, y + 9);
  doc.setFontSize(13);
  doc.text(formatGHS(invoice.total), W - 20, y + 9, { align: "right" });

  /* ── Notes ── */
  if (invoice.notes) {
    y += 26;
    drawRule(doc, y);
    y += 8;
    y = sectionLabel(doc, "Notes", y) + 6;
    doc.setTextColor(...MUTED);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(invoice.notes, W - 28);
    doc.text(lines, 14, y);
  }

  /* ── Ghana tax badge ── */
  const ph = doc.internal.pageSize.height;
  doc.setFillColor(...CREAM);
  doc.roundedRect(14, ph - 30, 100, 12, 2, 2, "F");
  doc.setTextColor(...FOREST);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Ghana Tax Compliant  ·  VAT + NHIL + GETFL", 20, ph - 22);

  drawFooter(doc);
  doc.save(`Invoice-${invoice.invoice_number}.pdf`);
};

/* ─── Receipt ───────────────────────────────────────────────────────────── */

interface ReceiptData {
  receipt_number: string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_method: string;
}

export const generateReceiptPDF = (receipt: ReceiptData, business: BusinessData) => {
  const doc = new jsPDF({ unit: "mm", format: [80, 220] });
  const W   = doc.internal.pageSize.width;

  /* ── Header ── */
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, W, 38, "F");

  try {
    doc.addImage(NEXIS_ICON_B64, "PNG", (W - 22) / 2, 3, 22, 22);
  } catch { /* skip */ }

  doc.setTextColor(...LIME);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(business.name || "Nexis", W / 2, 32, { align: "center" });

  /* ── Meta ── */
  let y = 44;
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Receipt #${receipt.receipt_number}`, W / 2, y, { align: "center" }); y += 5;
  doc.text(new Date().toLocaleString("en-GH"),  W / 2, y, { align: "center" }); y += 5;
  doc.text(`Payment: ${receipt.payment_method.toUpperCase()}`, W / 2, y, { align: "center" }); y += 6;

  drawRule(doc, y, CREAM_DARK); y += 5;

  /* ── Items header ── */
  doc.setFillColor(...FOREST);
  doc.rect(4, y - 4, W - 8, 8, "F");
  doc.setTextColor(...LIME);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("ITEM",  6,       y + 1);
  doc.text("QTY",   W - 22,  y + 1, { align: "right" });
  doc.text("TOTAL", W - 6,   y + 1, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...FOREST);
  receipt.items.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...CREAM);
      doc.rect(4, y - 4, W - 8, 7, "F");
    }
    const name = item.name.length > 20 ? item.name.slice(0, 18) + "…" : item.name;
    doc.setTextColor(...MUTED);
    doc.text(name,                       6,       y);
    doc.text(String(item.qty),          W - 22,  y, { align: "right" });
    doc.setTextColor(...FOREST);
    doc.text(formatGHS(item.qty * item.price), W - 6, y, { align: "right" });
    y += 7;
  });

  /* ── Summary ── */
  y += 2;
  drawRule(doc, y, CREAM_DARK); y += 6;
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Subtotal", 6, y);
  doc.setTextColor(...FOREST);
  doc.text(formatGHS(receipt.subtotal), W - 6, y, { align: "right" }); y += 7;

  if (receipt.discount_amount > 0) {
    doc.setTextColor(...MUTED);
    doc.text("Discount", 6, y);
    doc.setTextColor(...RED);
    doc.text(`-${formatGHS(receipt.discount_amount)}`, W - 6, y, { align: "right" }); y += 7;
  }

  /* ── Total pill ── */
  y += 2;
  doc.setFillColor(...FOREST);
  doc.roundedRect(4, y - 2, W - 8, 12, 2, 2, "F");
  doc.setTextColor(...LIME);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", 8, y + 7);
  doc.text(formatGHS(receipt.total), W - 8, y + 7, { align: "right" });
  y += 18;

  /* ── Thanks ── */
  doc.setTextColor(...FOREST);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for your business!", W / 2, y, { align: "center" }); y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text("Powered by Nexis · nexisgh.com", W / 2, y, { align: "center" });

  doc.save(`Receipt-${receipt.receipt_number}.pdf`);
};

/* ─── Customer Statement ────────────────────────────────────────────────── */

export const generateCustomerStatement = (
  customer: { name: string; phone?: string; email?: string },
  sales:    Array<{ receipt_number?: string; total: number; payment_method: string; created_at: string }>,
  invoices: Array<{ invoice_number: string; total: number; status: string; date: string }>,
  business: BusinessData
) => {
  const doc   = new jsPDF({ unit: "mm", format: "a4" });
  const W     = doc.internal.pageSize.width;
  const today = new Date().toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" });

  drawHeader(doc, "STATEMENT", today);

  /* ── Business + Customer ── */
  let y = 54;

  doc.setTextColor(...FOREST);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(business.name || "Nexis Business", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  if (business.address) doc.text(business.address, 14, y + 7);
  if (business.phone)   doc.text(business.phone,   14, y + 13);

  // Customer card
  const cpx = W / 2 + 4;
  doc.setFillColor(...CREAM);
  doc.roundedRect(cpx, y - 2, W - cpx - 14, 26, 2, 2, "F");
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("PREPARED FOR", cpx + 6, y + 5);
  doc.setTextColor(...FOREST);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(customer.name, cpx + 6, y + 13);
  if (customer.phone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(customer.phone, cpx + 6, y + 20);
  }

  /* ── POS Sales ── */
  y += 36;
  drawRule(doc, y); y += 8;

  if (sales.length > 0) {
    y = sectionLabel(doc, "POS Transactions", y) + 4;
    y = tableHeader(doc, [
      { label: "DATE",    x: 20 },
      { label: "REF",     x: 68 },
      { label: "METHOD",  x: 115 },
      { label: "AMOUNT",  x: W - 20, align: "right" },
    ], y);

    let totalSales = 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    sales.forEach((s, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(...CREAM);
        doc.rect(14, y - 4, W - 28, 7, "F");
      }
      const dateStr = new Date(s.created_at).toLocaleDateString("en-GH");
      doc.setTextColor(...MUTED);
      doc.text(dateStr, 20, y);
      doc.text(s.receipt_number ? `#${s.receipt_number}` : "—", 68, y);
      doc.text(s.payment_method, 115, y);
      doc.setTextColor(...FOREST);
      doc.text(formatGHS(Number(s.total)), W - 20, y, { align: "right" });
      totalSales += Number(s.total);
      y += 7;
      if (y > 265) { doc.addPage(); drawHeader(doc, "STATEMENT", today); drawFooter(doc); y = 54; }
    });

    doc.setFillColor(...FOREST);
    doc.rect(14, y, W - 28, 8, "F");
    doc.setTextColor(...LIME);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Total POS Sales", 20, y + 5.5);
    doc.text(formatGHS(totalSales), W - 20, y + 5.5, { align: "right" });
    y += 16;
  }

  /* ── Invoices ── */
  if (invoices.length > 0) {
    drawRule(doc, y); y += 8;
    y = sectionLabel(doc, "Invoices", y) + 4;
    y = tableHeader(doc, [
      { label: "DATE",       x: 20 },
      { label: "INVOICE #",  x: 68 },
      { label: "STATUS",     x: 120 },
      { label: "AMOUNT",     x: W - 20, align: "right" },
    ], y);

    let totalInvoiced = 0, totalPaid = 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    invoices.forEach((inv, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(...CREAM);
        doc.rect(14, y - 4, W - 28, 7, "F");
      }
      doc.setTextColor(...MUTED);
      doc.text(inv.date,           20,  y);
      doc.text(inv.invoice_number, 68,  y);
      const sc = inv.status === "paid" ? GREEN_OK : inv.status === "overdue" ? RED : MUTED;
      doc.setTextColor(...sc);
      doc.text(inv.status.toUpperCase(), 120, y);
      doc.setTextColor(...FOREST);
      doc.text(formatGHS(Number(inv.total)), W - 20, y, { align: "right" });
      totalInvoiced += Number(inv.total);
      if (inv.status === "paid") totalPaid += Number(inv.total);
      y += 7;
      if (y > 265) { doc.addPage(); drawHeader(doc, "STATEMENT", today); drawFooter(doc); y = 54; }
    });

    // Summary card
    y += 6;
    doc.setFillColor(...CREAM);
    doc.roundedRect(14, y, W - 28, 30, 3, 3, "F");
    doc.setFontSize(8.5);

    const rows: Array<[string, string, [number,number,number]]> = [
      ["Total Invoiced:",      formatGHS(totalInvoiced),                FOREST],
      ["Amount Paid:",         formatGHS(totalPaid),                    GREEN_OK],
      ["Balance Outstanding:", formatGHS(totalInvoiced - totalPaid),    RED],
    ];
    rows.forEach(([label, value, color], idx) => {
      const ry = y + 9 + idx * 8;
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.text(label, 20, ry);
      doc.setTextColor(...color);
      doc.setFont("helvetica", "bold");
      doc.text(value, W - 20, ry, { align: "right" });
    });
  }

  drawFooter(doc);
  doc.save(`Statement-${customer.name.replace(/\s+/g, "_")}.pdf`);
};
