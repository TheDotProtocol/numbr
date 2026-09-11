// =============================================================================
// OneNumbr UI — Table primitives
//
// Consistent headers, row height and density. On small screens a table can be
// switched to stacked cards via <ResponsiveTable> (children render both forms;
// CSS picks one) or used with horizontal scroll.
// =============================================================================

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Skeleton } from "@/components/ui/EmptyState";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto rounded-xl border border-border bg-card/40", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border/80 bg-surface/40">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  className,
  numeric,
}: {
  children?: ReactNode;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cx(
        "px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground",
        numeric && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border/50">{children}</tbody>;
}

export function TR({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        "transition-colors",
        onClick && "cursor-pointer hover:bg-muted/40",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  numeric,
}: {
  children?: ReactNode;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <td className={cx("px-4 py-3 align-middle", numeric && "text-right font-mono text-xs", className)}>
      {children}
    </td>
  );
}

/** Loading placeholder matching table proportions. */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Table aria-hidden="true">
      <THead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <TH key={i}>
              <Skeleton className="h-3 w-20" />
            </TH>
          ))}
        </tr>
      </THead>
      <TBody>
        {Array.from({ length: rows }).map((_, r) => (
          <TR key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <TD key={c}>
                <Skeleton className="h-3.5 w-full max-w-28" />
              </TD>
            ))}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
