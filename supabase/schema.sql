-- ============================================================
-- Revena Portal — schema
-- Run once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Safe to re-run: every statement is idempotent.
--
-- Core rule this schema enforces: a client can never change what they owe.
-- Clients may FLAG a lead as bad (a request, with a note). Only an admin
-- resolves that flag, and only a resolution of 'replaced' stops the lead
-- counting against the pack. `counts_against_pack` is a generated column so
-- pack usage can never drift out of sync with lead status.
-- ============================================================

-- ---------- clients ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text,
  phone text,
  service_type text not null default 'both'
    check (service_type in ('residential', 'commercial', 'both')),
  region text,                                  -- free text, e.g. "Brisbane + Gold Coast"
  postcodes text[] not null default '{}',       -- optional finer coverage list
  status text not null default 'active'
    check (status in ('active', 'paused', 'churned')),
  -- The GHL tag that routes an incoming lead to this client. Matched
  -- case-insensitively by the webhook against the payload's tag list.
  ghl_tag_reference text,
  notes text,                                   -- admin-only internal notes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness: two clients must never claim the same GHL tag,
-- otherwise lead routing would be ambiguous.
create unique index if not exists clients_ghl_tag_unique
  on clients (lower(ghl_tag_reference)) where ghl_tag_reference is not null;
create index if not exists clients_status_idx on clients (status);

-- ---------- packs ----------
-- One row per pack of leads the client has bought. Keeping every pack as its
-- own row (rather than columns on `clients`) is what gives you purchase
-- history and revenue per client for free.
create table if not exists packs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  size integer not null check (size > 0),        -- leads purchased
  price numeric(10, 2) not null default 0,       -- what the client paid for this pack
  started_at date not null default current_date,
  ended_at date,                                 -- set when the pack is closed out
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  notes text,
  -- Manual correction to the usage count, added to the leads actually
  -- delivered through the system. Covers leads sent before the portal
  -- existed, delivered by another route, or a count that needs fixing by
  -- hand. Kept separate from the lead count rather than overwriting it, so
  -- the real delivered figure is never lost and the adjustment is visible
  -- as an adjustment.
  adjustment integer not null default 0,
  created_at timestamptz not null default now()
);

alter table packs add column if not exists adjustment integer not null default 0;

-- A client can only have one pack taking deliveries at a time — this is what
-- makes "which pack does an incoming lead belong to?" a question with one answer.
create unique index if not exists packs_one_active_per_client
  on packs (client_id) where status = 'active';
create index if not exists packs_client_idx on packs (client_id);

-- ---------- leads ----------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,  -- null = unassigned queue
  pack_id uuid references packs(id) on delete set null,      -- pack at time of delivery

  -- Lead detail, parsed out of the GHL payload for querying/filtering.
  name text,
  phone text,
  email text,
  postcode text,
  lead_type text check (lead_type in ('residential', 'commercial')),
  source text,                                   -- campaign / ad name from GHL

  -- DELIVERY STATUS — admin-controlled only. Clients never write this.
  status text not null default 'delivered'
    check (status in ('delivered', 'replacement_requested', 'replaced', 'request_declined')),

  -- Client's replacement request (a request, not a decision).
  flag_reason text check (flag_reason in (
    'Not in service area', 'Fake/spam', 'Uncontactable', 'Already a customer', 'Other')),
  flag_note text,
  flagged_at timestamptz,
  flagged_by uuid,                               -- portal_users.id who raised it

  -- Admin resolution of that request.
  resolved_at timestamptz,
  resolution_note text,

  -- CLIENT CRM LAYER — entirely the client's own workspace.
  -- Deliberately separate from `status`: nothing here ever affects pack counts.
  outcome text check (outcome in ('contacted', 'booked', 'quoted', 'won', 'lost', 'no_response')),
  crm_notes text,
  follow_up_date date,

  -- Intake / audit.
  ghl_contact_id text,                           -- de-dupe key for GHL retries
  ghl_tags text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,-- full webhook body, always kept
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The single source of truth for pack usage. A lead stops counting only
  -- once an admin has actually approved a replacement.
  counts_against_pack boolean
    generated always as (status <> 'replaced') stored
);

-- 'booked' was added once setters and the AI agent started writing outcomes
-- back in; an appointment booked is the step that matters most to a client
-- and did not fit any of the original values.
alter table leads drop constraint if exists leads_outcome_check;
alter table leads add constraint leads_outcome_check
  check (outcome in ('contacted', 'booked', 'quoted', 'won', 'lost', 'no_response'));

