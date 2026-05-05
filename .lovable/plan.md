## Why the banner is empty

`pennycarbs_items_api_url` in `app_settings` is blank. The edge function bails out and returns `{enabled:false, items:[]}` whenever the URL is missing, so `CarbsBannerStrip` renders `null`.

The value you pasted as "API key" is a **Supabase publishable key** (`sb_publishable_…`), which means Penny Carbs is a separate Supabase project. We need three pieces, not one URL, to query it.

## Plan

### 1. Admin settings — restructure the Penny Carbs card (`src/pages/admin/AppSettingsPage.tsx`)

Replace the single "Items API URL" field with fields tailored to a Supabase source:

- **Penny Carbs Supabase URL** → `pennycarbs_supabase_url` (e.g. `https://xxxx.supabase.co`)
- **Penny Carbs publishable key** → `pennycarbs_api_key` (already stored)
- **Items table name** → `pennycarbs_table` (default `products`)
- **Image column** → `pennycarbs_image_col` (default `image_url`)
- **Name column** → `pennycarbs_name_col` (default `name`)
- **Price column** → `pennycarbs_price_col` (default `price`, optional)
- **Max items** → `pennycarbs_limit` (default `8`)
- **Enabled toggle** → `pennycarbs_banner_enabled` (already stored)

Keep the legacy `pennycarbs_items_api_url` field as an optional override (if filled, it wins — same behavior as today).

### 2. Edge function (`supabase/functions/pennycarbs-items/index.ts`)

Update logic:
1. Read all `pennycarbs_*` settings.
2. If `pennycarbs_items_api_url` is set → fetch it as before (back-compat).
3. Else if `pennycarbs_supabase_url` + `pennycarbs_api_key` are set → call:
   ```
   GET {supabase_url}/rest/v1/{table}?select={name},{image},{price}&limit={n}
   Headers: apikey: {key}, Authorization: Bearer {key}
   ```
4. Normalize rows using configured column names → `{ name, image_url, price? }[]`.
5. Filter out rows missing name/image. Cache 5 min as today.
6. On any error, return `{enabled:true, items:[]}` plus an `error` string for debugging.

### 3. Banner component — no changes
`CarbsBannerStrip` already handles `items.length === 0` (renders nothing). Once the function returns items, it will appear.

### 4. Verification steps after build
- Open `/admin/settings`, fill in Penny Carbs Supabase URL + publishable key + table/column names.
- Hit "Save".
- Reload `/`. The banner strip should appear under the navbar with auto-rotating items.
- If still empty, call the edge function directly to inspect the `error` field.

## Open question

I need the **Penny Carbs Supabase project URL** and **the table name** that holds the food items (and which columns store the image, name, price). If you don't know them off-hand, you can paste the URL and I can introspect via REST to suggest the table/columns.

## Files touched

- `src/pages/admin/AppSettingsPage.tsx` — expanded Penny Carbs card
- `supabase/functions/pennycarbs-items/index.ts` — Supabase REST fallback + per-column normalization
