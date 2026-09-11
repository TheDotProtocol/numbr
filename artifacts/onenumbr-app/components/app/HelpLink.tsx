"use client";

// =============================================================================
// OneNumbr — HelpLink: contextual help integration
//
// Links a page or state to the relevant Help Center article. One component,
// consistent placement ("Learn more" pattern). Renders as a quiet inline link
// so education never competes with the primary CTA.
// =============================================================================

import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { cx } from "@/lib/cx";

export function HelpLink({
  slug,
  label,
  className,
}: {
  slug: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={`/app/help/${slug}`}
      className={cx(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary",
        className,
      )}
    >
      <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      {label ?? "Learn more"}
    </Link>
  );
}
