
# NexusGH — Ghana SME Business Management Platform

## Overview
A premium SaaS web app for Ghanaian small businesses with dark navy (#0A1628) + gold (#F5A623) design, Supabase backend via Lovable Cloud, and Ghana-specific features (MoMo, GHS, VAT/NHIL/GETFL taxes).

---

## Phase 1: Foundation & Auth

### Design System
- Dark navy background (#0A1628), gold accents (#F5A623), white text
- Custom Tailwind theme with these colors throughout
- Mobile-first responsive layout

### Authentication
- Login & Register pages (email/password via Supabase Auth)
- Business profile setup on first login: business name, logo upload, address, phone, Ghana region dropdown
- Role-based access: Owner, Manager, Cashier, Staff (roles stored in a separate `user_roles` table with RLS)
- Protected routes requiring auth

### App Layout
- Dark sidebar with gold accents, collapsible to bottom nav on mobile
- 10 navigation items: Dashboard, POS, Inventory, Invoices, Customers, Suppliers, Expenses, Reports, Staff, Settings
- Toast notifications (sonner) for all actions
- Loading skeletons on data-fetching pages

---

## Phase 2: Database Schema (Lovable Cloud / Supabase)

### Core Tables
- `businesses` — business profile, logo, address, region, MoMo merchant number, tax settings
- `user_roles` — role enum (owner/manager/cashier/staff) linked to auth.users
- `products` — name, SKU, category, image, cost_price, selling_price, qty, reorder_level, supplier_id
- `categories` — product categories
- `customers` — name, phone, email, region, loyalty_points, notes
- `suppliers` — name, contact, location, products supplied
- `sales` — date, total, discount, payment_method, staff_id, customer_id
- `sale_items` — sale_id, product_id, qty, unit_price
- `invoices` — invoice_number (NXG-YYYY-XXX), customer_id, status, due_date, tax toggles, notes
- `invoice_items` — invoice_id, product_id, qty, unit_price
- `invoice_payments` — partial payment records
- `expenses` — date, category, amount, description, paid_by, receipt_url
- `stock_adjustments` — product_id, qty_change, reason, date
- `staff_attendance` — staff_id, clock_in, clock_out
- `salary_records` — staff_id, amount, period
- `purchase_orders` — supplier_id, status (ordered/shipped/received), items

All tables with RLS policies scoped to the user's business.

---

## Phase 3: Core Pages (all 10)

### 1. Dashboard
- Summary cards: today's sales (GHS), unpaid invoices, low stock alerts, total customers
- Weekly sales bar chart (recharts)
- Top 5 selling products, recent 10 transactions
- Quick action buttons: + New Sale, + New Invoice, + Add Product, + Add Customer

### 2. Point of Sale (POS)
- Product search bar + product grid with images/prices
- Cart panel on the right: add/remove items, adjust qty, apply discount (% or fixed GHS)
- Payment method selector: Cash, MTN MoMo, Telecel Cash, AirtelTigo, Bank Transfer, Card
- MoMo QR code generation (qrcode.react) with merchant number + amount
- Complete Sale → receipt modal with Print PDF (jspdf), WhatsApp share (wa.me link), Download PDF
- Offline mode banner

### 3. Inventory Management
- Product table: image, name, category, SKU, qty, reorder level, cost/selling price, profit margin %
- Add/Edit/Delete product modals
- QR code per product (qrcode.react), printable as PDF label
- Low stock badges (red), category filters, search
- Stock adjustment log
- CSV bulk import

### 4. Invoices & Receipts
- Create invoice: select customer, add line items, due date, notes
- Statuses: Draft / Sent / Paid / Overdue / Partially Paid
- Auto-generated invoice number (NXG-2025-001)
- QR code on each invoice
- Ghana taxes: VAT 15%, NHIL 2.5%, GETFL 1% (toggleable)
- PDF export (jspdf + html2canvas), WhatsApp share, email button
- Partial payment recording
- Filterable invoice list

### 5. Customers (CRM)
- Customer list with name, phone, email, region, total purchases, outstanding balance
- Customer profile: purchase history, outstanding invoices, lifetime spend, notes, loyalty points
- Customer QR code for quick POS lookup
- CSV export

### 6. Suppliers
- Supplier list with CRUD
- Purchase orders: create PO, track status (Ordered/Shipped/Received)
- PO PDF export

### 7. Expenses
- Log expenses: date, category, amount (GHS), description, paid by, receipt photo upload
- Preset categories: Rent, Utilities, Salaries, Stock Purchase, Transport, Marketing, Misc
- Monthly expense summary chart
- PDF export

### 8. Reports & Analytics
- Tabs: Sales, Inventory, Customer, Expense, Staff reports
- Charts and data tables per report type
- Date range filters (daily/weekly/monthly/custom)
- Export to PDF and CSV

### 9. Staff Management
- Add staff: name, role, phone, email, PIN for POS
- Sales/activity per staff member
- Attendance log (clock in/out)
- Salary records

### 10. Settings
- Business profile editing (name, logo, address, region, phone, email)
- Tax settings (VAT/NHIL/GETFL toggles)
- Receipt customization (header/footer messages, logo toggle)
- MoMo merchant number setup
- Subscription plan display
- Data backup & export (JSON)

---

## Ghana-Specific Features (built into relevant pages)
- GHS currency throughout
- 16 Ghana regions in all address dropdowns
- MoMo QR payment codes on POS
- Ghana tax calculation on invoices
- WhatsApp sharing on all receipts/invoices
- Offline mode detection banner

---

## Quality & UX
- Premium dark UI at Stripe/Linear quality level
- Empty states with helpful illustrations and "Get Started" prompts
- Pagination on all tables
- Loading skeletons
- Mobile-first: sidebar → bottom nav on mobile
- Toast notifications for all actions
