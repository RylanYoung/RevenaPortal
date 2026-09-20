"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portal", label: "Dashboard", exact: true },
  { href: "/portal/leads", label: "My leads" },
  { href: "/portal/reporting", label: "Reporting" },
  { href: "/portal/account", label: "Account" },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative rounded-full px-5 py-2.5 text-base font-medium whitespace-nowrap transition-colors ${
              active
                ? "bg-blue-tint text-blue"
                : "text-body hover:bg-panel hover:text-navy"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
