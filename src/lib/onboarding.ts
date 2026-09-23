/**
 * The onboarding form a client completes on first login.
 *
 * Defined once here and read by both the form and the admin view, so a
 * question can never be renamed in one place and shown by its old label in
 * the other.
 *
 * Answers are stored as JSON keyed by `key`. Adding or rewording a question
 * later doesn't need a migration and doesn't invalidate existing answers.
 */

export type FieldType = "text" | "tel" | "email" | "textarea" | "radio" | "checkbox";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  /** Only shown when another field holds one of these values. */
  showWhen?: { key: string; equals?: string[]; includes?: string };
  /** Part of "how you get leads", which stays editable after onboarding. */
  editable?: boolean;
};

export type Section = {
  title: string;
  fields: Field[];
};

export const SERVICE_AREA_KEY = "service_area";

export const ONBOARDING: Section[] = [
  {
    title: "Business info",
    fields: [
      {
        key: "leads_purchased",
        label: "Which leads have you purchased?",
        type: "radio",
        required: true,
        options: [
          { value: "residential", label: "Residential" },
          { value: "commercial", label: "Commercial" },
          { value: "both", label: "Both" },
        ],
      },
      {
        key: SERVICE_AREA_KEY,
        label: "Exact service area",
        type: "textarea",
        required: true,
        help: "List everything you cover — suburbs, cities, regions, or full states. The bigger the service area, the better.",
        placeholder: "e.g. Greater Sydney, Central Coast, Newcastle, Wollongong…",
      },
      { key: "business_name", label: "Business name", type: "text", required: true },
      { key: "contact_name", label: "Contact name", type: "text", required: true },
      { key: "phone", label: "Phone number", type: "tel", required: true },
      { key: "email", label: "Email address", type: "email", required: true },
    ],
  },
  {
    title: "Lead delivery",
    fields: [
      {
        key: "lead_type",
        label: "Lead type",
        type: "radio",
        required: true,
        options: [
          {
            value: "done_for_you",
            label: "Done-for-you — Revena calls the lead and books them straight into your calendar",
          },
          {
            value: "regular",
            label: "Regular — leads sent directly to you to follow up",
          },
        ],
      },
      {
        key: "delivery_channels",
        label: "How do you want to receive leads?",
        type: "checkbox",
        required: true,
        editable: true,
        help: "Portal notifications are included either way. Pick at least one more — both recommended.",
        options: [
          { value: "sms", label: "Phone / SMS" },
          { value: "email", label: "Email" },
        ],
      },
      {
        key: "delivery_phone",
        label: "Number leads should go to",
        type: "tel",
        required: true,
        editable: true,
        showWhen: { key: "delivery_channels", includes: "sms" },
      },
      {
        key: "delivery_email",
        label: "Email leads should go to",
        type: "email",
        required: true,
        editable: true,
        showWhen: { key: "delivery_channels", includes: "email" },
      },
      {
        key: "follow_up_contact",
        label: "Who on your team follows up leads?",
        type: "text",
        editable: true,
        help: "Name and number.",
        placeholder: "e.g. Dave Mitchell — 0400 123 456",
        showWhen: { key: "lead_type", equals: ["regular"] },
      },
      {
        key: "anything_else",
        label: "Anything else the team at Revena Media should know?",
        type: "textarea",
        placeholder: "Optional",
      },
    ],
  },
];

export const ALL_FIELDS: Field[] = ONBOARDING.flatMap((s) => s.fields);

export type Answers = Record<string, string | string[] | undefined>;

/** Whether a conditional field should be shown, given the answers so far. */
export function isVisible(field: Field, answers: Answers): boolean {
  if (!field.showWhen) return true;
  const value = answers[field.showWhen.key];

  if (field.showWhen.includes) {
    return Array.isArray(value) && value.includes(field.showWhen.includes);
  }
  if (field.showWhen.equals) {
    return typeof value === "string" && field.showWhen.equals.includes(value);
  }
  return true;
}

/**
 * Validates a submission.
 *
 * A required field that is hidden by its condition is NOT required — asking
 * for a delivery email from someone who chose SMS only would be a dead end.
 */
export function validate(answers: Answers): string | null {
  for (const field of ALL_FIELDS) {
    if (!field.required) continue;
    if (!isVisible(field, answers)) continue;

    const value = answers[field.key];
    const empty = Array.isArray(value)
      ? value.length === 0
      : !value || !String(value).trim();

    if (empty) return `${field.label} is required.`;
  }

  // Shape checks on whatever was filled in, required or not. A phone field
  // holding "25" passed the empty-check alone and would have had SMS leads
  // sent nowhere.
  for (const field of ALL_FIELDS) {
    if (!isVisible(field, answers)) continue;
    const value = answers[field.key];
    if (typeof value !== "string" || !value.trim()) continue;

    if (field.type === "tel" && value.replace(/\D/g, "").length < 8) {
      return `${field.label} doesn't look like a full phone number.`;
    }
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return `${field.label} doesn't look like a valid email address.`;
    }
  }
  return null;
}

/** Human-readable answer, for the admin view. */
export function displayAnswer(field: Field, answers: Answers): string {
  const value = answers[field.key];
  if (value === undefined || value === null) return "—";

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value
      .map((v) => field.options?.find((o) => o.value === v)?.label ?? v)
      .join(", ");
  }
  if (!String(value).trim()) return "—";

  return field.options?.find((o) => o.value === value)?.label ?? String(value);
}
