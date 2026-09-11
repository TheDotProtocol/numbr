"use client";

// =============================================================================
// /app/account/activity — Security Activity timeline (paginated).
// Privacy-conscious: shows device context and honest metadata only.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { Timeline } from "@/components/ui/Feedback";
import { fetchActivity } from "@/services/accountService";
import type { SecurityEvent } from "@/types/account";
import { History } from "lucide-react";

export default function ActivityPage() {
  return (
    <AuthGuard>
      <ActivityInner />
    </AuthGuard>
  );
}

function ActivityInner() {
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInitial = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchActivity();
      setEvents(d.events);
      setNextCursor(d.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity.");
      setEvents((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const d = await fetchActivity(nextCursor);
      setEvents((prev) => [...(prev ?? []), ...d.events]);
      setNextCursor(d.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more activity.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (error) return <EmptyState title="Couldn't load activity" description={error} />;
  if (events === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading security activity…" />
        </CardContent>
      </Card>
    );
  }
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-5 w-5" />}
        title="No security activity yet"
        description="Sign-ins, session changes and security updates will appear here."
      />
    );
  }

  return (
    <>
      <Timeline
        items={events.map((e) => ({
          at: e.createdAt ?? 0,
          title: e.title,
          detail:
            (e.deviceDescription ?? "Device unknown") +
            (Object.keys(e.metadata).length > 0
              ? ` · ${Object.entries(e.metadata)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(" · ")}`
              : ""),
        }))}
      />

      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" loading={loadingMore} onClick={() => void loadMore()}>
            Load earlier activity
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-muted-foreground/60">
          Beginning of your activity history
        </p>
      )}
    </>
  );
}
