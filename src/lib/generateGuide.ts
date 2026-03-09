import jsPDF from "jspdf";

export function downloadUserGuide() {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const addText = (text: string, size: number, style: "normal" | "bold" = "normal", color: [number, number, number] = [30, 30, 30]) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);
    if (y + lines.length * size * 0.5 > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin, y);
    y += lines.length * size * 0.45 + 4;
  };

  const addGap = (gap = 6) => { y += gap; };

  // Title
  doc.setFillColor(180, 140, 20);
  doc.rect(0, 0, pageWidth, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("Nexus-GH", margin, 22);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text("User Guide & Documentation", margin, 32);
  doc.setFontSize(10);
  doc.text("Version 1.0 — 2026", margin, 40);
  y = 60;

  // About
  addText("1. About Nexus-GH", 18, "bold", [40, 40, 40]);
  addText(
    "Nexus-GH is an all-in-one business management platform built specifically for Ghanaian entrepreneurs and SMEs. It combines Point of Sale (POS), inventory management, invoicing, customer relationship management, expense tracking, staff management, supplier management, and business analytics into one seamless application.",
    11
  );
  addGap();
  addText(
    "Nexus-GH supports Ghana-specific features including Mobile Money (MoMo) payments for MTN, Telecel, and AirtelTigo, automatic Ghana tax calculations (VAT 15%, NHIL 2.5%, GETFL 1%), and region-based customer management covering all 16 regions of Ghana.",
    11
  );
  addGap(10);

  // Features
  addText("2. Key Features", 18, "bold", [40, 40, 40]);
  const features = [
    ["Point of Sale (POS)", "Fast, touch-friendly sales terminal with barcode scanning, MoMo QR payments, discount management, receipt printing, and customer loyalty tracking."],
    ["Inventory Management", "Real-time stock tracking with categories, SKU codes, cost/selling prices, low-stock alerts, reorder levels, and automatic stock deduction on sales."],
    ["Smart Invoicing", "Create professional invoices with automatic numbering, Ghana tax computation (VAT, NHIL, GETFL), PDF export, and status tracking (draft, sent, paid, overdue)."],
    ["Customer Management", "Full CRM with customer profiles, contact details, regional info, loyalty points, purchase history, and notes."],
    ["Expense Tracking", "Record and categorize business expenses with date tracking, receipt uploads, and spending analysis."],
    ["Staff Management", "Add staff members with roles (Owner, Manager, Cashier, Stock Keeper), PIN-based access, and status management."],
    ["Supplier Management", "Maintain supplier records with contact persons, phone numbers, locations, and products supplied."],
    ["Reports & Analytics", "Visual dashboards with sales trends, revenue analysis, top products, payment method breakdowns, and business performance metrics."],
    ["Business Settings", "Customize your business profile, receipt headers/footers, logo, tax preferences, and MoMo merchant IDs."],
  ];
  features.forEach(([title, desc]) => {
    addText(`• ${title}`, 12, "bold");
    addText(`  ${desc}`, 10);
    addGap(2);
  });
  addGap(10);

  // How to use
  addText("3. Getting Started", 18, "bold", [40, 40, 40]);
  const steps = [
    ["Step 1: Create an Account", "Visit the Nexus-GH website and click 'Get Started'. Fill in your full name, email address, and create a password. Verify your email to activate your account."],
    ["Step 2: Set Up Your Business", "After logging in, you'll be guided through onboarding. Enter your business name, select your region in Ghana, and provide your business phone number and address."],
    ["Step 3: Add Your Products", "Navigate to Inventory and add your products with names, prices, quantities, SKU codes, and categories. You can also upload product images."],
    ["Step 4: Add Customers", "Go to Customers to add your regular customers with their contact information and region for better relationship management."],
    ["Step 5: Start Selling", "Use the POS module to make sales. Search or scan products, add them to cart, apply discounts if needed, select payment method (Cash or MoMo), and complete the sale."],
    ["Step 6: Create Invoices", "For credit sales or formal billing, use the Invoicing module. Ghana taxes are calculated automatically based on your business settings."],
    ["Step 7: Track Expenses", "Record all business expenses in the Expenses module to maintain accurate financial records."],
    ["Step 8: View Reports", "Check the Dashboard and Reports section for real-time business insights, sales trends, and performance analytics."],
  ];
  steps.forEach(([title, desc]) => {
    addText(title, 12, "bold");
    addText(desc, 10);
    addGap(3);
  });
  addGap(10);

  // Navigation
  addText("4. Navigating the App", 18, "bold", [40, 40, 40]);
  addText(
    "The application features a sidebar navigation on desktop and a bottom navigation bar on mobile devices. The main modules accessible from the sidebar are: Dashboard, POS, Inventory, Invoices, Customers, Expenses, Suppliers, Staff, Reports, and Settings. Each module is designed to be intuitive with search, filter, and pagination capabilities.",
    11
  );
  addGap(10);

  // Pricing
  addText("5. Pricing Plans", 18, "bold", [40, 40, 40]);
  addText("• Starter (Free) — 1 user, 50 products, POS & sales, basic reports, email support.", 10);
  addText("• Business (GH₵ 99/month) — 5 staff, unlimited products, invoicing + tax, full reports, MoMo integration, priority support.", 10);
  addText("• Enterprise (GH₵ 249/month) — Unlimited staff, multi-branch, API access, custom branding, dedicated account manager, SLA guarantee.", 10);
  addGap(10);

  // Developer
  addText("6. Developed By", 18, "bold", [40, 40, 40]);
  addText("Nexus-GH is developed by GENESIS, a technology company focused on building digital solutions for African businesses.", 11);
  addGap(4);
  addText("Contact Information:", 12, "bold");
  addText("Phone: +233 544 788 852", 10);
  addText("Email: gengenesix@gmail.com", 10);
  addGap(4);
  addText("© 2026 Nexus-GH. All rights reserved. By GENESIS.", 10, "normal", [120, 120, 120]);

  doc.save("Nexus-GH_User_Guide.pdf");
}
