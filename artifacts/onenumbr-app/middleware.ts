// =============================================================================
// OneNumbr — Route protection + security headers + maintenance middleware
//
// Responsibilities (in order):
//   1. Security headers on every response (CSP that permits Firebase Auth
//      and the emulator, HSTS, frame, sniffing, referrer, permissions).
//   2. Maintenance mode: when the FEATURE_MAINTENANCE_MODE flag is set, all
//      customer traffic is sent to /maintenance; verified staff (admin/support
//      session cookie) bypass it. Admin/health/API surfaces stay reachable.
//   3. Auth presence guard (unchanged): /app/** and /onboarding need a
//      session cookie; /admin/** pages do the authoritative claim check
//      server-side. This middleware is a UX guard — real security lives in
//      Firestore rules and per-request token verification in API routes.
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";

// Only the real session cookie name; "__session" is a Firebase Hosting
// convention this app does not use (verified in the Prompt 10 audit — no
// code writes or reads "__session").
const SESSION_COOKIES = ["onenumbr_session"];
const STAFF_COOKIES = ["onenumbr_staff"];

function hasAnyCookie(req: NextRequest, names: string[]): boolean {
  return names.some((name) => req.cookies.has(name));
}

function isStaff(req: NextRequest): boolean {
  return hasAnyCookie(req, STAFF_COOKIES);
}

// --- Security headers ---------------------------------------------------------

function contentSecurityPolicy(): string {
  const isProd = process.env.NODE_ENV === "production";
  const emulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

  const connectSrc = [
    "'self'",
    "https://api.stripe.com", // future payments (harmless today)
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    ...(isProd ? [] : ["http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*"]),
    ...(emulator ? ["http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*"] : []),
  ].join(" ");

  const scriptSrc = isProd
    ? ["'self'", "https://apis.google.com", "https://*.googleapis.com"].join(" ")
    : ["'self'", "'unsafe-eval'", "https://apis.google.com", "https://*.googleapis.com"].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind inline styles + styled overlays
    "img-src 'self' data: blob: https://*.googleusercontent.com https://*.firebasestorage.googleapis.com",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set("Content-Security-Policy", contentSecurityPolicy());
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return res;
}

// --- Middleware ---------------------------------------------------------------

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const flags = {
    maintenance: process.env.FEATURE_MAINTENANCE_MODE === "true",
  };

  // 2. Maintenance mode (staff bypass; admin/health/API stay up).
  if (flags.maintenance) {
    const exempt =
      pathname.startsWith("/maintenance") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/health") ||
      pathname.startsWith("/_next") ||
      isStaff(req);
    if (!exempt) {
      const url = req.nextUrl.clone();
      url.pathname = "/maintenance";
      url.search = "";
      return securityHeaders(NextResponse.redirect(url));
    }
  }

  // 3. Auth presence guard (unchanged behavior).
  const isProtectedApp = pathname.startsWith("/app") || pathname.startsWith("/onboarding");
  const isAdmin = pathname.startsWith("/admin");

  if ((isProtectedApp || isAdmin) && !hasAnyCookie(req, SESSION_COOKIES)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return securityHeaders(NextResponse.redirect(url));
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
