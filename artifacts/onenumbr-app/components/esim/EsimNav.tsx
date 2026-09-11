"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

const LINKS = [
  { href: "/app/esim", label: "Marketplace" },
  { href: "/app/esim/active", label: "My eSIMs" },
  { href: "/app/esim/orders", label: "Orders" },
];

export function EsimNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-1 border-b border-border/60" aria-label="eSIM section">
      {LINKS.map((l) => {
        const active =
          l.href === "/app/esim"
            ? pathname === "/app/esim" || pathname.startsWith("/app/esim/c/")
            : l.href === "/app/esim/active"
              ? pathname.startsWith("/app/esim/active") ||
                pathname.startsWith("/app/esim/s/") ||
                pathname.startsWith("/app/esim/activation/")
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
  );
}
