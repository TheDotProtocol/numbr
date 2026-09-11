"use client";

// =============================================================================
// /app/account — Account Center layout & section navigation
// =============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

const LINKS = [
  { href: "/app/account", label: "Overview" },
  { href: "/app/account/sessions", label: "Sessions" },
  { href: "/app/account/activity", label: "Activity" },
  { href: "/app/account/notifications", label: "Notifications" },
  { href: "/app/account/privacy", label: "Privacy" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-4xl">
      <nav
        className="mb-6 flex flex-wrap gap-1 border-b border-border/60"
        aria-label="Account sections"
      >
        {LINKS.map((l) => {
          const active =
            l.href === "/app/account"
              ? pathname === "/app/account"
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
