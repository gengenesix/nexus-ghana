/**
 * Supabase Edge Function: momo-collect
 *
 * Initiates a Mobile Money payment collection via Hubtel's
 * Receive Money API and polls for confirmation.
 *
 * Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
 *   HUBTEL_CLIENT_ID         — from Hubtel merchant portal
 *   HUBTEL_CLIENT_SECRET     — from Hubtel merchant portal
 *   SUPABASE_URL             — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 *
 * POST body:
 *   {
 *     merchant_account_number: string,  // momo_merchant_mtn / telecel / airteltigo
 *     customer_msisdn: string,          // customer phone e.g. "0241234567"
 *     amount: number,                   // GHS amount
 *     description: string,             // shown on customer phone
 *     client_reference: string,         // your unique ref (receipt number)
 *   }
 *
 * Response:
 *   { success: true,  token: string, status: "pending" | "paid" }
 *   { success: false, message: string }
 */

const HUBTEL_BASE = "https://api.hubtel.com/v1/merchantaccount/merchants";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientId = Deno.env.get("HUBTEL_CLIENT_ID");
  const clientSecret = Deno.env.get("HUBTEL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ success: false, message: "Hubtel credentials not configured. Set HUBTEL_CLIENT_ID and HUBTEL_CLIENT_SECRET in Edge Function secrets." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: {
    merchant_account_number: string;
    customer_msisdn: string;
    amount: number;
    description: string;
    client_reference: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { merchant_account_number, customer_msisdn, amount, description, client_reference } = body;

  if (!merchant_account_number || !customer_msisdn || !amount || !client_reference) {
    return new Response(
      JSON.stringify({ success: false, message: "Missing required fields: merchant_account_number, customer_msisdn, amount, client_reference" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Normalize phone: strip leading 0, add 233 country code
  const msisdn = customer_msisdn.replace(/^0/, "233").replace(/\s/g, "");

  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const res = await fetch(
      `${HUBTEL_BASE}/${merchant_account_number}/receive/mobilemoney`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          CustomerMsisdn: msisdn,
          Channel: detectChannel(msisdn),
          Amount: amount,
          PrimaryCallbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/momo-webhook`,
          Description: description,
          ClientReference: client_reference,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok || data.ResponseCode !== "0000") {
      console.error("Hubtel error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ success: false, message: data.Message ?? "Payment initiation failed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: data.Data?.ClientReference ?? client_reference,
        status: "pending",
        message: "Payment prompt sent to customer's phone",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("momo-collect error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Internal error calling Hubtel API" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/** Detect MoMo network from MSISDN prefix */
function detectChannel(msisdn: string): string {
  const normalized = msisdn.replace(/^233/, "0");
  if (/^(024|054|055|059)/.test(normalized)) return "mtn-gh";
  if (/^(020|050)/.test(normalized)) return "vodafone-gh"; // Telecel
  if (/^(027|057|026|056)/.test(normalized)) return "tigo-gh"; // AirtelTigo
  return "mtn-gh"; // default
}
