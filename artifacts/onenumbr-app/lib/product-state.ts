// =============================================================================
// OneNumbr — Product state engine (presentation layer, Prompt 9)
//
// Deterministic derivation of journey state + next-best-action from the
// account summary. NOT AI. Never duplicates authoritative backend state —
// it only interprets AccountSummary for presentation.
//
// Rules for actions: every action must map to a real, reachable workflow.
// Billing issues are intentionally NOT surfaced here yet — the summary does
// not carry outstanding-invoice data, so no fake "resolve billing" CTA.
// =============================================================================

import type { AccountSummary } from "@/types/account";

// ---------------------------------------------------------------------------
// Journey states — where the user is in their OneNumbr journey
// ---------------------------------------------------------------------------

export type JourneyState =
  | "attention_required" // suspended / deletion requested / deactivated
  | "verification_pending" // email unverified
  | "verification_required" // KYC not started
  | "verification_in_progress" // KYC submitted / resubmission required
  | "number_required" // KYC verified, no number
  | "plan_paused" // number active, plan paused (Prompt 13)
  | "plan_cancelled" // number active, plan cancelled (Prompt 13)
  | "connectivity_required" // number active, no eSIM
  | "account_ready"; // everything set up

export function getAccountJourneyState(s: AccountSummary): JourneyState {
  if (s.accountState !== "active") return "attention_required";
  if (!s.security.emailVerified) return "verification_pending";
  if (s.kycState === "resubmission_required" || s.kycState === "rejected") return "verification_in_progress";
  if (s.kycState !== "verified") return "verification_required";
  if (!s.number) return "number_required";
  // Plan-aware states (Prompt 13): the plan rides number activation, so a
  // paused/cancelled plan with an active number is its own gentle state.
  if (s.plan.status === "paused") return "plan_paused";
  if (s.plan.status === "cancelled") return "plan_cancelled";
  if (!s.esim) return "connectivity_required";
  return "account_ready";
}

// ---------------------------------------------------------------------------
// Next best action — ONE dominant recommendation, deterministic
// ---------------------------------------------------------------------------

export type NextBestAction = {
  /** Short imperative headline. */
  title: string;
  /** Why it matters / what happens next — human language. */
  explanation: string;
  /** Where the action lives. */
  href: string;
  /** Button copy. */
  cta: string;
  /** Journey weight — informational states render without a strong CTA. */
  informational?: boolean;
};

export function getNextBestAction(s: AccountSummary): NextBestAction {
  const journey = getAccountJourneyState(s);

  switch (journey) {
    case "attention_required":
      return {
        title: "Your account needs attention",
        explanation:
          s.accountState === "deletion_requested"
            ? "A deletion request is in progress. You can keep using OneNumbr until it is processed — contact support if this wasn't you."
            : "Your account is currently limited. Contact support to restore full access.",
        href: "/app/support",
        cta: "Contact support",
      };
    case "verification_pending":
      return {
        title: "Verify your email",
        explanation: "Your email address confirms your account and unlocks everything else.",
        href: "/verify-email",
        cta: "Verify email",
      };
    case "verification_required":
      return {
        title: "Verify your identity",
        explanation:
          "A quick verification keeps your identity safe and unlocks your OneNumbr Number.",
        href: "/app/identity",
        cta: "Start verification",
      };
    case "verification_in_progress":
      return {
        title:
          s.kycState === "resubmission_required"
            ? "Your verification needs a small fix"
            : "Your verification is being reviewed",
        explanation:
          s.kycState === "resubmission_required"
            ? "We couldn't accept your documents as they were — a quick resubmission usually resolves it."
            : "Our team is reviewing your documents. No action needed — we'll notify you the moment it's done.",
        href: "/app/identity",
        cta: "Review verification",
        informational: s.kycState !== "resubmission_required",
      };
    case "number_required":
      return {
        title: "Choose your OneNumbr Number",
        explanation:
          "Your number is how people reach you. Pick one that feels like yours.",
        href: "/app/number",
        cta: "Choose a number",
      };
    case "connectivity_required":
      return {
        title: "Get connected with an eSIM",
        explanation:
          "Your number is active. Add an eSIM to stay connected wherever you go.",
        href: "/app/esim",
        cta: "Explore eSIMs",
      };
    case "account_ready":
      return {
        title: "Your OneNumbr is ready",
        explanation: "Identity verified, number active, eSIM connected. All good.",
        href: "/app/account",
        cta: "View account",
        informational: true,
      };
    case "plan_paused":
      return {
        title: "Your plan is paused",
        explanation:
          "Your number and identity are untouched — reactivate to restore plan benefits like communications and endpoints.",
        href: "/app/billing/plan",
        cta: "Review plan",
      };
    case "plan_cancelled":
      return {
        title: "Your plan was cancelled",
        explanation:
          "Your OneNumbr ID and number are still yours. Reactivate your plan to restore full access.",
        href: "/app/billing/plan",
        cta: "Reactivate plan",
      };
  }
}

// ---------------------------------------------------------------------------
// Human state messaging — WHAT HAPPENED / WHAT IT MEANS / WHAT'S NEXT
// ---------------------------------------------------------------------------

