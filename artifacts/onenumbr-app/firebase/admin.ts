// =============================================================================
// OneNumbr — Firebase Admin initialization (server-side only)
//
// NEVER import this file from client components. It reads the service account
// from FIREBASE_SERVICE_ACCOUNT_JSON (inline JSON) or
// GOOGLE_APPLICATION_CREDENTIALS (file path) and is used by:
//   - /api/onboarding/*  (OneNumbr ID generation)
//   - /api/admin/*       (user management, claims, audit logs)
// =============================================================================

import { cert, getApps, getApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;

function buildCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    try {
      const json = JSON.parse(raw) as {
        project_id?: string;
        private_key?: string;
        client_email?: string;
      };
      if (!json.private_key || !json.client_email) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_JSON is missing private_key or client_email",
        );
      }
      // Handle escaped newlines when the JSON is embedded in env vars.
      const privateKey = json.private_key.includes("\\n")
        ? json.private_key.replace(/\\n/g, "\n")
        : json.private_key;
      return cert({
        projectId: json.project_id ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: json.client_email,
        privateKey,
      });
    } catch (err) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is set but invalid. It must be the full service account JSON on a single line. " +
          `Original error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  // Fall back to GOOGLE_APPLICATION_CREDENTIALS / Application Default
  // Credentials (works out of the box on Firebase Hosting / Cloud Run).
  return undefined;
}

/** Get (or lazily create) the singleton Firebase Admin app. */
export function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length) {
      adminApp = getApp();
    } else {
      // Passing `{ credential: undefined }` makes the Admin SDK reject the
      // options object outright — which also broke the documented
      // Application Default Credentials path (Cloud Run / Firebase Hosting /
      // GOOGLE_APPLICATION_CREDENTIALS). Only pass options when a credential
      // exists; otherwise let the SDK resolve ADC itself.
      const credential = buildCredential();
      adminApp = initializeApp(credential ? { credential } : {});
    }
  }
  return adminApp;
}

/** Admin Auth (used for custom claims). */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

/** Admin Firestore (bypasses security rules; server-only). */
export function getAdminDb(): Firestore {
  const db = getFirestore(getAdminApp());
  // Prefer timestamps in server snapshots for consistency.
  db.settings = db.settings; // no-op reference to keep types happy
  return db;
}

/** Convert a Firestore Timestamp | null to epoch millis (server side). */
export function tsToMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return null;
}
