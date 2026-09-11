// =============================================================================
// OneNumbr UI — Card primitives
// =============================================================================

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-border bg-card/60 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("px-5 pt-4 pb-3 border-b border-border/60", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cx("text-sm font-semibold tracking-wide", className)}>
      {children}
    </h3>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("px-5 py-4", className)}>{children}</div>;
}

/** A single labeled row used in detail lists (Identity page, user detail, ...). */
export function DataRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className,
      )}
    >
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground sm:text-right">{children}</span>
    </div>
  );
}
