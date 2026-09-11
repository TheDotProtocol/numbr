"use client";

// =============================================================================
// ServiceStatus — user-facing service status. Honest by design: real in-app
// engines report operational; demo-provider capabilities are labeled "demo"
// with plain-language notes. Statuses never fabricate outages.
// =============================================================================

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getServiceStatus, getOverallStatus, type ServiceStatusState } from "@/lib/service-status";

const STATE_LABEL: Record<ServiceStatusState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  maintenance: "Maintenance",
  unavailable: "Unavailable",
  demo: "Demo environment",
};

const STATE_TONE: Record<ServiceStatusState, "neutral" | "success" | "warning" | "danger" | "gold"> = {
  operational: "success",
  degraded: "warning",
  maintenance: "warning",
  unavailable: "danger",
  demo: "gold",
};

export function ServiceStatus() {
  const components = getServiceStatus();
  const overall = getOverallStatus(components);

  return (
    <div className="space-y-4">
      <div
        role="status"
        className={`rounded-lg border px-4 py-3 text-sm ${
          overall.state === "operational"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : overall.state === "degraded"
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-gold/40 bg-gold/5"
        }`}
      >
        {overall.message}
      </div>

      <div className="space-y-2">
        {components.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>
              </div>
              <Badge tone={STATE_TONE[c.state]}>{STATE_LABEL[c.state]}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
