# Nexus-GH

**Multi-tenant ERP and business management platform for Ghanaian SMBs.**

Built for real-world Ghana commerce: GHS currency, MoMo payments, regional tax, multi-warehouse inventory, and offline-first POS — all in a single deployable SaaS.

---

## Overview

Nexus-GH is a full-featured business management system targeting small and medium enterprises in Ghana. It covers the complete operational stack — from point-of-sale to general ledger — with Ghana-specific payment rails (Hubtel MoMo), localised tax handling, and multi-tenant data isolation via Supabase RLS.

### Feature modules

| Domain | Capabilities |
|---|---|
| **POS** | Offline queue, split payments, loyalty points, MoMo via Hubtel API |
| **Inventory** | Products, variants, barcode, reorder alerts, multi-warehouse transfers |
| **Invoicing** | Auto-numbered (NXG-YYYY-NNN), PDF export, overdue automation via pg_cron |
| **Purchasing** | Purchase orders, supplier management, goods receipt |
| **Sales** | Sales orders, CRM pipeline (leads → opportunities → activities) |
| **Production** | BOM, production orders, scheduling calendar, MRP |
| **Warehouse** | Multi-location stock control, transfer records |
| **Finance** | General ledger, chart of accounts, banking & reconciliation |
| **HR** | Employees, leave management, org chart |
| **Projects** | Task boards, Gantt chart |
| **Service** | Service contracts, customer equipment, service calls |
| **Staff** | PIN-based sessions, RBAC, bcrypt-hashed PINs, rate-limiting |
| **Reporting** | Revenue, expenses, profit, top-sellers, customer analytics |

---

## Tech stack

```
Frontend      React 18 · TypeScript · Vite · TanStack Query v5 · React Router v6
UI            Tailwind CSS · shadcn/ui (Radix) · Framer Motion · Recharts
Backend       Supabase — PostgreSQL 15 · Auth · RLS · Realtime · Edge Functions
Payments      Hubtel Receive Money API (MTN, Vodafone, AirtelTigo MoMo)
Email         Resend via Supabase Edge Function (daily digest, notifications)
PWA           vite-plugin-pwa · Workbox (NetworkFirst for Supabase, offline POS)
Deployment    Vercel (frontend) · Supabase Cloud (backend)
```

---

## Repository structure

```
nexus-ghana/
├── public/                     Static assets, PWA icons
├── src/
│   ├── components/             Shared + feature-specific components
│   │   ├── pos/                POS dialogs (MoMo, receipts, split pay)
│   │   ├── warehouse/          Transfer dialogs
│   │   ├── service/            Contract + equipment dialogs
│   │   ├── production/         Scheduling calendar
│   │   └── ui/                 shadcn primitives
│   ├── contexts/               AuthContext, StaffSessionContext
│   ├── hooks/                  useBusiness, useRealtimeInvalidate, useOfflineQueue, useLicenseTier
│   ├── integrations/supabase/  Generated types + client
│   ├── lib/                    ghana.ts (GHS, regions, taxes), utils
│   └── pages/
│       ├── modules/            One file per ERP module
│       └── Landing.tsx
├── supabase/
│   ├── functions/              Edge Functions (momo-collect, send-notifications)
│   ├── migrations/             Ordered SQL migrations (000001 → 000012)
│   └── config.toml
├── NEXUS_GH_SETUP.sql          All migrations concatenated — run once on a fresh project
├── vercel.json                 SPA rewrites + security headers
└── .env.example                Required env vars
```

---

## Local development

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)

### Setup

```bash
git clone https://github.com/gengenesix/nexux-rebuild.git
cd nexux-rebuild
npm install

cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm run dev        # http://localhost:8080
```

### Environment variables

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |

Edge Function secrets are set separately — see `.env.example` for the full list (`RESEND_API_KEY`, `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, `FROM_EMAIL`).

---

## Database setup

Run the consolidated migration file against your Supabase project:

```bash
# Using the Supabase CLI (recommended)
supabase db push

# Or paste NEXUS_GH_SETUP.sql directly into the Supabase SQL editor
# Dashboard → SQL Editor → New query → paste → Run
```

`NEXUS_GH_SETUP.sql` is idempotent — safe to run on an existing database.

### What it creates

- All application tables with full RLS policies
- `pg_cron` scheduled job: marks overdue invoices daily at 07:50 UTC
- RPCs: `verify_staff_pin`, `redeem_loyalty_points`, `void_sale`, `receive_purchase_order`, `get_dashboard_stats`
- Atomic invoice numbering with `SELECT FOR UPDATE`
- Bcrypt PIN hashing trigger via `pgcrypto`

---

## Supabase Edge Functions

```bash
# Deploy all functions
supabase functions deploy momo-collect
supabase functions deploy send-notifications

# Set secrets
supabase secrets set RESEND_API_KEY=re_xxx FROM_EMAIL="Nexus-GH <noreply@yourdomain.com>"
supabase secrets set HUBTEL_CLIENT_ID=xxx HUBTEL_CLIENT_SECRET=xxx
```

`send-notifications` runs on a daily cron (configured in `supabase/config.toml`) and sends low-stock alerts + overdue invoice digests via Resend.

`momo-collect` wraps the Hubtel Receive Money v1.1 API — normalises Ghana phone numbers, detects MTN/Vodafone/AirtelTigo networks, and handles the callback flow.

---

## Deployment — Vercel

1. Import the repo into Vercel
2. Set the two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) under **Project → Settings → Environment Variables**
3. Deploy — `vercel.json` handles SPA routing and sets security headers automatically

Build command: `npm run build`
Output directory: `dist`

---

## Authentication model

Two independent auth layers coexist:

- **Business owners** — Supabase JWT (email + password). Full access to their own tenant.
- **Staff** — PIN-based sessions stored in `sessionStorage`. PINs are bcrypt-hashed at the DB layer via a `pgcrypto` trigger. Five failed attempts trigger a 15-minute lockout enforced in the `verify_staff_pin` RPC.

RBAC is enforced at two levels: client-side `ROLE_PERMISSIONS` map for UX gating, and Supabase RLS policies as the authoritative security boundary.

---

## License tiers

| Tier | Modules |
|---|---|
| `starter` | POS, Inventory, Invoices, Customers, Expenses, Suppliers |
| `professional` | All modules |
| `limited_financial` | + Finance, Banking (no HR/Production) |
| `limited_logistics` | + Warehouse, Purchasing, Production (no Finance/HR) |
| `limited_sales_crm` | + CRM, Sales Orders, Projects (no Finance/HR/Production) |

Enforced via `useLicenseTier` hook + `TierGate` wrapper on protected routes. Businesses without a tier default to `professional`.

---

## Scripts

```bash
npm run dev          # Vite dev server (port 8080)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm run test         # Vitest (unit tests)
```

---

## Contributing

1. Branch off `main`
2. Follow the existing file conventions — one module per file in `src/pages/modules/`, shared components in `src/components/`
3. New DB changes go in `supabase/migrations/` with the next sequential timestamp, then append to `NEXUS_GH_SETUP.sql`
4. Keep RLS policies in sync with any new tables
