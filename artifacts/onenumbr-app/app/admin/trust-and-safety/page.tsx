"use client";

// =============================================================================
// /admin/trust-and-safety — trust & safety readiness (Prompt 16)
//
// Read-only staff view of trust-and-safety provider slots and the honest
// current-protection state. This page describes the layer — it does not claim
// live spam filtering, live reputation, live anti-automation or live inbound
// abuse handling.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";

export default function AdminTrustAndSafetyPage() {
  const router = useRouter();
  const [data, setData] = useState<TrustAndSafetyConsoleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/trust-and-safety`);
      if (!res.ok) throw new Error(`Failed to load trust & safety readiness (${res.status})`);
      setData((await res.json()) as TrustAndSafetyConsoleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trust & safety readiness.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Couldn't load trust & safety readiness"
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
            <LoadingState label="Loading trust & safety readiness…" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Trust & safety readiness"
        description="Spam / abuse / anti-automation provider slots and the honest current-protection state. This page describes the layer — it does not claim live spam, abuse, automation or reputation protection."
        actions={
          <Link href="/admin">
            <Button variant="secondary">Back to admin</Button>
          </Link>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Current protection (today)</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            <DataRow label="Layer present">
              <Badge>{data.currentProtection.enabled ? "yes (readiness surface)" : "no"}</Badge>
            </DataRow>
            <DataRow label="Current protection model">
              <span className="text-sm text-muted-foreground">{data.currentProtection.model}</span>
            </DataRow>
            <DataRow label="Capabilities today">
              <span className="text-sm text-muted-foreground">{data.currentProtection.capabilities.join(", ")}</span>
            </DataRow>
            <DataRow label="Live spam filter">
              <Badge>{data.capabilities.inboundSpamFilter}</Badge>
            </DataRow>
            <DataRow label="Live outbound guard">
              <Badge>{data.capabilities.outboundGuard}</Badge>
            </DataRow>
            <DataRow label="Live anti-automation">
              <Badge>{data.capabilities.antiAutomation}</Badge>
            </DataRow>
            <DataRow label="Live sender reputation">
              <Badge>{data.capabilities.senderReputation}</Badge>
            </DataRow>
            <DataRow label="Live abuse reporting">
              <Badge>{data.capabilities.abuseReporting}</Badge>
            </DataRow>
            <DataRow label="Live incident management">
              <Badge>{data.capabilities.incidentManagement}</Badge>
            </DataRow>
            <DataRow label="Live verification/challenge">
              <Badge>{data.capabilities.verificationChallenge}</Badge>
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
                  <Badge>{p.availability}</Badge>
                  <Badge>{p.configState}</Badge>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <DataRow label="Interfaces">
                    {p.interfaces.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="text-foreground">{p.interfaces.join(", ")}</span>
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
            <CardTitle>About this layer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Trust and safety is a replaceable infrastructure layer beneath OneNumbr identity, number, plan,
              communications and endpoints — the same architectural rule as connectivity and telecom providers.
              Spam/abuse/automation decisions must never redefine the OneNumbr identity, number or plan.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Today OneNumbr's protection comes from basic abuse-resistant design (Prompt 10): rate limiting,
              safe errors, ownership checks, audit logging, request IDs and secret redaction. There is no live
              spam filter, reputation engine, anti-automation challenge provider or inbound abuse pipeline.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              No provider credentials, tokens, webhook secrets, reputation scores belonging to other customers,
              or raw abuse evidence are ever exposed here or anywhere else in the application.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type ProviderSlot = {
  id: string;
  name: string;
  category: string;
  availability: string;
  configState: string;
  interfaces: string[];
  configurationRequirements: string;
  note: string;
};

type Capabilities = {
  inboundSpamFilter: string;
  outboundGuard: string;
  antiAutomation: string;
  senderReputation: string;
  abuseReporting: string;
  incidentManagement: string;
  verificationChallenge: string;
};

type CurrentProtection = {
  enabled: boolean;
  model: string;
  capabilities: string[];
};

type TrustAndSafetyConsoleData = {
  providers: ProviderSlot[];
  summary: {
    providersDeclared: number;
    live: number;
    demo: number;
    disabled: number;
    configured: number;
    note: string;
  };
  capabilities: Capabilities;
  currentProtection: CurrentProtection;
};