export type StateExplanation = {
  /** What happened (headline). */
  headline: string;
  /** What it means (one sentence). */
  meaning: string;
  /** What happens next (no invented times). */
  next: string;
};

/** Map any raw backend status onto a human explanation. */
export function explainState(domain: "kyc" | "esim" | "number" | "payment", status: string): StateExplanation {
  switch (domain) {
    case "kyc":
      switch (status) {
        case "pending":
        case "submitted":
          return {
            headline: "Your identity verification is being reviewed",
            meaning: "Your documents have been submitted and are with our review team.",
            next: "You don't need to do anything right now — we'll notify you when it's complete.",
          };
        case "resubmission_required":
          return {
            headline: "Your verification needs one more step",
            meaning: "We couldn't accept your documents as they were.",
            next: "Resubmit with the requested changes — reviews are usually quicker the second time.",
          };
        case "rejected":
          return {
            headline: "Your verification wasn't approved",
            meaning: "We couldn't verify your identity from the documents provided.",
            next: "You can start a new verification, or contact support if you think this is a mistake.",
          };
        case "verified":
        case "approved":
          return {
            headline: "You're verified",
            meaning: "Your identity is confirmed and all OneNumbr services are unlocked.",
            next: "Choose your OneNumbr Number whenever you're ready.",
          };
        default:
          return {
            headline: "Identity verification isn't started yet",
            meaning: "Verification keeps your identity safe and unlocks more of OneNumbr.",
            next: "Start whenever you're ready — it only takes a few minutes.",
          };
      }
    case "esim":
      switch (status) {
        case "provisioning":
          return {
            headline: "Your eSIM is being prepared",
            meaning: "We're generating your activation details.",
            next: "Keep this page open or come back later — we'll notify you when it's ready.",
          };
        case "ready":
          return {
            headline: "Your eSIM is ready to install",
            meaning: "Your activation details have been generated.",
            next: "Follow the installation guide to add it to your device.",
          };
        case "active":
          return {
            headline: "Your eSIM is active",
            meaning: "Everything is set up on your account.",
            next: "Manage it any time from My eSIMs.",
          };
        case "failed":
          return {
            headline: "We couldn't prepare your eSIM",
            meaning: "Something went wrong on our side — your payment (if made) is recorded.",
            next: "Our team can retry activation, or you can reach out to support.",
          };
        default:
          return {
            headline: "Your eSIM status has changed",
            meaning: "",
            next: "Open the eSIM details for the latest information.",
          };
      }
    case "number":
      switch (status) {
        case "reserved":
          return {
            headline: "Your number is reserved for you",
            meaning: "It's held for this session so nobody else can take it.",
            next: "Complete checkout to make it yours.",
          };
        case "active":
          return {
            headline: "Your OneNumbr Number is active",
            meaning: "This is your public communications identity.",
            next: "Manage it from the number details page.",
          };
        case "released":
          return {
            headline: "Your number was released",
            meaning: "It may no longer be available if you change your mind.",
            next: "You can choose a new number any time — your OneNumbr ID stays the same.",
          };
        default:
          return {
            headline: "Your number status has changed",
            meaning: "",
            next: "Open the number details for the latest information.",
          };
      }
    case "payment":
      switch (status) {
        case "pending":
        case "payment_pending":
          return {
            headline: "Your payment is waiting to be completed",
            meaning: "The checkout wasn't finished.",
            next: "Complete the payment from your orders page — nothing has been charged yet.",
          };
        case "paid":
          return {
            headline: "Your payment was successful",
            meaning: "The amount has been recorded on your account.",
            next: "A receipt is available in Billing → Invoices.",
          };
        case "failed":
          return {
            headline: "Your payment wasn't completed",
            meaning: "You have not been charged.",
            next: "You can try again from checkout.",
          };
        case "refunded":
          return {
            headline: "Your refund was processed",
            meaning: "The refunded amount is on its way back to your original payment method.",
            next: "It appears in Billing → Transactions.",
          };
        default:
          return {
            headline: "Your payment status has changed",
            meaning: "",
            next: "Open Billing for the latest information.",
          };
      }
  }
}

// ---------------------------------------------------------------------------
// Analytics extension point (Prompt 9) — NO provider integrated.
// A future provider implements `track` and registers here; nothing else in
// the app changes. Events carry no personal data beyond the event name.
// ---------------------------------------------------------------------------

export type ProductEvent =
  | "onboarding_started"
  | "onboarding_completed"
  | "kyc_started"
  | "kyc_submitted"
  | "number_viewed"
  | "number_reserved"
  | "number_purchased"
  | "esim_viewed"
  | "esim_purchased"
  | "esim_activated"
  | "billing_viewed"
  | "support_ticket_created";

type ProductEventSink = (event: ProductEvent) => void;

const sinks: ProductEventSink[] = [];

/** Register an analytics sink (no-op until a real provider exists). */
export function registerProductEventSink(sink: ProductEventSink): () => void {
  sinks.push(sink);
  return () => {
    const i = sinks.indexOf(sink);
    if (i >= 0) sinks.splice(i, 1);
  };
}

/** Track a product event. Currently a documented no-op sink. */
export function trackProductEvent(event: ProductEvent): void {
  for (const sink of sinks) {
    try {
      sink(event);
    } catch {
      // analytics must never break the product
    }
  }
}
