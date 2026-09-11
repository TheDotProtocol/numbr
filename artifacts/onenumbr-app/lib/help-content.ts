// =============================================================================
// OneNumbr — Help Center content (Prompt 7)
//
// Static, versioned content covering only functionality that actually exists.
// Demo/mock capabilities are described honestly. Search (lib/help-search.ts)
// operates on this module — no external service, no Firestore reads.
// =============================================================================

export type HelpArticle = {
  slug: string;
  section: HelpSectionId;
  title: string;
  updated: string; // ISO date
  body: HelpBlock[];
};

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "note"; text: string };

export type HelpSectionId =
  | "getting-started"
  | "identity"
  | "number"
  | "esim"
  | "billing"
  | "security"
  | "account";

export const HELP_SECTIONS: { id: HelpSectionId; label: string; blurb: string }[] = [
  { id: "getting-started", label: "Getting Started", blurb: "The basics of OneNumbr." },
  { id: "identity", label: "Identity & KYC", blurb: "Your OneNumbr ID and verification." },
  { id: "number", label: "OneNumbr Number", blurb: "Choosing and managing your number." },
  { id: "esim", label: "eSIM", blurb: "Browsing, buying and activating eSIMs." },
  { id: "billing", label: "Billing", blurb: "Payments, invoices and refunds." },
  { id: "security", label: "Security", blurb: "Sessions, devices and account safety." },
  { id: "account", label: "Account", blurb: "Profile, preferences and lifecycle." },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "what-is-onenumbr",
    section: "getting-started",
    title: "What is OneNumbr?",
    updated: "2026-09-10",
    body: [
      { type: "p", text: "OneNumbr is a global digital identity and connectivity platform built on one idea: one identity, one number, anywhere." },
      { type: "p", text: "Your account has two distinct pieces:" },
      {
        type: "list",
        items: [
          "Your OneNumbr ID (for example ON-284739) — a permanent identity identifier that never changes.",
          "Your OneNumbr Number (for example +1739 284739) — a communications identity you choose in the Number marketplace.",
        ],
      },
      { type: "p", text: "Around those you can verify your identity (KYC), buy eSIM data plans, manage your number, and handle billing — all from one account." },
      {
        type: "note",
        text: "In this environment, eSIM provisioning, number activation and payments run on demo providers. No real charges are made and purchased eSIMs cannot be installed on a device.",
      },
    ],
  },
  {
    slug: "what-is-my-onenumbr-id",
    section: "identity",
    title: "What is my OneNumbr ID?",
    updated: "2026-09-10",
    body: [
      { type: "p", text: "Your OneNumbr ID is a permanent identifier in the form ON-XXXXXX. It is issued automatically when your account is created and never changes — even if you release a number or buy a new one." },
      { type: "steps", items: ["Open the Account Center from the dashboard.", "Your OneNumbr ID is shown in the Identity card.", "You can also find it on the Identity page."] },
      { type: "p", text: "The OneNumbr ID and your OneNumbr Number are separate things. The ID identifies you; the number is a service attached to your identity." },
    ],
  },
  {
    slug: "kyc-verification-pending",
    section: "identity",
    title: "Why is my KYC verification pending?",
    updated: "2026-09-10",
    body: [
      { type: "p", text: "Identity verification is reviewed manually by our team. After you submit your documents, your case moves to a review queue." },
      { type: "p", text: "Common reasons a review takes longer:" },
      {
        type: "list",
        items: [
          "High review volume — cases are handled in order.",
          "Document photos are hard to read — we may ask for a resubmission.",
          "Your name or details don't match across documents.",
        ],
      },
      { type: "p", text: "You'll receive a notification the moment your verification is approved or if we need anything else. Until then, number activation stays locked — this is intentional and keeps your identity safe." },
    ],
  },
  {
    slug: "how-does-number-work",
    section: "number",
    title: "How does a OneNumbr Number work?",
    updated: "2026-09-10",
    body: [
      { type: "p", text: "A OneNumbr Number (for example +1739 284739) is your public communications identity inside OneNumbr. You pick it from the Number marketplace, activate it, and manage it from your dashboard." },
      { type: "p", text: "Key facts:" },
      {
        type: "list",
        items: [
          "Verification (KYC) must be approved before you can activate a number.",
          "Numbers show SMS and Voice capabilities in this environment; actual message and call delivery is a future capability.",
          "You can release a number from its detail page. Releasing keeps your OneNumbr ID untouched, and you can choose a new number later.",
        ],
      },
      {
        type: "note",
        text: "In this environment numbers run on a demo telecom provider and are not connected to the public telephone network.",
      },
    ],
  },
  {
    slug: "activate-esim",
    section: "esim",
    title: "How do I activate an eSIM?",
    updated: "2026-09-10",
    body: [
      { type: "steps", items: ["Browse the eSIM marketplace and choose a country, then a plan.", "Check out — your plan price is confirmed on the server before payment.", "When the order is ready, open the activation page from My eSIMs.", "Follow the iPhone or Android installation guide shown on the activation page."] },
      { type: "p", text: "If provisioning fails, your payment stays recorded and the order shows a clear error with a Retry option available to our team. Nothing is lost." },
      {
        type: "note",
        text: "In this environment eSIM provisioning uses a demo provider: the flow is complete end-to-end, but the produced QR code cannot be installed on a real device.",
      },
    ],
  },
  {
    slug: "view-invoices",
    section: "billing",
    title: "How do I view my invoices?",
    updated: "2026-09-10",
    body: [
      { type: "steps", items: ["Open Billing from the dashboard navigation.", "The Invoices tab lists every invoice with its number (INV-YYYY-######), date and status.", "Select View to open a print-friendly invoice — use your browser's Print to save it as a PDF."] },
      { type: "p", text: "Every purchase — eSIM or Number — creates a payment and a matching invoice automatically. If a payment fails, no invoice is issued and you can retry from the checkout." },
    ],
  },
  {
    slug: "manage-sessions",
    section: "security",
    title: "How do I manage my sessions?",
    updated: "2026-09-10",
    body: [
      { type: "p", text: "The Account Center shows every place your account is signed in." },
      { type: "steps", items: ["Open Account → Sessions.", "Your current browser is marked \"This device\".", "Use Revoke to sign out a single session, or \"Sign out other sessions\" to sign out everywhere else."] },
      { type: "p", text: "Revoked sessions disappear from the list and the device's sign-in ends. You'll also see new sign-ins in your Security Activity timeline." },
      { type: "note", text: "Two-factor authentication isn't available yet — it's on the roadmap and will appear in the Security Center when ready." },
    ],
  },
  {
    slug: "contact-support",
    section: "account",
    title: "How do I contact support?",
    updated: "2026-09-10",
    body: [
      { type: "steps", items: ["Open Support from the dashboard navigation.", "Select New case and pick the category that fits best.", "Describe what happened — add screenshots if it helps.", "Track replies from the case page; we'll also notify you when the team answers."] },
      { type: "p", text: "Picking the right category (Identity, Number, eSIM, Billing, Account, Technical) routes your case faster. You can close a resolved case yourself, and reopen it if the problem returns." },
    ],
  },
  {
    slug: "deactivate-or-delete",
    section: "account",
    title: "How do I deactivate or delete my account?",
    updated: "2026-09-10",
    body: [
      { type: "p", text: "Both controls live in Settings, under Account lifecycle." },
      {
        type: "list",
        items: [
          "Deactivate — signs you out everywhere and pauses the account. You can sign back in to reactivate it. Your data is preserved.",
          "Deletion request — asks our team to delete the account. Financial records (invoices, payments) and audit history are retained where compliance requires it; everything else is removed from your access.",
        ],
      },
      { type: "p", text: "If you have an active number or eSIM, consider releasing or letting them lapse first — deactivation doesn't cancel services automatically." },
    ],
  },
];
