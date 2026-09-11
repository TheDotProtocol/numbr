// =============================================================================
// scripts/seed-esim-plans.ts — development seed catalog
//
// Usage:  node --experimental-strip-types scripts/seed-esim-plans.ts
//         (or: npx tsx scripts/seed-esim-plans.ts)
//
// Requires a service account key at the path in GOOGLE_APPLICATION_CREDENTIALS
// or FIREBASE_SERVICE_ACCOUNT_KEY. Clearly-marked DEMO plans only — never run
// against a production database with real customers.
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

interface SeedPlan {
  countryCode: string;
  countryName: string;
  region: string;
  flag: string;
  planName: string;
  dataAmount: number;
  dataUnit: "GB" | "MB";
  durationDays: number;
  speed: string;
  networkType: string;
  coverage: string;
  hotspot: boolean;
  activationPolicy: string;
  price: number;
  currency: string;
  wholesaleCost: number;
  margin: number;
  status: "active" | "inactive" | "archived" | "failed_test";
  featured: boolean;
  sortOrder: number;
}

// Development catalog — clearly demo pricing, no live service implied.
const SEED: SeedPlan[] = [
  { countryCode: "JP", countryName: "Japan", region: "Asia", flag: "🇯🇵", planName: "Japan Explorer", dataAmount: 20, dataUnit: "GB", durationDays: 30, speed: "5G / LTE", networkType: "5G / LTE", coverage: "Nationwide (docomo, SoftBank, au)", hotspot: true, activationPolicy: "Validity starts on activation", price: 19, currency: "USD", wholesaleCost: 11, margin: 8, status: "active", featured: true, sortOrder: 10 },
  { countryCode: "JP", countryName: "Japan", region: "Asia", flag: "🇯🇵", planName: "Japan Light", dataAmount: 5, dataUnit: "GB", durationDays: 15, speed: "LTE", networkType: "LTE", coverage: "Nationwide", hotspot: true, activationPolicy: "Validity starts on activation", price: 9, currency: "USD", wholesaleCost: 5, margin: 4, status: "active", featured: false, sortOrder: 11 },
  { countryCode: "US", countryName: "United States", region: "North America", flag: "🇺🇸", planName: "USA Connect", dataAmount: 15, dataUnit: "GB", durationDays: 30, speed: "5G / LTE", networkType: "5G / LTE", coverage: "Nationwide (AT&T, T-Mobile)", hotspot: true, activationPolicy: "Validity starts on activation", price: 24, currency: "USD", wholesaleCost: 14, margin: 10, status: "active", featured: true, sortOrder: 20 },
  { countryCode: "US", countryName: "United States", region: "North America", flag: "🇺🇸", planName: "USA Starter", dataAmount: 3, dataUnit: "GB", durationDays: 7, speed: "LTE", networkType: "LTE", coverage: "Nationwide", hotspot: false, activationPolicy: "Validity starts on activation", price: 7, currency: "USD", wholesaleCost: 4, margin: 3, status: "active", featured: false, sortOrder: 21 },
  { countryCode: "IN", countryName: "India", region: "Asia", flag: "🇮🇳", planName: "India Go", dataAmount: 10, dataUnit: "GB", durationDays: 30, speed: "4G / LTE", networkType: "LTE", coverage: "Nationwide", hotspot: true, activationPolicy: "Validity starts on activation", price: 11, currency: "USD", wholesaleCost: 6, margin: 5, status: "active", featured: false, sortOrder: 30 },
  { countryCode: "TH", countryName: "Thailand", region: "Asia", flag: "🇹🇭", planName: "Thailand Discovery", dataAmount: 10, dataUnit: "GB", durationDays: 15, speed: "5G / LTE", networkType: "5G / LTE", coverage: "Nationwide (AIS, DTAC)", hotspot: true, activationPolicy: "Validity starts on activation", price: 12, currency: "USD", wholesaleCost: 7, margin: 5, status: "active", featured: true, sortOrder: 40 },
  { countryCode: "SG", countryName: "Singapore", region: "Asia", flag: "🇸🇬", planName: "Singapore City", dataAmount: 8, dataUnit: "GB", durationDays: 10, speed: "5G", networkType: "5G", coverage: "Nationwide", hotspot: true, activationPolicy: "Validity starts on activation", price: 10, currency: "USD", wholesaleCost: 6, margin: 4, status: "active", featured: false, sortOrder: 50 },
  { countryCode: "VN", countryName: "Vietnam", region: "Asia", flag: "🇻🇳", planName: "Vietnam Travel", dataAmount: 6, dataUnit: "GB", durationDays: 15, speed: "LTE", networkType: "LTE", coverage: "Nationwide", hotspot: true, activationPolicy: "Validity starts on activation", price: 8, currency: "USD", wholesaleCost: 4, margin: 4, status: "active", featured: false, sortOrder: 60 },
  { countryCode: "GB", countryName: "United Kingdom", region: "Europe", flag: "🇬🇧", planName: "UK Explorer", dataAmount: 12, dataUnit: "GB", durationDays: 30, speed: "5G / LTE", networkType: "5G / LTE", coverage: "Nationwide (EE, O2, Vodafone)", hotspot: true, activationPolicy: "Validity starts on activation", price: 17, currency: "USD", wholesaleCost: 10, margin: 7, status: "active", featured: false, sortOrder: 70 },
  { countryCode: "EU", countryName: "Europe", region: "Europe", flag: "🇪🇺", planName: "Europe Regional 39", dataAmount: 10, dataUnit: "GB", durationDays: 14, speed: "5G / LTE", networkType: "5G / LTE", coverage: "39 European countries", hotspot: true, activationPolicy: "Validity starts on first network use", price: 22, currency: "USD", wholesaleCost: 13, margin: 9, status: "active", featured: true, sortOrder: 80 },
  { countryCode: "AU", countryName: "Australia", region: "Oceania", flag: "🇦🇺", planName: "Australia Wide", dataAmount: 10, dataUnit: "GB", durationDays: 30, speed: "5G / LTE", networkType: "5G / LTE", coverage: "Nationwide (Telstra, Optus)", hotspot: true, activationPolicy: "Validity starts on activation", price: 16, currency: "USD", wholesaleCost: 9, margin: 7, status: "active", featured: false, sortOrder: 90 },
  { countryCode: "KR", countryName: "South Korea", region: "Asia", flag: "🇰🇷", planName: "Korea Connect", dataAmount: 8, dataUnit: "GB", durationDays: 10, speed: "5G / LTE", networkType: "5G / LTE", coverage: "Nationwide (SKT, KT)", hotspot: true, activationPolicy: "Validity starts on activation", price: 11, currency: "USD", wholesaleCost: 6, margin: 5, status: "active", featured: false, sortOrder: 100 },
  // Failure-test plan: keep inactive in normal dev; admin can activate it to
  // exercise the provisioning-failure + admin-retry path end to end.
  { countryCode: "XX", countryName: "Test Sandbox", region: "Test", flag: "🧪", planName: "Provisioning Failure Test", dataAmount: 1, dataUnit: "GB", durationDays: 1, speed: "LTE", networkType: "LTE", coverage: "None — forces provider failure", hotspot: false, activationPolicy: "N/A", price: 1, currency: "USD", wholesaleCost: 0, margin: 1, status: "inactive", featured: false, sortOrder: 999 },
];

async function main() {
  initAdmin();
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  console.log(`Seeding ${SEED.length} demo plans into esim_plans …`);
  const batch = db.batch();
  for (const p of SEED) {
    const isFailureTest = p.status === "failed_test";
    const ref = db.collection("esim_plans").doc();
    batch.set(ref, {
      ...p,
      status: isFailureTest ? "inactive" : p.status,
      provider: "mock",
      // The sandbox plan's providerPlanId carries the deterministic FAIL
      // trigger used by MockEsimProvider.provisionEsim.
      providerPlanId: isFailureTest ? "MOCK-FAIL-PROVISION" : `MOCK-${ref.id.slice(0, 8).toUpperCase()}`,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  console.log("Seed complete. Demo catalog is active; failure-test plan is created inactive.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
