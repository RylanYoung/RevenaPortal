# Revena Portal — build roadmap

Lead delivery + quality tracking with client logins. GHL handles capture,
qualification and tagging; this system is everything downstream of that.

## The rule that shapes the whole system

**A client can never change what they owe.** Clients *flag* a lead they think
was bad — a request, with a reason and a note. Only Rylan resolves it. A lead
stops counting against a pack only when a replacement is **approved**.

> **If you already ran `schema.sql` before Phase 2:** re-run it. It's idempotent,
> and it now contains the `handle_lead_flag` trigger that the client-side flag
> button depends on. Without it, flagging saves the reason but the lead never
> reaches your queue.

In the schema this is enforced, not just conventional:

- `leads.counts_against_pack` is a **generated column** (`status <> 'replaced'`),
  so pack usage can't drift from lead status.
- A **column-level GRANT** limits what `authenticated` may write on `leads` to
  the CRM fields plus the three flag fields. RLS alone can't restrict columns,
  so the grant is what actually stops a client writing their own `status`.

---

## Phase 1 — foundation, intake, admin ✅ DONE

- [x] Next.js 16 + Tailwind v4 scaffold, Sora + the revenamedia.com palette
- [x] Supabase schema: `clients`, `packs`, `leads`, `lead_events`, `portal_users`
- [x] `pack_usage` view (used / remaining / replaced / flags pending)
- [x] RLS policies + column grants for client logins (ready before the UI exists)
- [x] `POST /api/webhooks/ghl` — one URL for every automation
      - secret via `?key=`, `x-webhook-secret`, or bearer; **fails closed**
      - tolerant field parsing (`contact_id`/`contactId`, tags as array *or* CSV)
      - routes by tag; no match or an ambiguous match → unassigned, never dropped
      - de-dupes on `ghl_contact_id`
      - always stores the full raw payload
- [x] Admin: password gate (`proxy.ts`), overview, clients + create, client
      detail with pack history and lifetime revenue, all-leads with filters,
      unassigned queue with one-click assign, replacement-request queue
- [x] `/admin/setup` — copyable intake URL + curl test command

## Phase 2 — client portal ✅ DONE

- [x] Supabase Auth magic-link login at `/portal/login` (`shouldCreateUser: false`,
      so portal access is only ever granted by invite — never self-serve)
- [x] `/portal/auth/callback` exchanges the code for a session
- [x] Session refresh + route guarding in `proxy.ts`
- [x] Invite flow on the client detail page: creates the auth user and the
      `portal_users` row linking them to a `client_id`
- [x] Client dashboard: big pack counter, animated progress bar, quick stats,
      latest leads
- [x] Client leads page: filter by status and by their own progress; tap-to-call
- [x] **Flag for replacement**: reason dropdown + note. Promoted to
      `replacement_requested` by a **database trigger**, because the column grant
      (correctly) refuses to let a client write `status` themselves
- [x] Trigger also freezes a flag once raised — a client can't withdraw a request
      mid-review or re-flag something already ruled on
- [x] Optional CRM section, collapsed behind "Track this lead"
- [x] Motion: staggered entrances, hover lifts, reduced-motion respected

### Still to verify (needs a live Supabase)
- [ ] Log in as one client, confirm another client's leads are unreachable
- [ ] Confirm a crafted write to `status` / `pack_id` is rejected by the grant
- [ ] Confirm the flag trigger fires and lands the lead in the admin queue

## Phase 3 — reporting ✅ DONE

- [x] `/portal/reporting`: 12-month stacked bar chart, inline SVG, no chart library
      - **emphasis** form, not two categorical series: brand blue = counted,
        de-emphasis gray = replaced. Validated ΔE 21.6 protan / 29.6 normal
      - hover tooltip, legend, selective direct labels, table view, empty months kept
- [x] Close rate from `outcome`, measured against TRACKED leads (not all leads —
      dividing by everything reports near-zero for light users and reads as failure)
- [x] CSV export both sides: `/api/portal/export` (RLS-scoped, no client param to
      tamper with) and `/api/admin/export` (respects the page's current filters)
- [x] `/api/admin/*` added to the proxy matcher — it reads through the service-role
      key and was otherwise ungated

## Phase 4 — MCP server ("Revena Admin") ✅ DONE

Remote MCP at `/api/mcp`. JSON-RPC 2.0 over HTTP, stateless, so it runs on Vercel
serverless with no session store. Auth is a single admin-scoped bearer token
(`MCP_API_KEY`), NOT client RLS — anything holding it reaches every client's data.

- [x] `create_client(...)` — optional opening pack and optional portal invite
- [x] `get_client(business_name | client_id)` — refuses ambiguous name matches
      rather than guessing, since guessing could bill the wrong business
- [x] `list_clients(status?)`
- [x] `update_client_pack(...)` — closes the current pack, opens the new one
- [x] `get_dispute_queue()`
- [x] Verified locally: auth rejects unauthenticated and wrong-key requests,
      `initialize` / `tools/list` / `tools/call` / unknown-method all correct

Connect in Claude: Settings → Connectors → Add custom connector → the URL shown
on `/admin/setup`, with the bearer token.

## Phase 5 — go live (ALL THAT'S LEFT)

Every feature is built. What remains is connecting it to real infrastructure and
verifying the things that can only be verified against a live database.

- [ ] Create a Supabase project (**its own** — see the warning above)
- [ ] Run `supabase/schema.sql`
- [ ] Fill `.env.local`, then the same keys in Vercel
- [ ] Deploy to Vercel, point the site's `client-portal.html` at `/portal/login`
- [ ] Set the GHL webhook URL from `/admin/setup` in every qualification automation
- [ ] **Verify RLS**: log in as one client, confirm another's leads are unreachable
- [ ] **Verify the grant**: confirm a crafted write to `status`/`pack_id` is rejected
- [ ] **Verify the trigger**: flag a lead, confirm it lands in `/admin/requests`
- [ ] Connect the MCP server in Claude and run `list_clients`

## Deliberately out of scope

CAC / LTV / ad spend / revenue analytics. That already exists in
`../revena-dashboard` and stays there — this app is delivery and quality only.

---

## Decisions already made (don't re-litigate)

| Decision | Choice |
|---|---|
| Theme | Light, matching revenamedia.com (not the dark navy in the original brief) |
| Client login | Supabase Auth magic link |
| Client declines? | **No.** Clients flag; Rylan resolves |
| Pack counting | Accepted-only — a lead counts unless a replacement is approved |
| Notifications | None. Leads just appear |
| Lead routing | GHL tag → `clients.ghl_tag_reference`, else unassigned queue |

## Open questions

- Packs: should an unused balance roll over into the next pack, or reset? Right
  now a new pack simply closes the old one and counting restarts.
- Re-delivery: the same GHL contact is de-duped forever. If a contact should be
  able to become a lead again months later, that key needs a time window.
