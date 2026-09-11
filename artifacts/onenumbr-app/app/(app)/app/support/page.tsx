"use client";

// =============================================================================
// /app/support — customer support cases
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { listMyTickets } from "@/services/supportService";
import { TICKET_CATEGORY_OPTIONS, type SupportTicketView } from "@/types/support";
import { StatusBadge } from "@/components/ui/Badge";
import { statusLabel, statusTone } from "@/lib/status";

export function ticketStatusLabel(status: string): string {
  return statusLabel(status);
}

export function ticketStatusTone(status: string): "neutral" | "success" | "warning" | "danger" | "gold" | "info" {
  return statusTone(status);
}

function categoryLabel(value: string): string {
  return TICKET_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicketView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyTickets()
      .then(setTickets)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your cases."));
  }, []);

  return (
    <AuthGuard>
      <PageHeader
        title="Support"
        description="Get help from the OneNumbr team."
        actions={
          <Link href="/app/support/new">
            <Button>New case</Button>
          </Link>
        }
      />

      {error ? (
        <EmptyState title="Couldn't load your cases" description={error} />
      ) : tickets === null ? (
        <LoadingState label="Loading your cases…" />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="Need help?"
          description="You don't have any open support cases. When something goes wrong — or you have a question — our team is one message away."
          action={
            <Link href="/app/support/new">
              <Button>Contact support</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link key={t.id} href={`/app/support/${t.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/30">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{t.ticketNumber}</span>
                      <StatusBadge status={t.status} />
                      {t.priority === "urgent" && <StatusBadge status="urgent" />}
                    </div>
                    <p className="mt-1 truncate font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabel(t.category)} · Updated {new Date(t.lastMessageAt ?? t.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">View →</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AuthGuard>
  );
}
