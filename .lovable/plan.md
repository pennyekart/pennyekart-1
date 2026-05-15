# Fix Panchayath / Ward filters on "Absent Details"

The "Absent Details" view doesn't exist yet on `/customer/profile?tab=profile` — only the agent's own `TodaysWorkSection` is rendered, and it has no panchayath/ward filter. So nothing can drive the filter today. Plan: build the Absent Details panel inside `TodaysWorkSection` and wire the filters end-to-end.

## What you'll see in the UI

Inside `TodaysWorkSection` (only when the caller is an agent), add a new collapsible card titled **"Absent Details — ഹാജരാകാത്തവരുടെ വിശദാംശങ്ങൾ"** with:

- Date picker (defaults to selected date in the parent card).
- **Panchayath** Select (loaded from `locations_local_bodies`, default = caller's panchayath).
- **Ward** Select (loaded from the chosen panchayath's `ward_count`, "All wards" option).
- A list of agents in that panchayath/ward who have **no** `agent_work_logs` row for the chosen date, showing name, role, mobile (with WhatsApp/call link), and ward.
- A "Refresh" button + present/absent counters.

Filters update the list immediately; changing panchayath resets the ward to "All".

## Data flow

Extend the existing `agent-work-logs` edge function with a new GET mode:

`GET /agent-work-logs?absent=1&date=YYYY-MM-DD&panchayath=<elife_panchayath_id>&ward=<n>`

Logic:
1. Auth as today (caller must be a registered agent — reuse current lookup).
2. From e-Life, fetch `pennyekart_agents` filtered by `panchayath_id=eq.<…>` (and `ward=eq.<n>` when provided), `is_active=true`.
3. Fetch `agent_work_logs?work_date=eq.<date>&agent_id=in.(<ids>)` and build a present-set.
4. Return `{ totalAgents, present: [...], absent: [{id,name,role,mobile,ward,panchayath_id}] }`.

If e-Life `pennyekart_agents` doesn't expose `ward`/`panchayath_id` we'll fall back to whatever fields exist (the chat edge function already references `agent.panchayath_id`, so panchayath is available; ward filter will be skipped gracefully if absent and the UI will hide the Ward Select in that case).

Mapping panchayath: the local Supabase `locations_local_bodies.id` is **not** the same as e-Life's `panchayath_id`. To make the UI Select usable we'll fetch the panchayath list from e-Life via a small extension to the edge function:

`GET /agent-work-logs?panchayaths=1` → returns `[{ id, name, ward_count }]` from e-Life `panchayaths` table. The Select then sends e-Life IDs straight back to the absent endpoint, so filters actually match.

## Files to change

- `supabase/functions/agent-work-logs/index.ts` — add `panchayaths=1` and `absent=1` GET branches; keep existing behaviour intact.
- `src/components/customer/TodaysWorkSection.tsx` — add the new "Absent Details" card with Panchayath + Ward Selects, fetch logic, list rendering, and Malayalam title. Default panchayath = caller agent's `panchayath_id` returned from `/agent`.
- `src/components/customer/TodaysWorkSection.tsx` (small) — extend the agent payload returned from the existing GET to include `panchayath_id` and `ward` so we can preselect filters.

## Acceptance

- Selecting a different panchayath or ward immediately re-queries and shows a different absent list.
- "All wards" returns every ward in the panchayath.
- Empty state ("Everyone is present 🎉") when the absent array is empty.
- Caller still sees their own work card unchanged above the new section.

## Out of scope

- Editing other agents' logs.
- Persisting filter selection across reloads.
- Adding panchayath/ward filters anywhere outside `TodaysWorkSection`.
