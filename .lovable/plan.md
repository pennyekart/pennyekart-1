## Problem

The Addresses tab on `/customer/profile?tab=addresses` is just a static placeholder. There is no working UI for:

- Setting / editing the delivery address
- Searching for a place by name
- Using "current GPS location"

The "Add Address" button has no `onClick` handler, so it does nothing — that matches the session replay (3 clicks, no effect).

The Cart page already has a working pattern for the same data (saves to `profiles.business_address` + `profiles.latitude` / `profiles.longitude`). We will reuse that storage so the address set on the profile flows through to checkout automatically.

## What to build

Replace the placeholder card in `src/pages/customer/Profile.tsx` (the `activeSection === "addresses"` block) with a real Address Management card.

### 1. Saved Address card
- Loads `business_address`, `latitude`, `longitude` from `profiles` for the logged-in user on mount.
- Shows the saved address text and, if present, a small GPS chip with `lat, lng` (5 decimals) plus a Google Maps link.
- Buttons: `Edit Address`, `Remove Address`.
- If no address yet: shows empty state with a single `Add Delivery Address` button.

### 2. Edit Address dialog
Opens from "Add" / "Edit". Contains three things, in this order:

a. Search a place (text input)
- Debounced 400 ms.
- Calls OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=in&q=...`) with header `Accept-Language: en` and a custom `User-Agent` is not required from browsers — Nominatim works directly from the client and needs no API key.
- Renders results list. Clicking a result fills the address textarea with `display_name` and stores `lat` / `lon` from the result.
- Shows "No results" / "Searching..." states. Errors show a toast and let the user type manually.

b. Use my current GPS location (button)
- Uses `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true`, `timeout: 10000`.
- On success: stores lat/lng locally, then reverse-geocodes via Nominatim (`/reverse?format=json&lat=...&lon=...`) and pre-fills the address textarea with the returned `display_name`. User can still edit it.
- On error / denied / unsupported: clear toast explaining what to do (e.g. "Enable location access in your browser settings"). Never silently fail.
- Disabled while in-flight; shows "Getting location..." label.

c. Address textarea
- Multi-line, full address text. Required to save.
- Hint: "House no, Street, Landmark, Pincode".

Footer: `Cancel` / `Save Address` (disabled until address is non-empty).

### 3. Save behavior
- Single Supabase update on `profiles` where `user_id = auth user.id`:
  - `business_address = <textarea value, trimmed>`
  - `latitude = <selected/gps lat or null>`
  - `longitude = <selected/gps lng or null>`
- Toast success, close dialog, refresh card.
- This is the same row Cart already reads, so the cart's "Delivery Address" + "GPS saved" will reflect it immediately.

### 4. Remove Address
- Confirms via simple `confirm()` (or AlertDialog if we want to stay consistent with shadcn — use AlertDialog).
- Sets `business_address`, `latitude`, `longitude` to `null` on the profile.

## UX notes
- Match existing earth-tone styling (Card, Button, Dialog, Textarea, Input from shadcn).
- Always include `DialogDescription` to silence the existing a11y warning seen in console logs.
- Mobile: full-width buttons, dialog `sm:max-w-md`.

## Technical details

Files to change:
- `src/pages/customer/Profile.tsx` — replace the placeholder block.

New file:
- `src/components/customer/AddressManager.tsx` — encapsulates the saved-address card + edit dialog + search + GPS.

State inside `AddressManager`:
```text
loading, savedAddress, savedLat, savedLng
dialogOpen, editAddress, editLat, editLng
searchQuery, searching, results
gpsLoading, removeOpen
```

Data layer:
- Read: `supabase.from('profiles').select('business_address, latitude, longitude').eq('user_id', user.id).maybeSingle()`
- Update: `.update({ business_address, latitude, longitude }).eq('user_id', user.id)`

Geocoding (no key, no backend needed):
- Search: `GET https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=in&q=<encoded>`
- Reverse: `GET https://nominatim.openstreetmap.org/reverse?format=json&lat=<lat>&lon=<lng>`
- Debounce search via `setTimeout` cleared in effect; abort the previous fetch with `AbortController`.

No DB migration is required — `profiles.business_address`, `latitude`, `longitude` already exist and are already used by Cart.

No new secrets, no edge function, no backend work.

## Out of scope
- Multiple saved addresses (Home / Work). Current data model holds one delivery address per profile; matches Cart. We can add a separate `customer_addresses` table later if the user wants multiple.
