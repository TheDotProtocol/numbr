"use client";

// =============================================================================
// /admin/users — user management list
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";

interface AdminUserRow {
  uid: string;
  email: string;
  role: string;
  status: string;
  createdAt: number | null;
  lastLoginAt: number | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (searchQ: string, cursorVal: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQ.trim()) params.set("q", searchQ.trim());
      if (cursorVal) params.set("cursor", cursorVal);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
      const data = (await res.json()) as { users: AdminUserRow[]; nextCursor: string | null };
      setUsers((prev) =>
        cursorVal && prev ? [...prev, ...data.users] : data.users,
      );
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
      setUsers((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("", null);
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setCursor(null);
    setUsers([]);
    void load(q, null);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Users"
        description="All OneNumbr accounts. Open a user for full detail and actions."
      />

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <Input
          type="search"
          placeholder="Search by email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search users by email"
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {users === null && loading ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading users…" />
          </CardContent>
        </Card>
      ) : error ? (
        <EmptyState title="Couldn't load users" description={error} />
      ) : !users || users.length === 0 ? (
        <EmptyState
          title="No users found"
          description={
            q ? `No accounts match “${q}”.` : "No accounts exist yet."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-surface/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">OneNumbr ID</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 text-right" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {users.map((u) => (
                    <tr key={u.uid} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-3">{u.email}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        <AdminUserIdCell uid={u.uid} />
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{u.role}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/users/${u.uid}`}
                          className="text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor ? (
              <div className="border-t border-border/60 px-5 py-3">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={loading}
                  onClick={() => {
                    setCursor(nextCursor);
                    void load(q, nextCursor);
                  }}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * OneNumbr IDs are not on the users document; the list shows the UID for
 * now and the detail page loads the issued ID. A join/denormalization can
 * be added in a later prompt without UI restructuring.
 */
function AdminUserIdCell({ uid }: { uid: string }) {
  return <span title={uid}>{uid.slice(0, 8)}…</span>;
}
