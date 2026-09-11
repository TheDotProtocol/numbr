"use client";

// =============================================================================
// OneNumbr UI — Alert, ConfirmDialog, Tooltip, Timeline, Breadcrumbs,
// MetricCard, ErrorState
// =============================================================================

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cx } from "@/lib/cx";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { StatusTone } from "@/lib/status";

// ---------------------------------------------------------------------------
// Alert — inline banner for page-level messages (info/success/warning/danger)
// ---------------------------------------------------------------------------

const ALERT_STYLE: Record<"info" | "success" | "warning" | "danger", { box: string; Icon: typeof Info }> = {
  info: { box: "border-info/30 bg-info/5 text-info", Icon: Info },
  success: { box: "border-success/30 bg-success/5 text-success", Icon: CheckCircle2 },
  warning: { box: "border-warning/30 bg-warning/5 text-warning", Icon: AlertTriangle },
  danger: { box: "border-destructive/30 bg-destructive/5 text-destructive", Icon: XCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = ALERT_STYLE[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-lg border px-4 py-3 text-sm", box, className)}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className={cx("min-w-0", tone === "info" && "text-foreground")}>
          {title ? <p className="font-medium">{title}</p> : null}
          {children ? <div className="text-muted-foreground">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog — the one destructive-action confirmation pattern
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted-foreground">{children}</div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tooltip — CSS-only, keyboard-reachable via focus
// ---------------------------------------------------------------------------

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-foreground opacity-0 shadow-pop transition-opacity",
          "group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Timeline — the one activity-timeline pattern (Customer 360, account activity)
// ---------------------------------------------------------------------------

export type TimelineItem = {
  at: number;
  title: string;
  detail?: string;
  tag?: string;
  tone?: StatusTone;
};

export function Timeline({ items, emptyLabel = "No activity yet." }: { items: TimelineItem[]; emptyLabel?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-border/70 pl-5">
      {items.map((item, i) => (
        <li key={`${item.at}-${i}`} className="relative">
          <span
            aria-hidden="true"
            className={cx(
              "absolute -left-[26.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background",
              item.tone === "success" && "bg-success",
              item.tone === "warning" && "bg-warning",
              item.tone === "danger" && "bg-destructive",
              item.tone === "gold" && "bg-primary",
              item.tone === "info" && "bg-info",
              (!item.tone || item.tone === "neutral") && "bg-muted-foreground/50",
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm">{item.title}</span>
            {item.tag ? (
              <span className="rounded border border-border px-1 py-px text-[10px] uppercase tracking-wider text-muted-foreground">
                {item.tag}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(item.at).toLocaleString()}
            {item.detail ? ` · ${item.detail}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// MetricCard — dense stat tile for admin/operations surfaces
// ---------------------------------------------------------------------------

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatusTone;
  href?: string;
  className?: string;
}) {
  const toneText: Record<StatusTone, string> = {
    neutral: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    gold: "text-primary",
    info: "text-info",
  };
  const body = (
    <div className={cx("rounded-xl border border-border bg-card/50 p-4", href && "transition-colors hover:border-primary/40", className)}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cx("mt-1.5 text-2xl font-semibold tabular-nums", toneText[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

// ---------------------------------------------------------------------------
// ErrorState — the designed failure state (complements EmptyState)
// ---------------------------------------------------------------------------

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      title={title}
      description={description ?? "This didn't work. Please try again — if it keeps failing, our support team can help."}
      action={action}
    />
  );
}
