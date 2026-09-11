import Link from "next/link";

// =============================================================================
// /maintenance — feature-flag-driven maintenance screen (Prompt 10).
// Staff (verified admin/support claim) bypass maintenance via middleware.
// =============================================================================

export const metadata = { title: "Scheduled maintenance — OneNumbr" };

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-4">
        <p className="text-caption uppercase tracking-[0.2em] text-text-secondary">OneNumbr</p>
        <h1 className="text-h1 text-text-primary">We&apos;ll be right back</h1>
        <p className="text-body text-text-secondary">
          OneNumbr is briefly offline for scheduled maintenance. Your account, number and data
          are safe. Please try again in a little while.
        </p>
        <p className="text-caption text-text-tertiary">
          — The OneNumbr team
        </p>
      </div>
      <Link href="/" className="mt-8 text-body text-primary hover:underline">
        Return home
      </Link>
    </main>
  );
}
