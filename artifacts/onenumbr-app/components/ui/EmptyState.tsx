// =============================================================================
// OneNumbr UI — EmptyState + LoadingState
// Honest empty states and complete loading states for every async surface.
// =============================================================================

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Spinner } from "@/components/ui/Button";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cx("flex items-center justify-center gap-3 py-14 text-muted-foreground", className)}>
      <Spinner className="text-primary" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}

/** Skeleton block for card/list placeholders. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-pulse rounded-md bg-muted/60", className)}
      aria-hidden={true}
    />
  );
}
