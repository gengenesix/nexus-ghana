// Edge Function: create-staff-account
// Creates a Supabase Auth account for a new staff member.
// Uses admin.createUser (no invite email) — admin sets the initial password,
// staff can log in immediately with the credentials the admin provides.
//
// Required secrets (auto-injected by Supabase):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // 1. Verify caller is authenticated
    const { data: { user: callerUser }, error: authErr } = await caller.auth.getUser();
    if (authErr || !callerUser) return json({ error: "Unauthorized" }, 401);

    // 2. Confirm they own a business
    const { data: business } = await admin
      .from("businesses")
      .select("id")
      .eq("owner_id", callerUser.id)
      .maybeSingle();
    if (!business) return json({ error: "Only business owners can create staff accounts" }, 403);

    // 3. Parse body
    const { email, initialPassword, pin, name, role, phone, staffId } = await req.json();
    if (!email || !name || !pin || !initialPassword) {
      return json({ error: "email, name, pin, and initialPassword are required" }, 400);
    }
    if (initialPassword.length < 8) {
      return json({ error: "Initial password must be at least 8 characters" }, 400);
    }

    // 4. Create auth account with a known password — no invite email.
    //    email_confirm: true → account active immediately.
    //    Admin gives staff their credentials (Access Code + Staff ID + password) directly.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createErr) {
      if (createErr.message?.toLowerCase().includes("already")) {
        return json({ error: `An account with email ${email} already exists.` }, 409);
      }
      return json({ error: createErr.message }, 400);
    }

    const authUserId = created.user?.id;
    if (!authUserId) return json({ error: "Failed to create auth account" }, 500);

    // 5. Insert staff_members row linked to the auth user
    const { error: insertErr } = await admin.from("staff_members").insert({
      business_id:      business.id,
      name:             name.trim(),
      role:             role ?? "Staff",
      phone:            phone || null,
      email:            email.trim(),
      pin,
      staff_id:         staffId || null,
      supabase_user_id: authUserId,
      status:           "active",
    });

    if (insertErr) {
      await admin.auth.admin.deleteUser(authUserId);
      return json({ error: insertErr.message }, 400);
    }

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err?.message ?? "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
