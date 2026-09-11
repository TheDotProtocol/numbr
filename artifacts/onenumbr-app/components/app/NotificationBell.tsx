"use client";

// =============================================================================
// OneNumbr — NotificationBell (topbar dropdown)
// =============================================================================

import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useKyc";
import { Badge } from "@/components/ui/Badge";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, loaded, unreadCount, markAllRead } = useNotifications(15);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unreadCount > 0) void markAllRead();
        }}
        className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-black/40"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              {loaded && notifications.length > 0 ? (
                <Badge tone="neutral">{notifications.length}</Badge>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!loaded ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {notifications.map((n) => (
                    <li key={n.id} className="px-4 py-3">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/60">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
