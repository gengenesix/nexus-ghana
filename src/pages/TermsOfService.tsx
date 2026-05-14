import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "14 May 2026";
const COMPANY = "GENESIS";
const APP_NAME = "Nexis";
const CONTACT_EMAIL = "gengenesix@gmail.com";
const CONTACT_PHONE = "+233 534 788 852";

const sections = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    body: `By creating an account on ${APP_NAME} or using any part of the platform, you confirm that you have read, understood, and agree to be bound by these Terms of Service. If you are registering on behalf of a business, you represent that you have authority to bind that business to these terms.

If you do not agree to any part of these terms, you must not use the platform.`,
  },
  {
    id: "description",
    title: "2. What Nexis Is",
    body: `${APP_NAME} is a cloud-based business management platform designed for small and medium enterprises (SMEs) operating in Ghana. It provides tools for point-of-sale transactions, inventory management, invoicing, expense tracking, customer relationship management, staff management, and financial reporting.

${APP_NAME} is built and maintained by ${COMPANY}, a software venture based in Ghana.`,
  },
  {
    id: "accounts",
    title: "3. Accounts & Registration",
    body: `You must provide accurate, current, and complete information when creating your account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.

Business owners may invite staff members to the platform. Each staff member creates their own account and is bound by these same terms. The business owner is responsible for the conduct of staff members on the platform.

You must be at least 18 years old to create an account.

We reserve the right to suspend or terminate accounts that provide false information or violate these terms.`,
  },
  {
    id: "use",
    title: "4. Acceptable Use",
    body: `You agree to use ${APP_NAME} only for lawful business purposes. You must not:

• Use the platform to process fraudulent transactions or falsify records
• Attempt to gain unauthorised access to any part of the system or another user's business data
• Reverse-engineer, decompile, or copy any part of the platform
• Use the service to store or transmit malicious code
• Circumvent or disable any security or access-control features
• Violate any applicable Ghanaian law, regulation, or tax obligation

We reserve the right to investigate and take appropriate action — including account suspension — against any use we determine, in our sole discretion, violates these terms.`,
  },
  {
    id: "data",
    title: "5. Your Data",
    body: `You own all business data you enter into ${APP_NAME} — your products, sales, customers, invoices, and financial records belong to you.

We process your data to deliver the service and will not sell it to third parties. Data is stored using Supabase (PostgreSQL) infrastructure with row-level security. Backups are maintained automatically.

You may export your data at any time using the CSV export features available throughout the platform.

We retain your data for as long as your account is active, plus 90 days after deletion to allow for recovery requests.`,
  },
  {
    id: "payments",
    title: "6. Subscription & Billing",
    body: `${APP_NAME} offers a free Starter plan with no time limit. Paid plans are billed monthly or annually and are subject to the pricing published on the platform at the time of subscription.

All prices are quoted in Ghanaian Cedi (GH₵). Payments are processed through our designated payment partners.

Subscriptions automatically renew unless cancelled before the next billing date. No refunds are provided for partial billing periods, but you may cancel at any time and your access will continue until the end of the current paid period.

We reserve the right to change pricing with at least 30 days notice to active paying subscribers.`,
  },
  {
    id: "momo",
    title: "7. MoMo Payment Integration",
    body: `${APP_NAME} integrates with mobile money networks (MTN MoMo, Telecel Cash, AirtelTigo Money) via Hubtel's payment API to facilitate customer payment collection.

By enabling MoMo collection, you agree to Hubtel's own terms of service and merchant policies. ${APP_NAME} is not a licensed payment service provider — we act as a technical intermediary. Settlement of funds is governed by the applicable mobile money operator's policies.

Merchant credentials (Client ID and Client Secret) are stored encrypted. You are responsible for keeping your Hubtel credentials secure.`,
  },
  {
    id: "liability",
    title: "8. Limitation of Liability",
    body: `${APP_NAME} is provided "as is." We make no warranties, express or implied, regarding uptime, accuracy of calculations, or fitness for a particular purpose.

To the maximum extent permitted by Ghanaian law, ${COMPANY} shall not be liable for any indirect, incidental, special, or consequential damages, including loss of revenue, loss of data, or business interruption — even if we have been advised of the possibility of such damages.

Our total liability to you for any claim arising out of the use of ${APP_NAME} shall not exceed the amount you paid us in the three months preceding the claim.

This limitation does not apply to liability arising from gross negligence or wilful misconduct on our part.`,
  },
  {
    id: "termination",
    title: "9. Termination",
    body: `Either party may terminate the relationship at any time.

You may delete your account from the Settings page. Upon deletion, we will permanently remove your data after 90 days.

We may suspend or terminate your access immediately if you breach these terms, if required by law, or if we discontinue the service. We will provide reasonable notice before service discontinuation where possible.`,
  },
  {
    id: "governing",
    title: "10. Governing Law",
    body: `These Terms of Service are governed by the laws of the Republic of Ghana. Any disputes arising from these terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts of Ghana.`,
  },
  {
    id: "changes",
    title: "11. Changes to These Terms",
    body: `We may update these terms from time to time. When we do, we will update the "Last Updated" date at the top of this page and notify active users by email at least 14 days before material changes take effect.

Your continued use of the platform after changes become effective constitutes your acceptance of the new terms.`,
  },
  {
    id: "contact",
    title: "12. Contact Us",
    body: `If you have any questions about these Terms of Service, please contact us:

Email: ${CONTACT_EMAIL}
Phone: ${CONTACT_PHONE}
Developer: ${COMPANY}
Platform: ${APP_NAME} — Business Management for Ghana SMEs`,
  },
];

