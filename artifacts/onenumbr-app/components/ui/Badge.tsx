// =============================================================================
// OneNumbr UI — Badge + StatusBadge
//
// StatusBadge resolves EVERY status through lib/status.ts so the same state
// looks identical everywhere in the product. Pages must not keep private
// label/tone maps.
// =============================================================================

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { statusLabel, statusTone, type StatusTone } from "@/lib/status";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  gold: "bg-primary/10 text-primary border-primary/30",
  info: "bg-info/10 text-info border-info/30",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The one status component — label + tone from the unified status system. */
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}
