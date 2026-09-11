"use client";

// =============================================================================
// OneNumbr — StaffGuard (admin + support roles)
//
// Mirrors AdminGuard but authorizes against a staff endpoint: the
// authoritative check is server-side (requireStaff) on every API call.
// =============================================================================

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Button";
import { ShieldAlert } from "lucide-react";

type CheckState = "checking" | "allowed" | "denied" | "signed-out";

export function StaffGuard({ children }: { children: ReactNode }) {
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
        const res = await fetch("/api/admin/support?pageSize=10", { method: "GET" });
        if (!cancelled) setState(res.ok ? "allowed" : "denied");
      } catch {
        if (!cancelled) setState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  if (state === "checking" || state === "signed-out") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            The Support Center requires an admin or support role.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