export default function TermsOfService() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--cream)", color: "var(--forest)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* ── Top bar ── */}
      <div
        className="sticky top-0 z-10 h-14 flex items-center px-6 lg:px-8"
        style={{ backgroundColor: "var(--forest)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
          <Link to="/" style={{ textDecoration: "none" }}>
            <div style={{
              backgroundColor: "white",
              borderRadius: 10,
              padding: "4px 14px 4px 7px",
              display: "inline-flex",
              alignItems: "center",
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}>
              <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 34, display: "block" }} />
            </div>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </div>

      {/* ── Header ── */}
      <div style={{ backgroundColor: "var(--forest)" }} className="pb-16 pt-12">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          {/* Large logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div style={{
              backgroundColor: "white",
              borderRadius: 20,
              padding: "14px 28px 14px 18px",
              display: "inline-flex",
              alignItems: "center",
              boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
            }}>
              <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 52, display: "block" }} />
            </div>
          </div>

          <h1
            className="text-center font-extrabold text-white mb-3"
            style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", letterSpacing: "-0.04em" }}
          >
            Terms of Service
          </h1>
          <p className="text-center font-medium" style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Last updated: {LAST_UPDATED} · Effective immediately for new accounts
          </p>
        </div>
      </div>

      {/* ── Intro band ── */}
      <div style={{ backgroundColor: "white", borderBottom: "1px solid hsl(var(--border))" }} className="py-8">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <p className="text-base leading-relaxed font-medium" style={{ color: "hsl(140,12%,40%)", maxWidth: 680 }}>
            These Terms of Service govern your access to and use of <strong style={{ color: "var(--forest)" }}>Nexis</strong>,
            a business management platform built for Ghanaian SMEs by <strong style={{ color: "var(--forest)" }}>GENESIS</strong>.
            Please read them carefully. They are written in plain language so you know exactly what you are agreeing to.
          </p>
        </div>
      </div>

      {/* ── Table of contents ── */}
      <div className="py-10" style={{ backgroundColor: "var(--cream)" }}>
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <p className="text-xs font-black uppercase mb-4" style={{ color: "hsl(140,20%,52%)", letterSpacing: "0.1em" }}>Contents</p>
          <div className="grid sm:grid-cols-2 gap-1">
            {sections.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70 py-1"
                style={{ color: "var(--forest)", textDecoration: "none" }}
              >
                <span style={{ color: "hsl(140,20%,52%)", minWidth: 8, display: "inline-block" }}>›</span>
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sections ── */}
      <div className="py-10 pb-24" style={{ backgroundColor: "white" }}>
        <div className="mx-auto max-w-4xl px-6 lg:px-8 space-y-14">
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2
                className="font-extrabold mb-4"
                style={{ fontSize: "1.2rem", color: "var(--forest)", letterSpacing: "-0.025em" }}
              >
                {s.title}
              </h2>
              <div className="space-y-3">
                {s.body.split("\n\n").map((para, i) => (
                  <p
                    key={i}
                    className="text-sm leading-relaxed"
                    style={{ color: "hsl(140,10%,40%)", fontWeight: 500, whiteSpace: "pre-line" }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ backgroundColor: "var(--forest)" }} className="py-10">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div style={{
            backgroundColor: "white",
            borderRadius: 10,
            padding: "5px 14px 5px 7px",
            display: "inline-flex",
            alignItems: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          }}>
            <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 32, display: "block" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
            © 2026 Nexis · By GENESIS · {CONTACT_EMAIL}
          </p>
          <Link
            to="/register"
            className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
