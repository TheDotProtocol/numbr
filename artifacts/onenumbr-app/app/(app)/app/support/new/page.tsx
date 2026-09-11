"use client";

// =============================================================================
// /app/support/new — open a new support case
// =============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/toast";
import { createTicket } from "@/services/supportService";
import { TICKET_CATEGORY_OPTIONS, type TicketCategory } from "@/types/support";

export default function NewTicketPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [category, setCategory] = useState<TicketCategory>("other");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ticket = await createTicket({ category, subject, description });
      showToast("Your case has been received.", "success");
      router.push(`/app/support/${ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your case. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGuard>
      <PageHeader title="New support case" description="Tell us what happened — we'll take it from there." />

      <Card className="max-w-2xl">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">What is this about?</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {TICKET_CATEGORY_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      category === c.value
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="subject" className="mb-2 block text-sm font-medium">
                Subject
              </label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short summary — e.g. eSIM installation problem"
                maxLength={120}
                required
                minLength={4}
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium">
                Describe what happened
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                maxLength={5000}
                required
                minLength={10}
                placeholder="Include what you expected, what happened instead, and when it started. You can add screenshots after creating the case."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="mt-1 text-xs text-muted-foreground">{description.length}/5000</p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button type="submit" loading={busy}>
                Submit case
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthGuard>
  );
}
