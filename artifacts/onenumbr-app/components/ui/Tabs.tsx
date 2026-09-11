"use client";

// =============================================================================
// OneNumbr UI — Tabs (the one tab pattern across the product)
// =============================================================================

import { cx } from "@/lib/cx";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  tabs: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx("flex gap-1 overflow-x-auto border-b border-border/60", className)}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cx(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1.5 text-xs text-muted-foreground">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
