## Goal

1. Remove the "Food Delivery" (Penny Carbs) button from the top platform selector.
2. Add a wide horizontal "Penny Carbs — Food Delivery" banner directly below the navbar on the customer homepage.
3. The banner shows food items (image + name) fetched from Penny Carbs and auto-rotates them.
4. Admin can configure a Penny Carbs items API endpoint + API key on `/admin/settings`.

---

## 1. Admin: Penny Carbs API config (`/admin/settings`)

Add a new card to `src/pages/admin/AppSettingsPage.tsx` titled **"Penny Carbs — Food Delivery API"** with three fields, all stored in `app_settings`:

| Key | Purpose |
|---|---|
| `pennycarbs_items_api_url` | Full URL that returns a JSON list of items (e.g. `https://penny-carbs.vercel.app/api/featured-items`) |
| `pennycarbs_api_key` | Optional bearer/api key sent as `Authorization: Bearer …` if present |
| `pennycarbs_banner_enabled` | `'true'` / `'false'` toggle to show/hide the homepage banner |

(`pennycarbs_url` — the existing iframe target — stays as-is and remains the link target when a user taps the banner.)

The expected API response shape (documented in the card's helper text so the Penny Carbs side can match it):

```json
[
  { "name": "Chicken Biriyani", "image_url": "https://…/biriyani.jpg", "price": 180 },
  { "name": "Beef Fry",          "image_url": "https://…/beef.jpg",     "price": 140 }
]
```

Only `name` and `image_url` are required; `price` is optional.

---

## 2. Edge function: `pennycarbs-items`

Create `supabase/functions/pennycarbs-items/index.ts` (public, `verify_jwt = false`) that:

- Reads the three `app_settings` rows above using the service role.
- If `pennycarbs_banner_enabled !== 'true'` or URL missing → returns `{ enabled: false, items: [] }`.
- Fetches `pennycarbs_items_api_url`, attaching `Authorization: Bearer <key>` if a key is set.
- Normalizes the response to `{ name, image_url, price? }[]`, drops items missing `image_url`.
- Caches the response in-memory for ~5 minutes via a simple module-level timestamp to keep the homepage fast.
- Returns `{ enabled: true, items: [...] }` with proper CORS headers.

Why an edge function: avoids CORS issues calling penny-carbs.vercel.app from the browser, lets us safely use an API key, and centralizes normalization.

---

## 3. Remove the Food Delivery button

In `src/components/PlatformSelector.tsx`, delete the middle `<button>` for `pennycarbs`. Keep Pennyekart and Services. No other call sites need changes — `Index.tsx` already handles only those two platforms in its switching logic.

---

## 4. New component: `CarbsBannerStrip`

Create `src/components/CarbsBannerStrip.tsx`:

- Uses `react-query` to call the `pennycarbs-items` edge function (`staleTime: 5 min`).
- If `enabled === false` or `items.length === 0` → returns `null` (per the project's "hide empty UI components" rule).
- Renders a single full-width horizontal card under the navbar:

```text
┌───────────────────────────────────────────────────────────────┐
│ [carbs-logo]  Penny Carbs — Food Delivery        Order now → │
│ ┌──────┐  Chicken Biriyani                              ₹180  │
│ │ img  │  (image + name fade/slide every 3 s)                 │
│ └──────┘                                                       │
└───────────────────────────────────────────────────────────────┘
```

- Auto-rotates the active item every 3 seconds with a fade transition (`useEffect` + `setInterval`, cleared on unmount).
- Shows small dot indicators below for the current item.
- Whole card is clickable → `navigate('/pennycarbs')` (opens existing in-app iframe page, per your answer).
- Styling: earth-tone palette (amber accent border, dark brown text), Playfair heading, DM Sans body, rounded-xl, soft shadow, full-bleed inside `.container`. Mobile: image left, text right, compact height (~80–96 px). Desktop: same row, larger image (~140 px tall).

---

## 5. Wire it into the homepage

In `src/pages/Index.tsx`, render `<CarbsBannerStrip />` directly **after** the `<Navbar />` (and after `<PlatformSelector />` if that block stays above the fold) and **before** `<BannerCarousel />`. No other layout changes.

Lite mode (`src/pages/LiteIndex.tsx`) is left untouched to keep it lightweight.

---

## Files touched

| File | Change |
|---|---|
| `src/components/PlatformSelector.tsx` | Remove Food Delivery button |
| `src/pages/admin/AppSettingsPage.tsx` | Add Penny Carbs API card (URL, key, enabled toggle) |
| `supabase/functions/pennycarbs-items/index.ts` | **New** edge function |
| `src/components/CarbsBannerStrip.tsx` | **New** auto-rotating banner |
| `src/pages/Index.tsx` | Render banner under navbar |

No DB migrations needed (uses existing `app_settings` table). No new secrets needed (the Penny Carbs key is admin-managed via the settings UI).

---

## Open assumption

The banner pulls items from a JSON endpoint that **the Penny Carbs site needs to expose**. If that endpoint doesn't exist yet, the banner will simply stay hidden until you (a) add the endpoint there and (b) paste its URL into `/admin/settings`. If you'd rather I scrape the live site (no endpoint required) using Firecrawl, say so and I'll swap the edge function implementation — everything else stays the same.
