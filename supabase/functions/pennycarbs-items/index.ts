// Public edge function: fetch featured items from external Penny Carbs Supabase
// and return a normalized list for the homepage banner strip.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getSetting(key: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.${key}&select=value`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.value ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const [enabled, baseUrl, apiKey, table, imagesTable, imagesFk, nameCol, priceCol, imageCol, availableCol, limitStr] =
      await Promise.all([
        getSetting("pennycarbs_banner_enabled"),
        getSetting("pennycarbs_supabase_url"),
        getSetting("pennycarbs_api_key"),
        getSetting("pennycarbs_table"),
        getSetting("pennycarbs_images_table"),
        getSetting("pennycarbs_images_fk"),
        getSetting("pennycarbs_name_col"),
        getSetting("pennycarbs_price_col"),
        getSetting("pennycarbs_image_col"),
        getSetting("pennycarbs_available_col"),
        getSetting("pennycarbs_limit"),
      ]);

    if (enabled !== "true" || !baseUrl || !apiKey || !table) {
      return new Response(JSON.stringify({ items: [], reason: "disabled_or_unconfigured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = Math.max(1, Math.min(24, parseInt(limitStr || "8", 10) || 8));
    const name = nameCol || "name";
    const price = priceCol || "price";
    const avail = availableCol || "is_available";
    const imgCol = imageCol || "image_url";

    // Try to fetch with images join; fall back gracefully if relationship not defined.
    const select = imagesTable
      ? `id,${name},${price},images:${imagesTable}(${imgCol})`
      : `id,${name},${price},${imgCol}`;

    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/${table}?select=${encodeURIComponent(select)}&${avail}=eq.true&limit=${limit}`;
    const res = await fetch(url, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ items: [], error: txt }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = await res.json();
    const items = (Array.isArray(rows) ? rows : [])
      .map((r: any) => {
        const img = Array.isArray(r.images) && r.images.length ? r.images[0]?.[imgCol] : r[imgCol];
        return {
          id: String(r.id),
          name: r[name],
          price: Number(r[price] ?? 0),
          image_url: img || null,
        };
      })
      .filter((i: any) => i.image_url && i.name);

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ items: [], error: String(e?.message || e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
