## Department Work Logs — Plan

Add a read-only "Department Work Logs" feed below the existing personal "Today's Work" editor on `/customer/profile`. Every Pennyekart agent sees all agents' logs (for the selected date) grouped by department. The edge function auto-detects which column on `pennyekart_agents` represents the department.

### 1. Edge function — extend `agent-work-logs`

Add a new GET mode triggered by query param `scope=department`:

- Auth + agent lookup unchanged (mobile → `pennyekart_agents`).
- After confirming caller is an agent, auto-detect the "department" column once per request:
  1. Fetch one row from `pennyekart_agents?limit=1` and inspect keys.
  2. Pick the first key matching this priority list (case-insensitive):
     `department_name`, `department`, `dept`, `department_id`, `team`, `unit`, `branch`, `role`.
  3. Cache the detected key in module scope so subsequent calls skip detection.
- Fetch all agents: `GET pennyekart_agents?select=id,name,role,mobile,<deptCol>` (paginate with `Range` if >1000).
- Fetch logs for the date: `GET agent_work_logs?work_date=eq.<date>&order=created_at.desc` (also paginate if needed).
- Group logs by `agent.<deptCol>` (fallback bucket: `"Unassigned"`), embedding agent name/role on each log.
- Return: `{ department_column, departments: [{ name, agent_count, log_count, logs: [{id, agent_id, agent_name, agent_role, work_date, work_details, created_at, updated_at}] }] }`.

Existing personal endpoints (no `scope`) remain unchanged.

### 2. Frontend — `src/components/customer/TodaysWorkSection.tsx`

Below the existing logs list, render a new collapsible section "Department Work Logs — വകുപ്പുകളുടെ വർക്ക് ലോഗ്":

- Fetch via `callFn({ method: "GET", query: { date: ymd(date), scope: "department" } })` whenever `agent` or `date` changes.
- Render an Accordion (shadcn `accordion.tsx`) with one item per department. Header shows department name + badge with `agent_count` and `log_count`.
- Each accordion body lists the logs sorted by `created_at desc`, each card showing: agent name + role badge, time, and `work_details` (whitespace-pre-wrap). Read-only — no edit/delete buttons.
- Empty state per department: "No logs for this date." Top-level empty state if no departments returned.
- Light loading spinner while fetching; errors → toast.
- Section is hidden if `notAgent` (same gating as the rest of the component).

### 3. Visual / UX details

- Section uses the existing `Card` patterns and earth-tone palette (no new colors).
- Heading uses Playfair Display (inherited via `CardTitle`); body uses DM Sans.
- Each log card matches the existing `rounded-lg border bg-muted/20 p-3` style.
- Department headers ordered alphabetically, except `"Unassigned"` last.

### 4. Verification

After deploy:
- `curl agent-work-logs?scope=department&date=YYYY-MM-DD` returns the grouped payload.
- Profile page shows the new accordion under the personal log list.
- Logs in different departments appear in their respective groups.

### Files

- edit `supabase/functions/agent-work-logs/index.ts` — add `scope=department` branch + column auto-detect + caching.
- edit `src/components/customer/TodaysWorkSection.tsx` — fetch + render accordion grouped feed.

No DB migrations or new secrets needed.
