import Link from "next/link";
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  CLOSED_STAGES,
  type Lead,
  type Stage,
} from "@/lib/types";

/**
 * The pipeline, as a row of stages with live counts.
 *
 * Not a drag-and-drop board on purpose: these are read on a phone, often
 * one-handed, and a horizontal board with columns is unusable at that width.
 * A row of counts answers the question a board is usually asked — how many are
 * sitting at each step — and tapping one filters the list below.
 */
export function PipelineBar({
  leads,
  active,
}: {
  leads: Lead[];
  active: string;
}) {
  const counts = new Map<string, number>();
  let untouched = 0;

  for (const lead of leads) {
    if (!lead.outcome) untouched++;
    else counts.set(lead.outcome, (counts.get(lead.outcome) ?? 0) + 1);
  }

  // A lead nobody has touched is a new lead, whether or not the stage was set.
  counts.set("new", (counts.get("new") ?? 0) + untouched);

  const href = (stage: string) =>
    stage === active ? "/portal/leads" : `/portal/leads?stage=${stage}`;

  return (
    <div className="mb-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/portal/leads"
          className={`shrink-0 rounded-xl border px-4 py-3 transition-colors ${
            active === ""
              ? "border-blue bg-blue-tint"
              : "border-line bg-bg hover:bg-panel"
          }`}
        >
          <div className="text-2xl font-bold text-navy tabular-nums leading-none">
            {leads.length}
          </div>
          <div className="text-xs text-muted mt-1 whitespace-nowrap">All leads</div>
        </Link>

        {PIPELINE_STAGES.map((s: Stage) => {
          const n = counts.get(s) ?? 0;
          const on = active === s;
          const ending = CLOSED_STAGES.includes(s) && s !== "closed";
          return (
            <Link
              key={s}
              href={href(s)}
              className={`shrink-0 rounded-xl border px-4 py-3 transition-colors ${
                on ? "border-blue bg-blue-tint" : "border-line bg-bg hover:bg-panel"
              }`}
            >
              <div
                className={`text-2xl font-bold tabular-nums leading-none ${
                  // Nothing at a stage shouldn't shout; an ending shouldn't
                  // wear the brand colour.
                  n === 0 ? "text-muted" : ending ? "text-body" : "text-navy"
                }`}
              >
                {n}
              </div>
              <div className="text-xs text-muted mt-1 whitespace-nowrap">
                {STAGE_LABELS[s]}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
