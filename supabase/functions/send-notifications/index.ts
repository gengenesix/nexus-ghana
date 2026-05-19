/**
 * Supabase Edge Function: send-notifications
 *
 * Sends email alerts to business owners for:
 *   1. Overdue invoices (due_date < today, status in sent/overdue/partial)
 *   2. Low-stock products (qty <= reorder_level)
 *
 * Invoke via Supabase cron or HTTP POST with:
 *   { "business_id": "uuid" }          — single business
 *   {}                                  — all businesses (cron mode)
 *
 * Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY   — from resend.com
 *   FROM_EMAIL       — e.g. "Nexus-GH <noreply@nexusgh.com>"
 *   SUPABASE_URL     — auto-injected by Supabase runtime
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Nexus-GH <noreply@nexusgh.com>";
const APP_URL    = Deno.env.get("APP_URL")    ?? "https://nexus-ghana.vercel.app";

// ── HTML escape — prevents injection of user-supplied data into email HTML ────
function h(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Resend helper ─────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email to", to);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
  }
}

// ── Email templates ───────────────────────────────────────────────────────────
function overdueEmailHtml(businessName: string, invoices: any[]) {
  const rows = invoices
    .map(
      (inv) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${h(inv.invoice_number)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${h(inv.customer_name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${h(inv.due_date)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#d97706">
          GHS ${Number(inv.total).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
        </td>
      </tr>`
    )
    .join("");

  const total = invoices.reduce((s, i) => s + Number(i.total), 0);

  return `
  <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#0f1623;padding:24px 32px;border-radius:12px 12px 0 0">
      <h1 style="color:#d97706;margin:0;font-size:22px">Nexus-GH</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">${h(businessName)}</p>
    </div>
    <div style="padding:32px">
      <h2 style="color:#1e293b;margin-top:0">⚠️ Overdue Invoice Alert</h2>
      <p style="color:#475569">You have <strong>${invoices.length}</strong> overdue invoice${invoices.length === 1 ? "" : "s"} totalling
        <strong style="color:#d97706">GHS ${total.toLocaleString("en-GH", { minimumFractionDigits: 2 })}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Invoice</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Customer</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Due Date</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:24px">
        <a href="${APP_URL}/invoices"
           style="background:#d97706;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          View Invoices →
        </a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-radius:0 0 12px 12px;font-size:12px;color:#94a3b8">
      Nexus-GH — Business Management for Ghana SMEs
    </div>
  </div>`;
}

function lowStockEmailHtml(businessName: string, products: any[]) {
  const rows = products
    .map(
      (p) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${h(p.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">
          <span style="background:${p.qty === 0 ? "#fef2f2" : "#fefce8"};color:${p.qty === 0 ? "#dc2626" : "#d97706"};padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600">
            ${p.qty === 0 ? "Out of stock" : h(p.qty) + " left"}
          </span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#64748b">${h(p.reorder_level)}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#0f1623;padding:24px 32px;border-radius:12px 12px 0 0">
      <h1 style="color:#d97706;margin:0;font-size:22px">Nexus-GH</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">${h(businessName)}</p>
    </div>
    <div style="padding:32px">
      <h2 style="color:#1e293b;margin-top:0">📦 Low Stock Alert</h2>
      <p style="color:#475569">
        <strong>${products.length}</strong> product${products.length === 1 ? " is" : "s are"} at or below reorder level.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Product</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Stock</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Reorder At</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:24px">
        <a href="${APP_URL}/inventory"
           style="background:#d97706;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          View Inventory →
        </a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-radius:0 0 12px 12px;font-size:12px;color:#94a3b8">
      Nexus-GH — Business Management for Ghana SMEs
    </div>
  </div>`;
}

// ── Per-business notification logic ───────────────────────────────────────────
async function notifyBusiness(businessId: string) {
  // Fetch business + owner email
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, email, owner_id")
    .eq("id", businessId)
    .single();

  if (!business?.email) return;

  const today = new Date().toISOString().split("T")[0];

  // Overdue invoices
  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select("invoice_number, customer_name, total, due_date")
    .eq("business_id", businessId)
    .in("status", ["sent", "overdue", "partial"])
    .lt("due_date", today);

  if (overdueInvoices && overdueInvoices.length > 0) {
    await sendEmail(
      business.email,
      `⚠️ ${overdueInvoices.length} Overdue Invoice${overdueInvoices.length === 1 ? "" : "s"} — ${business.name}`,
      overdueEmailHtml(business.name, overdueInvoices)
    );
  }

  // PostgREST can't filter qty <= reorder_level cross-column — fetch all, filter client-side
  const { data: lowStockProducts } = await supabase
    .from("products")
    .select("name, qty, reorder_level")
    .eq("business_id", businessId)
    .order("qty", { ascending: true });

  const actualLowStock = (lowStockProducts ?? []).filter(
    (p) => p.qty <= p.reorder_level
  );

  if (actualLowStock.length > 0) {
    await sendEmail(
      business.email,
      `📦 ${actualLowStock.length} Low Stock Alert${actualLowStock.length === 1 ? "" : "s"} — ${business.name}`,
      lowStockEmailHtml(business.name, actualLowStock)
    );
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const businessId = body?.business_id as string | undefined;

    if (businessId) {
      // Single-business mode
      await notifyBusiness(businessId);
    } else {
      // Cron mode — process all businesses that have an email set
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id")
        .not("email", "is", null)
        .neq("email", "");

      await Promise.all((businesses ?? []).map((b) => notifyBusiness(b.id)));
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
