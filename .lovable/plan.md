## Problem

The banner doesn't appear because the edge function is trying to query a `products` table with an `image_url` column on the Penny Carbs Supabase project — that table doesn't exist there.

The actual Penny Carbs schema is:
- Table: `food_items` (columns: `name`, `price`, `is_available`, …)
- Images live in a separate table `food_item_images` joined by `food_item_id`, with `image_url` and `is_primary`

I verified this works with the saved publishable key:
```
GET /rest/v1/food_items?select=name,price,food_item_images(image_url,is_primary)&is_available=eq.true&limit=8
```
returns 8 items with names, prices, and image URLs.

## Plan

### 1. Update edge function `supabase/functions/pennycarbs-items/index.ts`

When `pennycarbs_supabase_url` + `pennycarbs_api_key` are set, build a smarter REST query:

- New optional settings (with sensible defaults so user doesn't have to touch them):
  - `pennycarbs_images_table` — default `food_item_images`
  - `pennycarbs_images_fk` — default `food_item_id`
  - `pennycarbs_image_col` — default `image_url`
  - `pennycarbs_available_col` — default `is_available` (filter `eq.true`, skipped if blank)
- Default `pennycarbs_table` → `food_items`
- Default `pennycarbs_name_col` → `name`, `pennycarbs_price_col` → `price`
- Build embedded select: `select={name},{price},{images_table}({image_col},is_primary)` and apply availability filter
- Normalize each row: pick the `is_primary` image, else the first one. Items missing both name and image are dropped.
- Keep the old single-table mode as a fallback when `pennycarbs_images_table` is explicitly set to empty string.
- Always return `{ enabled, items, error? }`.

### 2. Update admin UI `src/pages/admin/AppSettingsPage.tsx`

In the Penny Carbs card:
- Change defaults shown in the inputs to `food_items` / `name` / `price`.
- Add three new inputs (collapsed under an "Advanced" section):
  - Images table (default `food_item_images`)
  - Images foreign-key column (default `food_item_id`)
  - Availability column (default `is_available`, blank = no filter)
- Save them via the existing `upsertSetting` helper.

### 3. Backfill correct settings now

Insert/update the new keys in `app_settings` so the banner works immediately:
- `pennycarbs_table` = `food_items`
- `pennycarbs_images_table` = `food_item_images`
- `pennycarbs_images_fk` = `food_item_id`
- `pennycarbs_image_col` = `image_url`
- `pennycarbs_available_col` = `is_available`

### 4. Verify

After deploy, call the edge function via curl. Expect `enabled: true` and 8 items with valid `image_url`s. Then the homepage banner under the navbar should render and auto-rotate.

## Notes

- No frontend banner component changes needed.
- No DB schema changes on this project (only `app_settings` row updates, which is an existing table).
