import type { ReactNode } from "react";
import Link from "next/link";
import { EsimNav } from "@/components/esim/EsimNav";

export default function EsimSectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl">
      <EsimNav />
      {children}
    </div>
  );
}

export function EsimNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm text-muted-foreground hover:text-primary">
      {label}
    </Link>
  );
}
