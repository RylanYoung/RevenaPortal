"use client";

import { useEffect, useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "revena-theme";

/**
 * Applies a theme choice to the document.
 *
 * Kept as a plain function (not a hook) so the inline no-flash script in
 * layout.tsx can mirror this exact logic — if the two ever disagree, you get
 * a flash of the wrong theme on load.
 */
export function applyTheme(choice: ThemeChoice) {
  const resolved =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : choice;
  document.documentElement.setAttribute("data-theme", resolved);
}

/* ------------------------------------------------------------------
   A tiny external store over localStorage.

   useSyncExternalStore rather than useState+useEffect: the value lives
   outside React (localStorage), and reading it during render would
   mismatch the server HTML. The server snapshot is always "light",
   which is what the server actually rendered.

   The `storage` event only fires in OTHER tabs, so same-tab changes are
   published manually via emit().
   ------------------------------------------------------------------ */
let listeners: (() => void)[] = [];

function emit() {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.push(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): ThemeChoice {
  try {
    return (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? "light";
  } catch {
    // Private browsing can throw on access, not just on write.
    return "light";
  }
}

function getServerSnapshot(): ThemeChoice {
  return "light";
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Follow the OS in real time, but only while set to "system".
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  function pick(next: ThemeChoice) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Theme still applies for this session even if it can't be remembered.
    }
    applyTheme(next);
    emit();
  }

  const options: { value: ThemeChoice; label: string; icon: string }[] = [
    { value: "light", label: "Light", icon: "☀" },
    { value: "dark", label: "Dark", icon: "☾" },
    { value: "system", label: "System", icon: "◐" },
  ];

  return (
    <div
      className="inline-flex gap-1 rounded-full bg-panel p-1 border border-line"
      role="group"
      aria-label="Colour theme"
    >
      {options.map((o) => {
        const active = choice === o.value;
        return (
          <button
            key={o.value}
            onClick={() => pick(o.value)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active ? "bg-blue text-white" : "text-muted hover:text-navy"
            }`}
          >
            <span aria-hidden>{o.icon}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
