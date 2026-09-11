// =============================================================================
// /admin/[module] — placeholder pages for future admin modules.
// Active modules: /admin, /admin/users, /admin/kyc, /admin/esim,
// /admin/numbers, /admin/logs. This catch-all renders honest coming-soon
// states for the rest.
// =============================================================================

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

const MODULES: Record<string, { title: string; description: string }> = {



  security: {
    title: "Security",
    description:
      "Security events, blocks and risk signals will be monitored here.",
  },
  settings: {
    title: "Platform settings",
    description: "Global platform configuration will live here.",
  },
};

export function generateStaticParams() {
  return Object.keys(MODULES).map((module) => ({ module }));
}

export default async function AdminModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const meta = MODULES[module];
  if (!meta) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={meta.title} />
      <EmptyState title="Coming soon" description={meta.description} />
    </div>
  );
}
