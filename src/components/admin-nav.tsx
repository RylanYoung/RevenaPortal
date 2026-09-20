"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/unassigned", label: "Unassigned" },
  { href: "/admin/requests", label: "Replacement requests" },
  { href: "/admin/setup", label: "Webhook setup" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ counts }: { counts: { unassigned: number; requests: number } }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        // Surface the two queues that need action directly in the nav, so you
        // don't have to open a page to find out whether anything's waiting.
        const badge =
          link.href === "/admin/unassigned"
            ? counts.unassigned
            : link.href === "/admin/requests"
              ? counts.requests
              : 0;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-blue-tint text-blue"
                : "text-body hover:bg-panel hover:text-navy"
            }`}
          >
            <span>{link.label}</span>
            {badge > 0 && (
              <span className="rounded-full bg-warn px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
