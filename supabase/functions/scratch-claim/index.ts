// scratch-claim — securely claim a scratch card reward and credit customer wallet
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeMobile(raw: string): string {
  let s = String(raw || "").replace(/\D/g, "");
  if (s.startsWith("91") && s.length > 10) s = s.slice(2);
  s = s.replace(/^0+/, "");
  if (s.length > 10) s = s.slice(-10);
  return s;
}

async function lookupAgent(mobile: string) {
  if (!mobile || mobile.length !== 10) return null;
  const elifeUrl = Deno.env.get("ELIFE_SUPABASE_URL");
  const elifeKey = Deno.env.get("ELIFE_SUPABASE_SERVICE_ROLE_KEY");
  if (!elifeUrl || !elifeKey) return null;
  const elifeHeaders = {
    apikey: elifeKey,
    Authorization: `Bearer ${elifeKey}`,
    "Content-Type": "application/json",
  };
  const r = await fetch(
    `${elifeUrl}/rest/v1/pennyekart_agents?or=(mobile.eq.${encodeURIComponent(mobile)},mobile.eq.${encodeURIComponent(`91${mobile}`)})&limit=1`,
    { headers: elifeHeaders },
  );
  if (!r.ok) return null;
  const arr = await r.json();
  return arr?.[0] || null;
}

