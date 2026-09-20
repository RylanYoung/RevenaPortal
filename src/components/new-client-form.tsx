"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/app/admin/actions";
import { SERVICE_TYPES } from "@/lib/types";

export function NewClientForm() {
  const [open, setOpen] = useState(false);
  const [result, formAction, pending] = useActionState(createClient, null);

  // Collapse on success so the new client is visible in the list behind it.
  if (result?.ok && open) setOpen(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        Add client
      </button>
    );
  }

  return (
    <div className="card p-6 w-full">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-navy">New client</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-navy"
        >
          Cancel
        </button>
      </div>

      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="business_name">
            Business name *
          </label>
          <input id="business_name" name="business_name" required className="field" />
        </div>

        <div>
          <label className="label" htmlFor="contact_name">
            Contact name
          </label>
          <input id="contact_name" name="contact_name" className="field" />
        </div>

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="field" />
        </div>

        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" className="field" />
        </div>

        <div>
          <label className="label" htmlFor="service_type">
            Service type
          </label>
          <select id="service_type" name="service_type" className="field" defaultValue="both">
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="region">
            Region
          </label>
          <input
            id="region"
            name="region"
            className="field"
            placeholder="Brisbane + Gold Coast"
          />
        </div>

        <div>
          <label className="label" htmlFor="postcodes">
            Postcodes
          </label>
          <input
            id="postcodes"
            name="postcodes"
            className="field"
            placeholder="4000, 4217, 4220"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="ghl_tag_reference">
            GHL tag
          </label>
          <input
            id="ghl_tag_reference"
            name="ghl_tag_reference"
            className="field"
            placeholder="client-brightsolar"
          />
          <p className="mt-1.5 text-xs text-muted">
            The tag you apply in GHL to route a lead here. Must be unique across clients,
            and must match exactly (case doesn&apos;t matter).
          </p>
        </div>

        <div className="sm:col-span-2 border-t border-line pt-4 mt-1">
          <p className="text-sm font-semibold text-navy mb-3">
            Opening pack{" "}
            <span className="font-normal text-muted">— optional, add later if they haven&apos;t bought yet</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="pack_size">
                Pack size
              </label>
              <input id="pack_size" name="pack_size" type="number" min="1" className="field" />
            </div>
            <div>
              <label className="label" htmlFor="pack_price">
                Price paid (AUD)
              </label>
              <input
                id="pack_price"
                name="pack_price"
                type="number"
                min="0"
                step="0.01"
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="pack_start">
                Start date
              </label>
              <input id="pack_start" name="pack_start" type="date" className="field" />
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">
            Internal notes
          </label>
          <textarea id="notes" name="notes" rows={2} className="field" />
          <p className="mt-1.5 text-xs text-muted">Only you see this — never shown to the client.</p>
        </div>

        {result && !result.ok && (
          <p className="sm:col-span-2 text-sm text-danger">{result.error}</p>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Creating…" : "Create client"}
          </button>
        </div>
      </form>
    </div>
  );
}
