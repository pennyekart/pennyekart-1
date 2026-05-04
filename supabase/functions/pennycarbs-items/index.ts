import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CarbItem {
  name: string;
  image_url: string;
  price?: number;
}

let cache: { at: number; payload: { enabled: boolean; items: CarbItem[] } } | null = null;
const TTL_MS = 5 * 60 * 1000;

function normalize(raw: unknown): CarbItem[] {
  // Accept either an array, or { items: [...] }, or { data: [...] }
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.items)) arr = r.items as any[];
    else if (Array.isArray(r.data)) arr = r.data as any[];
    else if (Array.isArray(r.products)) arr = r.products as any[];
  }
  return arr
    .map((it) => {
      const name = String(it?.name ?? it?.title ?? "").trim();
      const image_url = String(
        it?.image_url ?? it?.image ?? it?.thumbnail ?? it?.photo ?? ""
      ).trim();
      const priceRaw = it?.price ?? it?.amount;
      const price = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
      return { name, image_url, price: Number.isFinite(price) ? price : undefined };
    })
    .filter((it) => it.name && it.image_url);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return new Response(JSON.stringify(cache.payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "pennycarbs_items_api_url",
        "pennycarbs_api_key",
        "pennycarbs_banner_enabled",
      ]);

    const map = new Map<string, string>();
    (rows ?? []).forEach((r: any) => map.set(r.key, (r.value ?? "").toString().trim()));

    const enabled = map.get("pennycarbs_banner_enabled") === "true";
    const url = map.get("pennycarbs_items_api_url") ?? "";
    const apiKey = map.get("pennycarbs_api_key") ?? "";

    if (!enabled || !url) {
      const payload = { enabled: false, items: [] as CarbItem[] };
      cache = { at: Date.now(), payload };
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const resp = await fetch(url, { headers });
    let items: CarbItem[] = [];
    if (resp.ok) {
      const json = await resp.json().catch(() => null);
      items = normalize(json);
    }

    const payload = { enabled: true, items };
    cache = { at: Date.now(), payload };
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ enabled: false, items: [], error: String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});