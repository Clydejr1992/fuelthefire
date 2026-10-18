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

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from("profiles").select("id,role,active").eq("id", callerData.user.id).maybeSingle();
  if (callerProfileError || !callerProfile || callerProfile.active !== true || callerProfile.role !== "admin") {
    return respond(403, { error: "Active administrator access required." });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond(400, { error: "Request body must be valid JSON." }); }
  const targetId = String(body.user_id ?? "").trim();
  const action = String(body.action ?? "").trim();
  if (!targetId || !["set_active", "delete"].includes(action)) return respond(400, { error: "Invalid account action." });
  if (targetId === callerData.user.id) return respond(400, { error: "You cannot deactivate or delete your own administrator account." });

  const { data: target, error: targetError } = await adminClient
    .from("profiles").select("id,full_name,email,role,active").eq("id", targetId).maybeSingle();
  if (targetError || !target) return respond(404, { error: "Employee account was not found." });
  if (target.role === "admin") return respond(403, { error: "Administrator accounts cannot be managed here." });

  if (action === "set_active") {
    const active = body.active === true;
    const { error } = await adminClient.from("profiles").update({ active, updated_at: new Date().toISOString() }).eq("id", targetId);
    if (error) return respond(500, { error: error.message });
    await adminClient.from("audit_logs").insert({
      user_id: callerData.user.id,
      action: active ? "employee_account_activated" : "employee_account_deactivated",
      entity_type: "profile",
      entity_id: targetId,
      description: `${active ? "Activated" : "Deactivated"} employee account for ${target.email}`,
      metadata: { email: target.email, role: target.role },
    });
    return respond(200, { success: true, active });
  }

  // Preserve historical records and record the deletion before removing the Auth account.
  const { error: auditError } = await adminClient.from("audit_logs").insert({
    user_id: callerData.user.id,
    action: "employee_account_deleted",
    entity_type: "profile",
    entity_id: targetId,
    description: `Deleted employee account for ${target.email}`,
    metadata: { email: target.email, role: target.role },
  });
  if (auditError) return respond(500, { error: "Could not record the deletion audit entry." });

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetId);
  if (deleteError) return respond(500, { error: deleteError.message });
  return respond(200, { success: true, deleted: true });
});
