import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://fuelthefire.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "POST only." });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!url || !serviceKey || !authHeader) return respond(500, { error: "Server configuration or sign-in is missing." });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const callerClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) return respond(401, { error: "Valid sign-in required." });

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id,role,active")
    .eq("id", callerData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.active !== true || !["admin", "manager"].includes(profile.role)) {
    return respond(403, { error: "Active manager or administrator access required." });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond(400, { error: "Request body must be valid JSON." }); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const full_name = String(body.full_name ?? "").trim();
  const password = String(body.temporary_password ?? "");
  const role = String(body.role ?? "employee");
  const employee_number = body.employee_number ? String(body.employee_number).trim() : null;
  const department = body.department ? String(body.department).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(400, { error: "Enter a valid email address." });
  if (!full_name || full_name.length > 120) return respond(400, { error: "Full name is required (maximum 120 characters)." });
  if (password.length < 12) return respond(400, { error: "Temporary password must be at least 12 characters." });
  if (!["employee", "manager", "cook"].includes(role)) return respond(400, { error: "Only employee, manager, or cook roles can be created here." });
  if (role === "cook" && profile.role !== "admin") return respond(403, { error: "Only an administrator can create Cook accounts." });

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (createError || !created.user) {
    return respond(400, { error: createError?.message ?? "Could not create account." });
  }

  const { error: upsertError } = await adminClient.from("profiles").upsert({
    id: created.user.id,
    full_name,
    email,
    employee_number,
    department,
    phone,
    role,
    active: true,
    must_change_password: true,
    updated_at: new Date().toISOString(),
  });
  if (upsertError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return respond(500, { error: "Account profile could not be created; the new account was rolled back." });
  }

  await adminClient.from("audit_logs").insert({
    user_id: callerData.user.id,
    action: "employee_account_created",
    entity_type: "profile",
    entity_id: created.user.id,
    description: `Created ${role} account for ${email}`,
    metadata: { email, role, employee_number, department },
  });

  return respond(200, { success: true, user_id: created.user.id, email, role });
});
