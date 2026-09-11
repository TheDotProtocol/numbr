"use client";

// =============================================================================
// OneNumbr — AdminGuard
//
// The authoritative check happens server-side (admin API routes verify the
// ID token + role claim on every request). This guard mirrors that check for
// UX: it calls GET /api/admin/overview and renders an access-denied state on
// 403 instead of leaking the console UI to non-admins.
// =============================================================================

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Button";
import { ShieldAlert } from "lucide-react";

type CheckState = "checking" | "allowed" | "denied" | "signed-out";

export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuthContext();
  const [state, setState] = useState<CheckState>("checking");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/overview", { method: "GET" });
        if (!cancelled) setState(res.ok ? "allowed" : "denied");
      } catch {
        if (!cancelled) setState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  if (state === "checking" || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Access denied</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The admin console is restricted to OneNumbr administrators. This
          attempt has been logged.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
