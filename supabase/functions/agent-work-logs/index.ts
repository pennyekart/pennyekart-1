// agent-work-logs — bridges customer's mobile to e-Life pennyekart_agents and CRUDs agent_work_logs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims) return json(401, { error: "Unauthorized" });
    const userId = claims.claims.sub as string;

    // Find caller's mobile (any profile with this user_id, then any sibling profile sharing the mobile is fine — we use this profile's mobile)
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("mobile_number, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    const mobile = (profile?.mobile_number || "").trim();
    if (!mobile) return json(400, { error: "No mobile number on profile" });

    // Lookup agent in e-Life
    const elifeUrl = Deno.env.get("ELIFE_SUPABASE_URL");
    const elifeKey = Deno.env.get("ELIFE_SUPABASE_SERVICE_ROLE_KEY");
    if (!elifeUrl || !elifeKey) return json(500, { error: "e-Life not configured" });

    const elifeHeaders = {
      apikey: elifeKey,
      Authorization: `Bearer ${elifeKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    // Try exact and last-10-digits match
    const last10 = mobile.replace(/\D/g, "").slice(-10);
    const agentRes = await fetch(
      `${elifeUrl}/rest/v1/pennyekart_agents?or=(mobile.eq.${encodeURIComponent(mobile)},mobile.eq.${encodeURIComponent(last10)})&limit=1`,
      { headers: elifeHeaders },
    );
    if (!agentRes.ok) return json(502, { error: "e-Life lookup failed", details: await agentRes.text() });
    const agents = await agentRes.json();
    const agent = agents?.[0];
    if (!agent) return json(404, { error: "not_an_agent", message: "Mobile not registered as a Pennyekart agent" });

    const url = new URL(req.url);

    if (req.method === "GET") {
      // List logs for this agent, optionally filtered by date or month
      const date = url.searchParams.get("date"); // YYYY-MM-DD
      const month = url.searchParams.get("month"); // YYYY-MM
      let q = `agent_id=eq.${agent.id}&order=work_date.desc,created_at.desc`;
      if (date) q += `&work_date=eq.${date}`;
      else if (month) q += `&work_date=gte.${month}-01&work_date=lt.${nextMonth(month)}-01`;
      const r = await fetch(`${elifeUrl}/rest/v1/agent_work_logs?${q}`, { headers: elifeHeaders });
      if (!r.ok) return json(502, { error: "fetch failed", details: await r.text() });
      const logs = await r.json();
      return json(200, { agent: { id: agent.id, name: agent.name, role: agent.role, mobile: agent.mobile }, logs });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const work_date = String(body.work_date || "").trim();
      const work_details = String(body.work_details || "").trim();
      if (!work_date || !work_details) return json(400, { error: "work_date and work_details required" });
      const r = await fetch(`${elifeUrl}/rest/v1/agent_work_logs`, {
        method: "POST",
        headers: elifeHeaders,
        body: JSON.stringify({ agent_id: agent.id, work_date, work_details }),
      });
      if (!r.ok) return json(502, { error: "insert failed", details: await r.text() });
      return json(200, { ok: true, log: (await r.json())?.[0] });
    }

    if (req.method === "PUT") {
      const body = await req.json().catch(() => ({}));
      const id = String(body.id || "");
      const work_details = String(body.work_details || "").trim();
      if (!id || !work_details) return json(400, { error: "id and work_details required" });
      const r = await fetch(
        `${elifeUrl}/rest/v1/agent_work_logs?id=eq.${id}&agent_id=eq.${agent.id}`,
        { method: "PATCH", headers: elifeHeaders, body: JSON.stringify({ work_details, updated_at: new Date().toISOString() }) },
      );
      if (!r.ok) return json(502, { error: "update failed", details: await r.text() });
      return json(200, { ok: true, log: (await r.json())?.[0] });
    }

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json(400, { error: "id required" });
      const r = await fetch(
        `${elifeUrl}/rest/v1/agent_work_logs?id=eq.${id}&agent_id=eq.${agent.id}`,
        { method: "DELETE", headers: elifeHeaders },
      );
      if (!r.ok) return json(502, { error: "delete failed", details: await r.text() });
      return json(200, { ok: true });
    }

    return json(405, { error: "Method not allowed" });
  } catch (e) {
    console.error("agent-work-logs error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown" });
  }
});

function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m is 0-indexed → next month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
