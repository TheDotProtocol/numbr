// =============================================================================
// scripts/seed-numbers.ts — development number inventory
//
// Usage:  npx tsx scripts/seed-numbers.ts
//
// Requires a service account key at the path in FIREBASE_SERVICE_ACCOUNT_KEY
// or GOOGLE_APPLICATION_CREDENTIALS. Clearly-marked MOCK-TELECOM inventory
// only — never run against a production database with real customers.
// =============================================================================

import { readFileSync } from "fs";
import * as admin from "firebase-admin";

function initAdmin() {
  const keyPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    "";
  if (!keyPath) {
    console.error(
      "Set FIREBASE_SERVICE_ACCOUNT_KEY to the path of a service account JSON key.",
    );
    process.exit(1);
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? serviceAccount.project_id,
  });
}

interface SeedNumber {
  onenumbrNumber: string;
  type: "mobile" | "international";
  price: number;
  capabilities: string[];
}

// Development inventory — mock carrier only, no PSTN connectivity implied.
// The "-FAIL" sandbox number exercises the provisioning-failure + admin-retry
// path end to end.
const SEED: SeedNumber[] = [
  { onenumbrNumber: "+1739284739", type: "mobile", price: 5, capabilities: ["SMS", "VOICE"] },
  { onenumbrNumber: "+1739193827", type: "mobile", price: 5, capabilities: ["SMS", "VOICE"] },
  { onenumbrNumber: "+1739582104", type: "mobile", price: 7, capabilities: ["SMS", "VOICE"] },
  { onenumbrNumber: "+1739441928", type: "mobile", price: 5, capabilities: ["SMS"] },
  { onenumbrNumber: "+1739731205", type: "mobile", price: 9, capabilities: ["SMS", "VOICE"] },
  { onenumbrNumber: "+1739604811", type: "mobile", price: 12, capabilities: ["SMS", "VOICE"] },
  { onenumbrNumber: "+1739557042", type: "international", price: 15, capabilities: ["SMS", "VOICE"] },
  { onenumbrNumber: "+1739812336", type: "mobile", price: 4, capabilities: ["SMS"] },
  { onenumbrNumber: "+1739299675", type: "international", price: 19, capabilities: ["SMS", "VOICE"] },
  { onenumbrNumber: "+1739770483", type: "mobile", price: 3, capabilities: ["SMS"] },
  // Sandbox: provisioning always fails deterministically (id contains "-FAIL").
  { onenumbrNumber: "+1739000FAIL", type: "mobile", price: 1, capabilities: ["SMS"] },
];

async function main() {
  initAdmin();
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Guard: skip numbers that already exist (global uniqueness).
  const existing = await db.collection("numbers").get();
  const existingSet = new Set(existing.docs.map((d) => d.data().onenumbrNumber));

  const fresh = SEED.filter((n) => !existingSet.has(n.onenumbrNumber));
  if (fresh.length === 0) {
    console.log("Inventory already seeded — nothing to do.");
    return;
  }

  console.log(`Seeding ${fresh.length} mock numbers into numbers …`);
  const batch = db.batch();
  for (const n of fresh) {
    const isFail = n.onenumbrNumber.includes("FAIL");
    const ref = db.collection("numbers").doc();
    batch.set(ref, {
      onenumbrNumber: n.onenumbrNumber,
      providerNumber: isFail
        ? "MOCK-TELECOM-FAIL-SANDBOX"
        : `MOCK-TELECOM-${ref.id.slice(0, 8).toUpperCase()}`,
      provider: "mock-telecom",
      countryCode: "US",
      region: "OneNumbr Global",
      type: n.type,
      status: "available",
      capabilities: n.capabilities,
      monthlyPrice: n.price,
      currency: "USD",
      uid: null,
      reservedBy: null,
      reservedAt: null,
      reservationExpiresAt: null,
      displayNumber: formatDisplay(n.onenumbrNumber),
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  console.log(
    "Seed complete. Inventory is available for the /app/number marketplace; the -FAIL sandbox number tests failure recovery.",
  );
}

function formatDisplay(onenumbrNumber: string): string {
  const m = /^\+(\d{3,4})(\d{6})$/.exec(onenumbrNumber);
  return m ? `+${m[1]} ${m[2]}` : onenumbrNumber;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
