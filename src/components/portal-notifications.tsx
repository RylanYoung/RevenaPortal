"use client";

import { useState, useTransition } from "react";
import { dismissNotification } from "@/app/portal/notifications-actions";
import { formatDateTime } from "./ui";

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export function PortalNotifications({ items }: { items: Notification[] }) {
  // Hide locally the moment it's dismissed — waiting on the round trip makes
  // the button feel broken.
  const [hidden, setHidden] = useState<string[]>([]);
  const [, start] = useTransition();

  const visible = items.filter((n) => !hidden.includes(n.id));
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-3 mb-8">
      {visible.map((n) => (
        <div
          key={n.id}
          className="card p-6 border-l-4 animate-fade-up"
          style={{ borderLeftColor: "var(--color-blue)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl">{n.title}</h2>
              <p className="text-body mt-2 whitespace-pre-wrap">{n.body}</p>
              <div className="text-sm text-muted mt-3">
                {formatDateTime(n.created_at)}
              </div>
            </div>
            <button
              onClick={() => {
                setHidden((h) => [...h, n.id]);
                start(() => dismissNotification(n.id));
              }}
              className="btn btn-ghost btn-sm shrink-0"
            >
              Got it
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
