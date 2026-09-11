"use client";

// =============================================================================
// OneNumbr UI — CountrySelect (accessible native select with flags)
// =============================================================================

import { forwardRef, useMemo, useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { cx } from "@/lib/cx";

export interface CountrySelectProps {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  hasError?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export const CountrySelect = forwardRef<HTMLSelectElement, CountrySelectProps>(
  function CountrySelect(
    { value, onChange, id, hasError, placeholder = "Select country", disabled },
    ref,
  ) {
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
      if (!query.trim()) return COUNTRIES;
      const q = query.trim().toLowerCase();
      return COUNTRIES.filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
      );
    }, [query]);

    return (
      <div className="w-full">
        <input
          type="search"
          role="searchbox"
          aria-label="Filter countries"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter countries…"
          className="mb-2 h-8 w-full rounded-md border border-border bg-surface-2 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select
          ref={ref}
          id={id}
          value={value}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          onChange={(e) => onChange(e.target.value)}
          size={Math.min(8, Math.max(5, filtered.length))}
          className={cx(
            "w-full rounded-md border bg-surface-2 py-1 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50",
            hasError ? "border-destructive/60" : "border-border",
          )}
        >
          <option value="">{placeholder}</option>
          {filtered.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </div>
    );
  },
);
