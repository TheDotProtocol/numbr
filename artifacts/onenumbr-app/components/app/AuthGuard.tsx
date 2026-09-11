"use client";

// =============================================================================
// OneNumbr — AuthGuard
//
// Client-side gate for authenticated pages:
//   loading            → spinner
//   unauthenticated    → redirect /login
//   unverified email   → redirect /verify-email
//   missing onboarding → redirect /onboarding
//   active account     → render children
// (Server-side security remains in Firestore rules + API token checks.)
// =============================================================================

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Button";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, firebaseUser, account } = useAuthContext();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (firebaseUser && !firebaseUser.emailVerified) {
      router.replace("/verify-email");
      return;
    }
    // Onboarding must be complete (profile + identity issued) for /app.
    if (status === "authenticated" && account && (!account.profile || !account.identity)) {
      router.replace("/onboarding");
    }
  }, [status, firebaseUser, account, router]);

  if (status === "loading" || !account || !account.profile || !account.identity) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (account.user.status === "suspended") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">Account suspended</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This account has been suspended. Contact OneNumbr support for
          assistance.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