-- GHL retries and double-firing automations must not create duplicate leads.
create unique index if not exists leads_ghl_contact_id_unique
  on leads (ghl_contact_id) where ghl_contact_id is not null;
create index if not exists leads_client_received_idx on leads (client_id, received_at desc);
create index if not exists leads_status_idx on leads (status);
create index if not exists leads_pack_idx on leads (pack_id);
-- Powers the unassigned queue.
create index if not exists leads_unassigned_idx
  on leads (received_at desc) where client_id is null;

-- ---------- lead_events (audit trail) ----------
create table if not exists lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  event_type text not null,        -- received | assigned | reassigned | flagged | resolved | outcome_changed | notes_updated
  old_value text,
  new_value text,
  actor text,                      -- 'system' | 'admin' | a client user's email
  note text,
  created_at timestamptz not null default now()
);

create index if not exists lead_events_lead_idx on lead_events (lead_id, created_at desc);

-- ---------- portal_users ----------
-- Joins a Supabase Auth user to the client whose data they may see.
create table if not exists portal_users (
  id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  email text not null,
  role text not null default 'client_admin'
    check (role in ('client_admin', 'client_viewer')),
  created_at timestamptz not null default now()
);

create index if not exists portal_users_client_idx on portal_users (client_id);

-- ---------- onboarding ----------
-- Answers to the form a client completes on first login. Stored as JSON so
-- questions can be added or reworded later without a migration, and so old
-- answers survive a change to the question set.
alter table clients add column if not exists onboarding jsonb;
alter table clients add column if not exists onboarding_completed_at timestamptz;

