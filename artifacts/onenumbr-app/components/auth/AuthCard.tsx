// =============================================================================
// OneNumbr — AuthCard: bordered panel for auth forms
// =============================================================================

import type { ReactNode } from "react";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md sm:p-8">
      {children}
    </div>
  );
}
