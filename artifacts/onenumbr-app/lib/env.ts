// =============================================================================
// OneNumbr — Environment configuration
//
// Client config comes from NEXT_PUBLIC_* vars (safe to expose — protected by
// security rules). Server credentials come from FIREBASE_SERVICE_ACCOUNT_JSON
// or GOOGLE_APPLICATION_CREDENTIALS and are NEVER sent to the client.
// =============================================================================

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readEnv(name: string): string {
  // Next.js inlines NEXT_PUBLIC_* into the client bundle at build time; on the
  // server the same vars are available via process.env.
  if (typeof process !== "undefined" && process.env) {
    return process.env[name] ?? "";
  }
  return "";
}

function isConfigured(value: string): boolean {
  return value.length > 0 && !value.startsWith("placeholder");
}

/** Firebase web app config used by the client SDK. */
export const firebaseConfig: FirebaseClientConfig = {
  apiKey: readEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

/** True when real (non-placeholder) Firebase credentials are present. */
export function isFirebaseConfigured(): boolean {
  return (
    isConfigured(firebaseConfig.apiKey) &&
    isConfigured(firebaseConfig.projectId) &&
    isConfigured(firebaseConfig.appId)
  );
}

/**
 * Detects at runtime whether we're running against the Firebase Emulator
 * Suite (useful for local development without touching production data).
 */
export function isEmulatorEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true"
  );
}
