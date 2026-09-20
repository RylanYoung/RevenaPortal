// Shared shapes, kept in step with supabase/schema.sql by hand.
// If you change a CHECK constraint there, change the union here too.

export const SERVICE_TYPES = ["residential", "commercial", "both"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

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
export const FLAG_REASONS = [
  "Not in service area",
  "Fake/spam",
  "Uncontactable",
  "Already a customer",
  "Other",
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

/** The client's own sales pipeline stage. Never affects pack counts. */
export const OUTCOMES = [
  "contacted",
  "quoted",
  "won",
  "lost",
  "no_response",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

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
  outcome: Outcome | null;
  crm_notes: string | null;
  follow_up_date: string | null;
  ghl_contact_id: string | null;
  ghl_tags: string[];
  raw_payload: Record<string, unknown>;
  received_at: string;
  created_at: string;
  updated_at: string;
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

export const OUTCOME_LABELS: Record<Outcome, string> = {
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  no_response: "No response",
};
