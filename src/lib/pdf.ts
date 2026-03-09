import jsPDF from 'jspdf';
import { formatGHS } from './ghana';

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

interface ReceiptData {
  receipt_number: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_method: string;
}

export const generateInvoicePDF = (invoice: InvoiceData, business: BusinessData) => {
  const doc = new jsPDF();
  
  // Colors (NexusGH gold theme)
  const primaryGold = [255, 193, 7]; // Gold
  const darkGray = [51, 51, 51];
  const lightGray = [128, 128, 128];
  
  // Header
  doc.setFillColor(255, 193, 7);
  doc.rect(0, 0, 220, 40, 'F');
  
  // Company name
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(business.name || 'NexusGH', 20, 25);
  
  // Invoice title
  doc.setTextColor(51, 51, 51);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 150, 25);
  
  // Invoice details
  let yPos = 60;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice #: ${invoice.invoice_number}`, 20, yPos);
  doc.text(`Date: ${invoice.date}`, 20, yPos + 10);
  doc.text(`Due Date: ${invoice.due_date}`, 20, yPos + 20);
  
  // Business info
  if (business.address) doc.text(`Address: ${business.address}`, 120, yPos);
  if (business.phone) doc.text(`Phone: ${business.phone}`, 120, yPos + 10);
  if (business.email) doc.text(`Email: ${business.email}`, 120, yPos + 20);
  
  // Customer info
  yPos += 40;
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.customer_name, 20, yPos + 10);
  
  // Line
  yPos += 30;
  doc.setLineWidth(0.5);
  doc.setDrawColor(128, 128, 128);
  doc.line(20, yPos, 190, yPos);
  
  // Amounts section
  yPos += 20;
  doc.setFont('helvetica', 'bold');
  doc.text('Amount Summary', 20, yPos);
  
  yPos += 15;
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 120, yPos);
  doc.text(formatGHS(invoice.subtotal), 160, yPos);
  
  // Ghana taxes
  if (invoice.apply_vat && invoice.vat_amount > 0) {
    yPos += 10;
    doc.text('VAT (15%):', 120, yPos);
    doc.text(formatGHS(invoice.vat_amount), 160, yPos);
  }
  
  if (invoice.apply_nhil && invoice.nhil_amount > 0) {
    yPos += 10;
    doc.text('NHIL (2.5%):', 120, yPos);
    doc.text(formatGHS(invoice.nhil_amount), 160, yPos);
  }
  
  if (invoice.apply_getfl && invoice.getfl_amount > 0) {
    yPos += 10;
    doc.text('GETFL (1%):', 120, yPos);
    doc.text(formatGHS(invoice.getfl_amount), 160, yPos);
  }
  
  // Total line
  yPos += 15;
  doc.setLineWidth(1);
  doc.line(120, yPos, 190, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TOTAL:', 120, yPos);
  doc.text(formatGHS(invoice.total), 160, yPos);
  
  // Notes
  if (invoice.notes) {
    yPos += 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Notes:', 20, yPos);
    
    yPos += 10;
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(invoice.notes, 170);
    doc.text(splitNotes, 20, yPos);
  }
  
  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text('Powered by NexusGH Business Management System', 20, pageHeight - 20);
  
  // Save the PDF
  doc.save(`Invoice-${invoice.invoice_number}.pdf`);
};

export const generateReceiptPDF = (receipt: ReceiptData, business: BusinessData) => {
  const doc = new jsPDF();
  
  // Colors
  const primaryGold = [255, 193, 7];
  const darkGray = [51, 51, 51];
  const lightGray = [128, 128, 128];
  
  // Header
  doc.setFillColor(255, 193, 7);
  doc.rect(0, 0, 220, 35, 'F');
  
  // Company name
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(business.name || 'NexusGH', 20, 22);
  
  // Receipt title
  doc.setTextColor(51, 51, 51);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIPT', 150, 22);
  
  // Receipt details
  let yPos = 55;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt #: ${receipt.receipt_number}`, 20, yPos);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, yPos + 10);
  doc.text(`Payment: ${receipt.payment_method.toUpperCase()}`, 120, yPos + 10);
  
  // Items header
  yPos += 30;
  doc.setFont('helvetica', 'bold');
  doc.text('Item', 20, yPos);
  doc.text('Qty', 80, yPos);
  doc.text('Price', 110, yPos);
  doc.text('Total', 150, yPos);
  
  // Line under header
  doc.setLineWidth(0.5);
  doc.setDrawColor(128, 128, 128);
  doc.line(20, yPos + 5, 190, yPos + 5);
  
  // Items
  yPos += 15;
  doc.setFont('helvetica', 'normal');
  receipt.items.forEach((item) => {
    const itemTotal = item.qty * item.price;
    doc.text(item.name, 20, yPos);
    doc.text(item.qty.toString(), 80, yPos);
    doc.text(formatGHS(item.price), 110, yPos);
    doc.text(formatGHS(itemTotal), 150, yPos);
    yPos += 10;
  });
  
  // Summary section
  yPos += 10;
  doc.line(120, yPos, 190, yPos);
  
  yPos += 10;
  doc.text('Subtotal:', 120, yPos);
  doc.text(formatGHS(receipt.subtotal), 160, yPos);
  
  if (receipt.discount_amount > 0) {
    yPos += 10;
    doc.text('Discount:', 120, yPos);
    doc.text(`-${formatGHS(receipt.discount_amount)}`, 160, yPos);
  }
  
  // Total
  yPos += 15;
  doc.setLineWidth(1);
  doc.line(120, yPos, 190, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TOTAL:', 120, yPos);
  doc.text(formatGHS(receipt.total), 160, yPos);
  
  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text('Thank you for your business!', 20, pageHeight - 30);
  doc.text('Powered by NexusGH Business Management System', 20, pageHeight - 20);
  
  // Save the PDF
  doc.save(`Receipt-${receipt.receipt_number}.pdf`);
};