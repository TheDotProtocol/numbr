"use client";

// =============================================================================
// OneNumbr — AppShell (sidebar + topbar, responsive)
//
// Design-system aligned: grouped navigation (Platform / Account), skip link,
// accessible mobile drawer with focus containment, sticky topbar with the
// OneNumbr ID chip and account menu.
// =============================================================================

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ShieldCheck, LogOut } from "lucide-react";
import { cx } from "@/lib/cx";
import { NAV_GROUPS } from "@/components/app/nav-items";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { NotificationBell } from "@/components/app/NotificationBell";
import { useAuthContext } from "@/hooks/useAuth";
import { logout } from "@/services/authService";

function BrandMark() {
  return (
    <Link href="/app" className="onenumbr-mark text-lg font-bold tracking-tight" aria-label="OneNumbr dashboard">
      <span className="gold-gradient-text">ONE</span>NUMBR
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { account } = useAuthContext();
  const role = account?.user.role ?? "user";

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <BrandMark />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cx(
                          "h-4 w-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.soon ? (
                        <span className="rounded-full border border-border px-1.5 py-px text-[9px] uppercase tracking-wider text-muted-foreground/70">
                          soon
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {role === "admin" || role === "support" ? (
        <div className="border-t border-border/60 px-3 py-3">
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Admin console
          </Link>
        </div>
      ) : null}
      <div className="border-t border-border/60 px-5 py-4 text-[11px] leading-relaxed text-muted-foreground/50">
        ONE IDENTITY. ONE NUMBER. ANYWHERE.
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { account, logout: ctxLogout } = useAuthContext();

  // Close the drawer on route change; keep focus inside while open.
  const pathname = usePathname();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    drawerRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const displayName =
    account?.profile?.fullName || account?.user.email.split("@")[0] || "User";

  async function handleLogout() {
    await logout();
    ctxLogout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface/60 backdrop-blur-md lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="animate-fade-in absolute inset-y-0 left-0 w-72 border-r border-border bg-surface"
          >
            <button
              type="button"
              className="absolute right-3 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground/60 lg:hidden">
              OneNumbr
            </span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            {account?.identity ? (
              <Link
                href="/app/identity"
                className="hidden rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-xs text-primary transition-colors hover:border-primary/50 sm:inline-block"
              >
                {account.identity.onenumbr}
              </Link>
            ) : null}
            <Dropdown
              trigger={
                <span className="flex items-center gap-2.5">
                  <Avatar name={displayName} size={32} />
                  <span className="hidden text-sm sm:inline">{displayName}</span>
                </span>
              }
              items={[
                { label: "Account", onSelect: () => router.push("/app/account") },
                { label: "Settings", onSelect: () => router.push("/app/settings") },
                { label: "Sign out", tone: "danger", onSelect: handleLogout },
              ]}
            />
          </div>
        </header>
        <main id="main-content" className="flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
