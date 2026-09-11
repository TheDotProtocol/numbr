"use client";

// =============================================================================
// OneNumbr UI — Select, SearchInput, Pagination, IconButton
// =============================================================================

import { forwardRef, type SelectHTMLAttributes, type InputHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cx } from "@/lib/cx";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, hasError, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={hasError || undefined}
      className={cx(
        "h-10 rounded-md border bg-surface-2 px-3 text-sm text-foreground transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50",
        "disabled:opacity-50",
        hasError ? "border-destructive/60" : "border-border",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
  onClear,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  onClear?: () => void;
}) {
  return (
    <div className={cx("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cx(
          "h-10 w-full rounded-md border border-border bg-surface-2 pl-9 pr-9 text-sm text-foreground",
          "placeholder:text-muted-foreground/60 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50",
        )}
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onPage,
  className,
}: {
  page: number;
  pages: number;
  total?: number;
  onPage: (next: number) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="Pagination"
      className={cx("flex items-center justify-between text-sm", className)}
    >
      <span className="text-muted-foreground">
        Page {page} of {pages}
        {typeof total === "number" ? ` · ${total} result${total === 1 ? "" : "s"}` : ""}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
          className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
          className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
