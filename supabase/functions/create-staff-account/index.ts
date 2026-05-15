// Edge Function: create-staff-account
// Creates a Supabase Auth account for a new staff member (admin invite flow).
// Uses SUPABASE_SERVICE_ROLE_KEY — never call admin.createUser from the frontend.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Admin client — bypasses RLS
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Caller's client — verifies the JWT
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // 1. Verify the caller is a real Supabase user
    const { data: { user: callerUser }, error: authErr } =
      await caller.auth.getUser();
    if (authErr || !callerUser) {
      return json({ error: "Unauthorized" }, 401);
    }

    // 2. Confirm they own a business (owners only may add staff this way)
    const { data: business } = await admin
      .from("businesses")
      .select("id")
      .eq("owner_id", callerUser.id)
      .maybeSingle();

    if (!business) {
      return json({ error: "Only business owners can create staff accounts" }, 403);
    }

    // 3. Parse request body
    const { email, pin, name, role, phone, staffId } = await req.json();
    if (!email || !name || !pin) {
      return json({ error: "email, name, and pin are required" }, 400);
    }

    // 4. Send an invite email — staff sets their own password via the link.
    //    email_confirm is handled by the invite flow automatically.
    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${req.headers.get("origin") ?? supabaseUrl}/login`,
        data: { full_name: name },
      });

    if (inviteErr) {
      // If the user already exists in auth.users, fetch their id instead
      if (inviteErr.message?.includes("already been registered")) {
        const { data: existing } = await admin
          .from("auth.users")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        // fall through using existing user id — handled below
        void existing;
      }
      return json({ error: inviteErr.message }, 400);
    }

    const authUserId = invited.user?.id;
    if (!authUserId) {
      return json({ error: "Failed to create auth account" }, 500);
    }

    // 5. Insert the staff_members record linked to the new auth user
    const { error: insertErr } = await admin.from("staff_members").insert({
      business_id:       business.id,
      name:              name.trim(),
      role:              role ?? "Staff",
      phone:             phone || null,
      email,
      pin,              // Kiosk/PIN auth still works alongside email login
      staff_id:          staffId || null,
      supabase_user_id:  authUserId,
      status:            "active",
    });

    if (insertErr) {
      // Roll back — delete the auth user we just invited
      await admin.auth.admin.deleteUser(authUserId);
      return json({ error: insertErr.message }, 400);
    }

    return json({ success: true, message: `Invite sent to ${email}` });
  } catch (err: any) {
    return json({ error: err?.message ?? "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
