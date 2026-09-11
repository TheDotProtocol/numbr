"use client";

// =============================================================================
// OneNumbr UI — Dropdown (click-outside + escape + keyboard support)
// =============================================================================

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "@/lib/cx";

export function Dropdown({
  trigger,
  items,
  align = "end",
}: {
  trigger: ReactNode;
  items: {
    label: string;
    onSelect: () => void;
    tone?: "default" | "danger";
  }[];
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          className={cx(
            "absolute z-50 mt-2 min-w-[180px] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-xl shadow-black/40",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cx(
                "block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted",
                item.tone === "danger" ? "text-destructive" : "text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
