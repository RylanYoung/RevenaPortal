// Shared shapes, kept in step with supabase/schema.sql by hand.
// If you change a CHECK constraint there, change the union here too.

/**
 * A client is residential or commercial, not both.
 *
 * "both" stays in the union because a client was set to it before this rule
 * existed and removing the value would make that row illegal. It is no longer
 * offered anywhere — see SERVICE_TYPE_CHOICES.
 */
export const SERVICE_TYPES = ["residential", "commercial", "both"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** What a client may actually be set to. */
export const SERVICE_TYPE_CHOICES = ["residential", "commercial"] as const;

export const CLIENT_STATUSES = ["active", "paused", "churned"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const PACK_STATUSES = ["active", "completed", "cancelled"] as const;
export type PackStatus = (typeof PACK_STATUSES)[number];

/**
 * Delivery status — admin-controlled only.
 * A lead counts against the pack unless it is `replaced`.
 */
export const LEAD_STATUSES = [
  "delivered",
  "replacement_requested",
  "replaced",
  "request_declined",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** The standardised reasons a client can give when flagging a lead. */
/**
 * What a client can report a lead for.
 *
 * These describe a lead that was never deliverable. "Uncontactable" used to be
 * here and invited complaints like "called four times over three days" — which
 * isn't grounds for a replacement, it's just a lead that hasn't answered yet.
 */
export const FLAG_REASONS = [
  "Not in service area",
  "Phone number doesn't work",
  "Fake or spam details",
  "Already a customer",
  "Other",
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

/**
 * The client's own sales pipeline. Never affects pack counts.
 *
 * Ordered as the sale actually runs, so the stage row reads left to right the
 * way the job progresses. The same stages serve residential and commercial —
 * a bigger commercial deal takes longer through them, not a different path.
 */
export const PIPELINE_STAGES = [
  "new",
  "interested",
  "site_visit_booked",
  "site_visit_attended",
  "closed",
  "not_interested",
  "no_show",
  "lost",
] as const;
export type Stage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New lead",
  interested: "Interested",
  site_visit_booked: "Site visit booked",
  site_visit_attended: "Site visit attended",
  closed: "Closed",
  not_interested: "Not interested",
  no_show: "No show",
  lost: "Lost",
};

/** The stages that mean the job is over, one way or the other. */
export const CLOSED_STAGES: Stage[] = ["closed", "not_interested", "no_show", "lost"];

/**
 * Values from the earlier, shorter list. Still valid in the database so rows
 * carrying one stay legal, but no longer offered — a lead holding one shows
 * what it was and waits to be moved onto the new pipeline.
 */
export const LEGACY_STAGE_LABELS: Record<string, string> = {
  contacted: "Contacted",
  booked: "Booked",
  quoted: "Quoted",
  won: "Won",
  no_response: "No response",
};

export const LEAD_TYPES = ["residential", "commercial"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export type Client = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  service_type: ServiceType;
  region: string | null;
  postcodes: string[];
  status: ClientStatus;
  ghl_tag_reference: string | null;
  notes: string | null;
  onboarding: Record<string, unknown> | null;
  onboarding_completed_at: string | null;
  /** When false, incoming leads arrive excluded and must be accepted. */
  auto_count_leads: boolean;
  created_at: string;
  updated_at: string;
};

export type Pack = {
  id: string;
  client_id: string;
  size: number;
  price: number;
  started_at: string;
  ended_at: string | null;
  status: PackStatus;
  notes: string | null;
  created_at: string;
};

/** The `pack_usage` view. */
export type PackUsage = {
  pack_id: string;
  client_id: string;
  size: number;
  price: number;
  started_at: string;
  ended_at: string | null;
  status: PackStatus;
  adjustment: number;
  leads_delivered: number;
  leads_used: number;
  leads_remaining: number;
  leads_replaced: number;
  flags_pending: number;
};

export type Lead = {
  id: string;
  client_id: string | null;
  pack_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Trading name, for commercial leads. */
  business_name: string | null;
  address: string | null;
  postcode: string | null;
  lead_type: LeadType | null;
  source: string | null;
  status: LeadStatus;
  flag_reason: FlagReason | null;
  flag_note: string | null;
  flagged_at: string | null;
  flagged_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  /** Pipeline stage. Named  in the database since before the pipeline existed. */
  outcome: Stage | null;
  crm_notes: string | null;
  follow_up_date: string | null;
  ghl_contact_id: string | null;
  ghl_tags: string[];
  raw_payload: Record<string, unknown>;
  received_at: string;
  created_at: string;
  updated_at: string;
  /** Set by an admin to take a lead off the count without replacing it. */
  excluded_from_pack: boolean;
  counts_against_pack: boolean;
};

export type LeadEvent = {
  id: string;
  lead_id: string;
  event_type: string;
  old_value: string | null;
  new_value: string | null;
  actor: string | null;
  note: string | null;
  created_at: string;
};

/** Human-readable labels for the delivery statuses. */
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  delivered: "Delivered",
  replacement_requested: "Replacement requested",
  replaced: "Replaced",
  request_declined: "Request declined",
};

