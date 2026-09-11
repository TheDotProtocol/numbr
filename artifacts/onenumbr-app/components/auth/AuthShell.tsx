// =============================================================================
// OneNumbr — Auth pages shell
// =============================================================================

import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="onenumbr-mark text-lg font-bold tracking-tight text-foreground"
        >
          <span className="gold-gradient-text">ONE</span>NUMBR
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Global Identity Platform
          <span className="text-primary"> ↗</span>
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </main>
      <footer className="px-6 pb-6 text-center text-xs text-muted-foreground/60 sm:px-10">
        {footer ?? (
          <p>
            ONE IDENTITY. ONE NUMBER. ANYWHERE. —{" "}
            <span className="text-muted-foreground">onenumbr.com</span>
          </p>
        )}
      </footer>
    </div>
  );
}
