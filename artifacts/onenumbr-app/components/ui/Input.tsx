"use client";

// =============================================================================
// OneNumbr UI — Input, Label, Field
// =============================================================================

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={hasError || undefined}
      className={cx(
        "h-10 w-full rounded-md border bg-surface-2 px-3 text-sm text-foreground",
        "placeholder:text-muted-foreground/60 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50",
        "disabled:opacity-50",
        hasError ? "border-destructive/60" : "border-border",
        className,
      )}
      {...rest}
    />
  );
});

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cx("block text-xs font-medium tracking-wide text-muted-foreground mb-1.5", className)}
    >
      {children}
    </label>
  );
}

/** Standard labeled field with optional error/hint text. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground/70">{hint}</p>
      ) : null}
    </div>
  );
}
