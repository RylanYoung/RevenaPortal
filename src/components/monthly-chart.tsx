"use client";

import { useState } from "react";
import type { MonthBucket } from "@/lib/reporting";

/**
 * Monthly lead volume, split into what counts against the pack and what was
 * replaced.
 *
 * Form is EMPHASIS, not two categorical series: brand blue carries the subject
 * (leads they actually got) and a de-emphasis gray carries context (credited
 * back). The gray is deliberately below the chroma floor — it should read as
 * gray. Validated on the adjacent pair: ΔE 21.6 protan / 29.6 normal, contrast
 * >= 3:1 on white.
 */
const COUNTED = "#1414FF";
const REPLACED = "#7A82A3";

const W = 760;
const H = 260;
const PAD = { top: 24, right: 12, bottom: 34, left: 38 };

const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Rounded top corners only — the bottom stays anchored flat to the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    `L ${x + w - rr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `L ${x + w} ${y + h}`,
    "Z",
  ].join(" ");
}

/** Rounds the axis ceiling up to something a person would choose. */
function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
}

export function MonthlyChart({ data }: { data: MonthBucket[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const peak = Math.max(...data.map((d) => d.total), 0);
  const max = niceMax(peak);
  const hasAnyReplaced = data.some((d) => d.replaced > 0);

  const slot = PLOT_W / data.length;
  const barW = Math.min(slot * 0.58, 46);

  const y = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H;

  // Four recessive gridlines, including the baseline.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));

  // Direct-label only the peak and the most recent month — a number on every
  // bar turns the chart into a table that's harder to read than a table.
  const peakIndex = data.findIndex((d) => d.total === peak && peak > 0);
  const lastWithData = data.map((d) => d.total).lastIndexOf(
    data.map((d) => d.total).filter((t) => t > 0).pop() ?? -1
  );

  const active = hovered !== null ? data[hovered] : null;

  return (
    <div>
      {/* ---- legend: always present for 2 series ---- */}
      {hasAnyReplaced && (
        <div className="flex flex-wrap items-center gap-5 mb-4">
          <LegendItem color={COUNTED} label="Counted" />
          <LegendItem color={REPLACED} label="Replaced" />
        </div>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Leads delivered per month"
        >
          {/* gridlines + y labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="#E3E7F2"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-[#7A82A3]"
                fontSize={11}
              >
                {t}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const x = cx - barW / 2;

            const countedH = (d.counted / max) * PLOT_H;
            const replacedH = (d.replaced / max) * PLOT_H;

            // 2px surface gap between stacked segments.
            const GAP = d.replaced > 0 && d.counted > 0 ? 2 : 0;
            const countedY = PAD.top + PLOT_H - countedH;
            const replacedY = countedY - GAP - replacedH;

            const dim = hovered !== null && hovered !== i;
            const showLabel = i === peakIndex || i === lastWithData;

            return (
              <g key={d.key} opacity={dim ? 0.45 : 1} style={{ transition: "opacity .15s" }}>
                {d.counted > 0 && (
                  <path
                    d={barPath(x, countedY, barW, countedH, d.replaced > 0 ? 0 : 4)}
                    fill={COUNTED}
                  />
                )}
                {d.replaced > 0 && (
                  <path d={barPath(x, replacedY, barW, replacedH, 4)} fill={REPLACED} />
                )}

                {showLabel && d.total > 0 && (
                  <text
                    x={cx}
                    y={(d.replaced > 0 ? replacedY : countedY) - 7}
                    textAnchor="middle"
                    className="fill-[#0A1440]"
                    fontSize={12}
                    fontWeight={600}
                  >
                    {d.total}
                  </text>
                )}

                <text
                  x={cx}
                  y={H - 12}
                  textAnchor="middle"
                  className="fill-[#7A82A3]"
                  fontSize={11}
                >
                  {d.label}
                </text>

                {/* Hit target spans the whole column, not just the bar. */}
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={PLOT_H}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            );
          })}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl bg-navy px-4 py-3 text-white shadow-lg animate-fade-in"
            style={{
              left: `${((PAD.left + slot * hovered! + slot / 2) / W) * 100}%`,
              top: 0,
              transform: "translate(-50%, -8px)",
            }}
          >
            <div className="text-xs font-semibold opacity-70">{active.fullLabel}</div>
            <div className="text-lg font-bold tabular-nums">
              {active.total} {active.total === 1 ? "lead" : "leads"}
            </div>
            {active.replaced > 0 && (
              <div className="text-xs opacity-80">
                {active.counted} counted · {active.replaced} replaced
              </div>
            )}
            {active.won > 0 && (
              <div className="text-xs opacity-80">{active.won} won</div>
            )}
          </div>
        )}
      </div>

      {/* ---- table view: identity never rests on colour alone ---- */}
      <details className="mt-5">
        <summary className="cursor-pointer text-sm text-muted hover:text-navy">
          View as table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left">
              <tr className="text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-semibold">Month</th>
                <th className="px-3 py-2 font-semibold">Total</th>
                <th className="px-3 py-2 font-semibold">Counted</th>
                <th className="px-3 py-2 font-semibold">Replaced</th>
                <th className="px-3 py-2 font-semibold">Won</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="px-3 py-2 text-body">{d.fullLabel}</td>
                  <td className="px-3 py-2 tabular-nums text-navy font-medium">
                    {d.total}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-body">{d.counted}</td>
                  <td className="px-3 py-2 tabular-nums text-body">{d.replaced}</td>
                  <td className="px-3 py-2 tabular-nums text-body">{d.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-sm text-body">
      <span
        className="h-3 w-3 rounded-sm"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
