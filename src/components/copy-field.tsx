"use client";

import { useState } from "react";

export function CopyField({
  value,
  multiline = false,
}: {
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access is blocked over plain http on some browsers; the text
      // is selectable on screen either way, so just leave the button alone.
      setCopied(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <pre
        className={`flex-1 min-w-0 rounded-xl bg-panel border border-line px-4 py-3 text-xs text-ink font-mono ${
          multiline ? "whitespace-pre overflow-x-auto" : "truncate"
        }`}
      >
        {value}
      </pre>
      <button onClick={copy} className="btn btn-ghost btn-sm shrink-0">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
