// =============================================================================
// OneNumbr UI — Avatar (initials fallback, gold ring)
// =============================================================================

import { cx } from "@/lib/cx";

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border border-primary/30 bg-surface-2 text-primary",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden={true}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold" style={{ fontSize: size / 2.8 }}>
          {initials || "·"}
        </span>
      )}
    </span>
  );
}