async function countConsecutiveStreakDays(agentId: string, requiredDays: number): Promise<number> {
  const elifeUrl = Deno.env.get("ELIFE_SUPABASE_URL")!;
  const elifeKey = Deno.env.get("ELIFE_SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = { apikey: elifeKey, Authorization: `Bearer ${elifeKey}` };
  // Pull last (requiredDays + buffer) of distinct work_dates
  const since = new Date();
  since.setDate(since.getDate() - (requiredDays + 5));
  const sinceStr = since.toISOString().slice(0, 10);
  const r = await fetch(
    `${elifeUrl}/rest/v1/agent_work_logs?agent_id=eq.${agentId}&work_date=gte.${sinceStr}&select=work_date&order=work_date.desc`,
    { headers },
  );
  if (!r.ok) return 0;
  const rows: { work_date: string }[] = await r.json();
  const datesSet = new Set(rows.map((x) => x.work_date));

  // Walk back from today and count consecutive days present
  let streak = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < requiredDays + 2; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (datesSet.has(ds)) streak++;
    else break;
  }
  return streak;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims) return json(401, { error: "Unauthorized" });
    const userId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    // Load profile for audience matching
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, mobile_number, local_body_id, user_type")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return json(404, { error: "Profile not found" });

    // ---------- LIST eligible cards for caller ----------
    if (req.method === "GET" && action === "list") {
      const nowIso = new Date().toISOString();
      const { data: cards } = await admin
        .from("scratch_cards")
        .select("*")
        .eq("is_active", true)
        .lte("start_at", nowIso)
        .gte("end_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(50);

      const ids = (cards ?? []).map((c) => c.id);
      let claims: any[] = [];
      if (ids.length) {
        const { data } = await admin
          .from("scratch_card_claims")
          .select("card_id")
          .eq("user_id", userId)
          .in("card_id", ids);
        claims = data ?? [];
      }
      const claimedSet = new Set(claims.map((c) => c.card_id));

      // Resolve agent status (only if any agent / streak card present)
      const needsAgent = (cards ?? []).some(
        (c) => c.target_audience === "agents" || c.requires_agent_streak_days,
      );
      let agent: any = null;
      if (needsAgent && profile.mobile_number) {
        agent = await lookupAgent(normalizeMobile(profile.mobile_number));
      }

      const eligible: any[] = [];
      for (const c of cards ?? []) {
        if (claimedSet.has(c.id)) continue;
        // audience
        if (c.target_audience === "agents" && !agent) continue;
        if (c.target_audience === "panchayath") {
          const ids: string[] = c.target_local_body_ids || [];
          if (!profile.local_body_id || !ids.includes(profile.local_body_id)) continue;
        }
        // streak progress
        let streak_progress: number | null = null;
        let streak_required: number | null = null;
        let locked = false;
        if (c.requires_agent_streak_days && c.requires_agent_streak_days > 0) {
          if (!agent) continue;
          streak_required = c.requires_agent_streak_days;
          streak_progress = await countConsecutiveStreakDays(agent.id, c.requires_agent_streak_days);
          if (streak_progress < c.requires_agent_streak_days) locked = true;
        }
        eligible.push({ ...c, streak_progress, streak_required, locked });
      }

      return json(200, { cards: eligible });
    }

    // ---------- CLAIM ----------
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const cardId = String(body.card_id || "");
      if (!cardId) return json(400, { error: "card_id required" });

      const { data: card } = await admin
        .from("scratch_cards")
        .select("*")
        .eq("id", cardId)
        .maybeSingle();
      if (!card) return json(404, { error: "Card not found" });

      const now = new Date();
      if (!card.is_active) return json(403, { error: "Card not active" });
      if (new Date(card.start_at) > now || new Date(card.end_at) < now) {
        return json(403, { error: "Card not in active window" });
      }

      // Audience
      if (card.target_audience === "agents" || card.requires_agent_streak_days) {
        const agent = await lookupAgent(normalizeMobile(profile.mobile_number || ""));
        if (!agent) return json(403, { error: "Only e-Life agents can claim this card" });
        if (card.requires_agent_streak_days) {
          const streak = await countConsecutiveStreakDays(agent.id, card.requires_agent_streak_days);
          if (streak < card.requires_agent_streak_days) {
            return json(403, {
              error: "Streak not yet complete",
              streak_progress: streak,
              streak_required: card.requires_agent_streak_days,
            });
          }
        }
      }
      if (card.target_audience === "panchayath") {
        const ids: string[] = card.target_local_body_ids || [];
        if (!profile.local_body_id || !ids.includes(profile.local_body_id)) {
          return json(403, { error: "Not eligible for this card" });
        }
      }

      // Claim count
      const { count } = await admin
        .from("scratch_card_claims")
        .select("id", { count: "exact", head: true })
        .eq("card_id", cardId)
        .eq("user_id", userId);
      if ((count ?? 0) >= (card.max_claims_per_user || 1)) {
        return json(409, { error: "Already claimed" });
      }

      // Insert claim (unique constraint guards races)
      const { data: claimRow, error: claimErr } = await admin
        .from("scratch_card_claims")
        .insert({
          card_id: cardId,
          user_id: userId,
          reward_amount: card.reward_amount,
        })
        .select()
        .single();
      if (claimErr) {
        if (claimErr.code === "23505") return json(409, { error: "Already claimed" });
        return json(500, { error: "Claim failed", details: claimErr.message });
      }

      // Credit wallet
      let newBalance = 0;
      let walletTxId: string | null = null;
      if (Number(card.reward_amount) > 0) {
        // Ensure wallet exists
        let { data: wallet } = await admin
          .from("customer_wallets")
          .select("*")
          .eq("customer_user_id", userId)
          .maybeSingle();
        if (!wallet) {
          const { data: newW } = await admin
            .from("customer_wallets")
            .insert({ customer_user_id: userId, balance: 0 })
            .select()
            .single();
          wallet = newW;
        }
        if (wallet) {
          const updated = Number(wallet.balance) + Number(card.reward_amount);
          await admin
            .from("customer_wallets")
            .update({ balance: updated, updated_at: new Date().toISOString() })
            .eq("id", wallet.id);
          const { data: tx } = await admin
            .from("customer_wallet_transactions")
            .insert({
              wallet_id: wallet.id,
              customer_user_id: userId,
              type: "credit",
              amount: card.reward_amount,
              description: `Scratch & Win: ${card.title} (+₹${card.reward_amount})`,
            })
            .select()
            .single();
          walletTxId = tx?.id ?? null;
          newBalance = updated;

          if (walletTxId) {
            await admin
              .from("scratch_card_claims")
              .update({ wallet_tx_id: walletTxId })
              .eq("id", claimRow.id);
          }
        }
      }

      return json(200, {
        success: true,
        reward_amount: Number(card.reward_amount),
        balance: newBalance,
        reveal_text: card.reveal_text,
        reveal_image_url: card.reveal_image_url,
        product_link_url: card.product_link_url,
        product_discount_text: card.product_discount_text,
      });
    }

    // ---------- ADMIN: list claims for a card ----------
    if (req.method === "GET" && action === "claims") {
      const { data: caller } = await admin
        .from("profiles")
        .select("is_super_admin, role_id")
        .eq("user_id", userId)
        .maybeSingle();
      let allowed = !!caller?.is_super_admin;
      if (!allowed && caller?.role_id) {
        const { data: perms } = await admin
          .from("role_permissions")
          .select("permissions(name)")
          .eq("role_id", caller.role_id);
        allowed = (perms ?? []).some((r: any) => r.permissions?.name === "read_settings");
      }
      if (!allowed) return json(403, { error: "Forbidden" });

      const cardId = url.searchParams.get("card_id");
      if (!cardId) return json(400, { error: "card_id required" });

      const { data: claims } = await admin
        .from("scratch_card_claims")
        .select("id, user_id, reward_amount, claimed_at")
        .eq("card_id", cardId)
        .order("claimed_at", { ascending: false });

      const userIds = (claims ?? []).map((c) => c.user_id);
      let users: any[] = [];
      if (userIds.length) {
        const { data: profs } = await admin
          .from("profiles")
          .select("user_id, full_name, mobile_number, ward_number, locations_local_bodies(name)")
          .in("user_id", userIds);
        users = profs ?? [];
      }
      const userMap = new Map(users.map((u) => [u.user_id, u]));
      const enriched = (claims ?? []).map((c) => {
        const u: any = userMap.get(c.user_id) || {};
        return {
          id: c.id,
          user_id: c.user_id,
          full_name: u.full_name,
          mobile_number: u.mobile_number,
          local_body_name: u.locations_local_bodies?.name ?? null,
          ward_number: u.ward_number,
          reward_amount: c.reward_amount,
          claimed_at: c.claimed_at,
        };
      });
      return json(200, { claims: enriched });
    }

    return json(405, { error: "Method not allowed" });
  } catch (e) {
    console.error("scratch-claim error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown" });
  }
});
