import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="onenumbr-mark text-lg font-bold tracking-tight">
          <span className="gold-gradient-text">ONE</span>NUMBR
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-accent"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-primary">
          One Identity. One Number. Anywhere.
        </p>
        <h1 className="onenumbr-mark mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Your global identity{" "}
          <span className="gold-gradient-text">starts here.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          OneNumbr is your permanent digital identity and connectivity
          platform — one account for identity verification, global numbers,
          eSIMs, and everything that connects them.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent"
          >
            Create your account
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-border px-8 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Sign in
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/50 px-6 py-6 text-center text-xs text-muted-foreground/60 sm:px-10">
        © 2026 OneNumbr — Global Identity Platform
      </footer>
    </main>
  );
}
