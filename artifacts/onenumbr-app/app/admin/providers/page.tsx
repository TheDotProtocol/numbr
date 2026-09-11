"use client";

// =============================================================================
// /admin/providers — provider readiness console (Prompt 15)
//
// Read-only staff view of declared provider slots, their honest availability /
// configuration state, and the provider health summary. No credentials are
// ever shown; real providers that do not exist are marked disabled / not
// configured. This is a readiness/visibility page, not a configuration panel.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";

export default function AdminProvidersPage() {
  const router = useRouter();
  const [data, setData] = useState<ProviderConsoleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/providers`);
      if (!res.ok) throw new Error(`Failed to load provider readiness (${res.status})`);
      setData((await res.json()) as ProviderConsoleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load provider readiness.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Couldn't load provider readiness"
          description={error}
          action={
            <Button variant="secondary" onClick={() => router.push("/admin")}>
              Back to admin
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent>
            <LoadingState label="Loading provider readiness…" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Provider readiness"
        description="Declared telecom/connectivity provider slots, honest availability and configuration state. This page describes providers — it does not enable any real provider."
        actions={
          <Link href="/admin">
            <Button variant="secondary">Back to admin</Button>
          </Link>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            <DataRow label="Providers declared">{data.summary.providersDeclared}</DataRow>
            <DataRow label="Live / configured">{data.summary.available}</DataRow>
            <DataRow label="Demo operational">{data.summary.demo}</DataRow>
            <DataRow label="Future / disabled">{data.summary.disabled}</DataRow>
            <DataRow label="Configured (sandbox/production)">{data.summary.configured}</DataRow>
            <DataRow label="Note">
              <span className="text-sm text-muted-foreground">{data.summary.note}</span>
            </DataRow>
            <DataRow label="Environment">
              <Badge>{data.environment}</Badge>
            </DataRow>
            <DataRow label="Provider-mode guard">
              <Badge>{data.providerMode.allowed ? "permitted" : "restricted"}</Badge>
              <span className="text-xs text-muted-foreground">{data.providerMode.reason}</span>
            </DataRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider slots</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            {data.providers.map((p) => (
              <div key={p.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 font-medium text-sm">{p.name}</span>
                  <Badge>{p.category}</Badge>
                  <StatusBadge status={p.availability as any} />
                  <Badge>{p.environment}</Badge>
                  {configStateTone(p.configState) ? (
                    <Badge tone={configStateTone(p.configState)}>{p.configState}</Badge>
                  ) : (
                    <Badge>{p.configState}</Badge>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <DataRow label="Interfaces">
                    {p.interfaces.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="text-foreground">{p.interfaces.join(", ")}</span>
                    )}
                  </DataRow>
                  <DataRow label="Capabilities">
                    {p.capabilities.length === 0 ? (
                      <span className="text-muted-foreground">none declared</span>
                    ) : (
                      <span className="text-foreground">{p.capabilities.join(", ")}</span>
                    )}
                  </DataRow>
                  <DataRow label="Regions">
                    {p.regions.length === 0 || p.regions[0] === "*" ? (
                      <span className="text-muted-foreground">region-neutral (*)</span>
                    ) : (
                      <span className="text-foreground">{p.regions.join(", ")}</span>
                    )}
                  </DataRow>
                  <DataRow label="Configuration requirements">
                    <span className="text-xs text-muted-foreground">{p.configurationRequirements}</span>
                  </DataRow>
                  <DataRow label="Note">
                    <span className="text-xs text-muted-foreground">{p.note}</span>
                  </DataRow>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About this page</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Provider readiness describes vendor slots that OneNumbr MAY integrate with in the future.
              It does not mean any live carrier, MNO, MVNO, eSIM, PSTN, SIP or physical SIM provider is
              currently configured. Real providers require an explicit feature flag, valid credentials, and
              the Prompt 10 provider-mode guard to allow them in the current environment.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              No API keys, secrets, tokens, webhook secrets, signing keys, ICCIDs, IMSIs, subscriber
              references, SIM references, SIP credentials or carrier account identifiers are ever shown here
              or anywhere else in the application.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              When a real provider is configured, its implementation is registered in{" "}
              <code className="text-xs font-mono">providers/index.ts</code> and its metadata is described
              in the readiness registry. The client never chooses a provider for privileged operations — the
              server selects providers based on capability, region, interface and provider health.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function configStateTone(state: string): "neutral" | "warning" | "success" | undefined {
  if (state === "production_ready") return "success";
  if (state === "sandbox_only") return "warning";
  if (state === "missing_credentials" || state === "invalid_credentials") return "warning";
  if (state === "disabled") return undefined;
  return "neutral";
}

// ---------------------------------------------------------------------------
// Data types (mirror the server shape)
// ---------------------------------------------------------------------------

type ProviderRow = {
  id: string;
  name: string;
  category: string;
  environment: string;
  availability: string;
  configState: string;
  interfaces: string[];
  capabilities: string[];
  regions: string[];
  configurationRequirements: string;
  note: string;
};

type ProviderModeRow = {
  environment: string;
  real: boolean;
  mock: boolean;
  allowed: boolean;
  reason: string;
};

type SummaryRow = {
  providersDeclared: number;
  available: number;
  demo: number;
  disabled: number;
  configured: number;
  note: string;
};

type ProviderConsoleData = {
  providers: ProviderRow[];
  summary: SummaryRow;
  environment: string;
  providerMode: ProviderModeRow;
};
