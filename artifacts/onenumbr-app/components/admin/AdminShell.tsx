"use client";

// =============================================================================
// OneNumbr — AdminShell (admin console layout)
// =============================================================================

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileCheck,
  Hash,
  SignalHigh,
  CreditCard,
  ShieldCheck,
  ScrollText,
  Settings,
  ArrowLeft,
  Menu,
  X,
  LifeBuoy,
  Activity,
} from "lucide-react";
import { cx } from "@/lib/cx";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthContext } from "@/hooks/useAuth";
import { logout } from "@/services/authService";
import { Dropdown } from "@/components/ui/Dropdown";

const ADMIN_NAV = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
  { label: "Operations", href: "/admin/operations", icon: Activity },
  { label: "KYC", href: "/admin/kyc", icon: FileCheck },
  { label: "Numbers", href: "/admin/numbers", icon: Hash },
  { label: "eSIM", href: "/admin/esim", icon: SignalHigh },
  { label: "Billing", href: "/admin/billing", icon: CreditCard },
  { label: "Security", href: "/admin/security", icon: ShieldCheck, soon: true },
  { label: "Logs", href: "/admin/logs", icon: ScrollText },
  { label: "Settings", href: "/admin/settings", icon: Settings, soon: true },
];

function Brand() {
  return (
    <div className="px-5 py-5">
      <Link href="/admin" className="onenumbr-mark text-lg font-bold tracking-tight">
        <span className="gold-gradient-text">ONE</span>NUMBR
        <span className="ml-2 rounded border border-primary/40 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-widest text-primary">
          Admin
        </span>
      </Link>
    </div>
  );
}

function AdminSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <nav className="flex-1 space-y-1 px-3" aria-label="Admin navigation">
        {ADMIN_NAV.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.soon ? (
                <span className="rounded-full border border-border px-1.5 py-px text-[9px] uppercase tracking-wider text-muted-foreground/70">
                  soon
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/60 px-3 py-3">
        <Link
          href="/app"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const { account, logout: ctxLogout } = useAuthContext();

  const displayName =
    account?.profile?.fullName || account?.user.email.split("@")[0] || "Admin";

  async function handleLogout() {
    await logout();
    ctxLogout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface/60 backdrop-blur-md lg:block">
        <AdminSidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="animate-fade-in absolute inset-y-0 left-0 w-64 border-r border-border bg-surface">
            <button
              type="button"
              className="absolute right-3 top-4 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <AdminSidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground/60">
              Admin Console
            </span>
          </div>
          <Dropdown
            trigger={
              <span className="flex items-center gap-2.5">
                <Avatar name={displayName} size={32} />
                <span className="hidden text-sm sm:inline">{displayName}</span>
              </span>
            }
            items={[
              { label: "Back to app", onSelect: () => router.push("/app") },
              { label: "Sign out", tone: "danger", onSelect: handleLogout },
            ]}
          />
        </header>
        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