-- ---------- notifications ----------
-- Messages Rylan sends to clients, shown inside the portal.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  -- null means every client. A row per recipient would mean editing a typo in
  -- an announcement touching every copy of it.
  client_id uuid references clients(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_client_idx
  on notifications (client_id, created_at desc);

-- Read state is per USER, not per client: a business with two logins should
-- not have one person's dismissal hide the message from the other.
create table if not exists notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- ============================================================
-- Pack usage view — one row per pack with live usage numbers.
-- ============================================================
-- Dropped rather than replaced: the column list changed, and CREATE OR REPLACE
-- VIEW cannot add columns.
drop view if exists pack_usage;

create view pack_usage as
select
  p.id                as pack_id,
  p.client_id,
  p.size,
  p.price,
  p.started_at,
  p.ended_at,
  p.status,
  p.adjustment,
  -- What actually arrived through the system, before any correction.
  count(l.id) filter (where l.counts_against_pack)        as leads_delivered,
  -- What the client is shown. Never negative, however the adjustment is set.
  greatest(count(l.id) filter (where l.counts_against_pack) + p.adjustment, 0)
                                                          as leads_used,
  greatest(
    p.size - (count(l.id) filter (where l.counts_against_pack) + p.adjustment), 0
  )                                                       as leads_remaining,
  count(l.id) filter (where l.status = 'replaced')         as leads_replaced,
  count(l.id) filter (where l.status = 'replacement_requested') as flags_pending
from packs p
left join leads l on l.pack_id = p.id
group by p.id;

-- CRITICAL. Without this a view runs with its OWNER's privileges, which
-- bypasses row level security on packs and leads entirely — every client
-- would read every other client's pack usage through it, and so would an
-- unauthenticated anon key. security_invoker makes the view run as whoever
-- queries it, so the policies on the underlying tables actually apply.
alter view pack_usage set (security_invoker = on);

-- ============================================================
-- Row Level Security
-- Admin access runs through the service-role key, which bypasses RLS entirely.
-- These policies exist purely to fence client logins into their own client_id.
-- ============================================================

-- Resolves the logged-in user to their client. SECURITY DEFINER so the lookup
-- itself isn't subject to the policies that call it (which would recurse).
create or replace function current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select client_id from portal_users where id = auth.uid()
$fn$;

alter table clients      enable row level security;
alter table packs        enable row level security;
alter table leads        enable row level security;
alter table lead_events  enable row level security;
alter table portal_users enable row level security;

drop policy if exists clients_select_own on clients;
create policy clients_select_own on clients
  for select to authenticated
  using (id = current_client_id());

drop policy if exists packs_select_own on packs;
create policy packs_select_own on packs
  for select to authenticated
  using (client_id = current_client_id());

drop policy if exists leads_select_own on leads;
create policy leads_select_own on leads
  for select to authenticated
  using (client_id = current_client_id());

-- Clients may update their own leads. WHICH COLUMNS they may touch is fenced
-- by the column-level GRANT below, not by this policy — RLS alone cannot
-- restrict columns, so the grant is doing the real work here.
drop policy if exists leads_update_own on leads;
create policy leads_update_own on leads
  for update to authenticated
  using (client_id = current_client_id())
  with check (client_id = current_client_id());

drop policy if exists lead_events_select_own on lead_events;
create policy lead_events_select_own on lead_events
  for select to authenticated
  using (exists (
    select 1 from leads where leads.id = lead_events.lead_id
      and leads.client_id = current_client_id()
  ));

-- A client fills in their own onboarding, so they need UPDATE on their row.
-- WHICH columns is fenced by the grant below, not by this policy.
drop policy if exists clients_update_own on clients;
create policy clients_update_own on clients
  for update to authenticated
  using (id = current_client_id())
  with check (id = current_client_id());

-- The critical exclusion here is `ghl_tag_reference`. A client who could
-- write their own routing tag could point another client's leads at
-- themselves. `status` and `notes` are withheld for the same reason the lead
-- grant withholds `status`: they are yours to set, not theirs.
revoke update on clients from authenticated;
grant update (
  onboarding, onboarding_completed_at,
  business_name, contact_name, phone, email, service_type, region, updated_at
) on clients to authenticated;

alter table notifications      enable row level security;
alter table notification_reads enable row level security;

-- A client sees messages addressed to them, plus anything sent to everyone.
drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications
  for select to authenticated
  using (client_id is null or client_id = current_client_id());

-- Read state is the one thing a client writes here, and only their own.
drop policy if exists notification_reads_select_self on notification_reads;
create policy notification_reads_select_self on notification_reads
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notification_reads_insert_self on notification_reads;
create policy notification_reads_insert_self on notification_reads
  for insert to authenticated
  with check (user_id = auth.uid());

grant select on notifications to authenticated;
grant select, insert on notification_reads to authenticated;

drop policy if exists portal_users_select_self on portal_users;
create policy portal_users_select_self on portal_users
  for select to authenticated
  using (id = auth.uid());

-- ============================================================
-- Flag handling
--
-- A client may write `flag_reason` / `flag_note` / `flagged_at` (see the grant
-- below) but NOT `status` — otherwise they could mark their own lead replaced
-- and shrink what they owe. So the promotion to 'replacement_requested' happens
-- here, in the database, where the client can't reach it.
--
-- SECURITY DEFINER because it also writes lead_events, which clients have no
-- INSERT policy on.
-- ============================================================
create or replace function handle_lead_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Raising a flag on a delivered lead: promote it into your queue.
  if NEW.flagged_at is distinct from OLD.flagged_at
     and NEW.flagged_at is not null
     and OLD.status = 'delivered' then

    NEW.status := 'replacement_requested';
    NEW.flagged_by := auth.uid();
    NEW.updated_at := now();

    insert into lead_events (lead_id, event_type, old_value, new_value, actor, note)
    values (
      NEW.id,
      'flagged',
      OLD.status,
      'replacement_requested',
      coalesce((select email from portal_users where id = auth.uid()), 'client'),
      NEW.flag_reason
    );

  -- Anything already flagged or already ruled on is frozen: a client must not
  -- be able to withdraw a request mid-review, or re-flag a lead you've decided.
  elsif OLD.status <> 'delivered'
        and (NEW.flagged_at is distinct from OLD.flagged_at
             or NEW.flag_reason is distinct from OLD.flag_reason
             or NEW.flag_note is distinct from OLD.flag_note) then

    NEW.flagged_at := OLD.flagged_at;
    NEW.flag_reason := OLD.flag_reason;
    NEW.flag_note := OLD.flag_note;
  end if;

  return NEW;
end;
$fn$;

drop trigger if exists leads_flag_trigger on leads;
create trigger leads_flag_trigger
  before update on leads
  for each row
  execute function handle_lead_flag();

-- ---------- column-level grants ----------
-- This is the guard that stops a client writing their own delivery status or
-- pack assignment by crafting a request. They get exactly the CRM fields plus
-- the three flag fields used to RAISE a replacement request — never `status`,
-- never `pack_id`, never the admin resolution fields.
revoke update on leads from authenticated;
grant update (outcome, crm_notes, follow_up_date, flag_reason, flag_note, flagged_at)
  on leads to authenticated;
