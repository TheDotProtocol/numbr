// =============================================================================
// OneNumbr — Admin bootstrap script
//
// Grants the admin custom claim + Firestore role to the first admin(s).
//
// Usage:
//   1. Put the target email(s) in ADMIN_EMAILS (comma-separated) in .env.local
//      (or pass them as CLI arguments).
//   2. Ensure FIREBASE_SERVICE_ACCOUNT_JSON (or
//      GOOGLE_APPLICATION_CREDENTIALS) is set.
//   3. Run:  pnpm --filter @workspace/onenumbr-app set-admin
//
// Only run this against accounts you control. Audit-logged.
// =============================================================================

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { writeAuditLog } from "@/lib/audit-server";

function init() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    const json = JSON.parse(raw) as {
      project_id?: string;
      private_key?: string;
      client_email?: string;
    };
    const privateKey = json.private_key?.includes("\\n")
      ? json.private_key.replace(/\\n/g, "\n")
      : json.private_key;
    initializeApp({
      credential: cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey,
      }),
    });
  } else {
    // GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
    initializeApp();
  }
}

async function main() {
  const cliEmails = process.argv.slice(2);
  const envEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const emails = [
    ...cliEmails.map((e) => e.trim().toLowerCase()),
    ...envEmails,
  ].filter(Boolean);

  if (emails.length === 0) {
    console.error(
      "No admin emails provided. Set ADMIN_EMAILS in .env.local or pass emails as arguments.",
    );
    process.exit(1);
  }

  init();
  const auth = getAuth();
  const db = getFirestore();

  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { role: "admin" });
      await db.collection("users").doc(user.uid).set(
        { role: "admin", updatedAt: new Date() },
        { merge: true },
      );
      await writeAuditLog({
        actorUid: user.uid,
        action: "user.role_changed",
        targetUid: user.uid,
        metadata: { to: "admin", via: "set-admin script" },
      });
      console.log(`✓ ${email} (${user.uid}) is now an admin.`);
      console.log("  The user must sign out and sign in again to receive the claim.");
    } catch (err) {
      console.error(
        `✗ ${email}: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exitCode = 1;
    }
  }
}

void main();
