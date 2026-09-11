// =============================================================================
// OneNumbr — Prompt 17 provider contract tests
//
// Run: npx tsx tests/prompt17-provider.test.ts
//
// These tests exercise the REAL integration foundation with ZERO network calls
// and ZERO paid operations: the adapter is inert unless credentials + flag +
// environment allow, which is exactly the behavior under test.
// =============================================================================

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    console.log(`  ✗ ${name}`);
  }
}

function setEnv(vars: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

async function main(): Promise<void> {
  const BASE_ENV: Record<string, string | undefined> = {
    ONENUMBR_ENV: "development",
    FEATURE_CLOUD_COMMUNICATIONS_PROVIDER_ENABLED: undefined,
    CLOUD_COMMS_PROVIDER_ID: undefined,
    CLOUD_COMMS_API_KEY: undefined,
    CLOUD_COMMS_API_SECRET: undefined,
    CLOUD_COMMS_WEBHOOK_SECRET: undefined,
    CLOUD_COMMS_CAPABILITIES: undefined,
    CLOUD_COMMS_SANDBOX_MODE: undefined,
  };

  // ---------------------------------------------------------------------------
  // 1. Adapter configuration states
  // ---------------------------------------------------------------------------

  console.log("\n[1] Adapter configuration states");

  await test("no credentials → inert adapter (not_configured, mock stays operational)", async () => {
    setEnv({ ...BASE_ENV });
    const { createCloudCommunicationsAdapter } = await import("@/providers/communications/real/adapter");
    const adapter = createCloudCommunicationsAdapter();
    assert.equal(adapter.operational, false);
    assert.equal(adapter.configState, "not_configured");
    const health = await adapter.healthCheck();
    assert.equal(health.status, "not_configured");
  });

  await test("credentials without flag → configured but disabled (no live ops)", async () => {
    setEnv({
      ...BASE_ENV,
      ONENUMBR_ENV: "production",
      CLOUD_COMMS_PROVIDER_ID: "vendor-a",
      CLOUD_COMMS_API_KEY: "test-key",
      CLOUD_COMMS_API_SECRET: "test-secret",
      CLOUD_COMMS_CAPABILITIES: "sms,voice",
    });
    const { createCloudCommunicationsAdapter } = await import("@/providers/communications/real/adapter");
    const adapter = createCloudCommunicationsAdapter();
    assert.equal(adapter.operational, false, "flag off must keep the adapter non-operational");
    const health = await adapter.healthCheck();
    assert.ok(["disabled", "not_configured"].includes(health.status));
  });

  await test("credentials + flag in development → provider-mode guard refuses", async () => {
    setEnv({
      ...BASE_ENV,
      ONENUMBR_ENV: "development",
      FEATURE_CLOUD_COMMUNICATIONS_PROVIDER_ENABLED: "true",
      CLOUD_COMMS_PROVIDER_ID: "vendor-a",
      CLOUD_COMMS_API_KEY: "test-key",
      CLOUD_COMMS_API_SECRET: "test-secret",
      CLOUD_COMMS_CAPABILITIES: "sms,voice",
    });
    const { createCloudCommunicationsAdapter } = await import("@/providers/communications/real/adapter");
    const adapter = createCloudCommunicationsAdapter();
    assert.equal(adapter.operational, false, "development must never run the real adapter");
  });

  await test("credentials + flag in production → operational, capabilities honored", async () => {
    setEnv({
      ...BASE_ENV,
      ONENUMBR_ENV: "production",
      FEATURE_CLOUD_COMMUNICATIONS_PROVIDER_ENABLED: "true",
      CLOUD_COMMS_PROVIDER_ID: "vendor-a",
      CLOUD_COMMS_API_KEY: "test-key",
      CLOUD_COMMS_API_SECRET: "test-secret",
      CLOUD_COMMS_CAPABILITIES: "sms",
    });
    const { createCloudCommunicationsAdapter } = await import("@/providers/communications/real/adapter");
    const adapter = createCloudCommunicationsAdapter();
    assert.equal(adapter.operational, true);
    assert.equal(adapter.capabilities.sms, true);
    assert.equal(adapter.capabilities.voice, false, "undeclared capability must stay false — never inferred");
  });

  // ---------------------------------------------------------------------------
  // 2. Capability gating + honest refusals
  // ---------------------------------------------------------------------------

  console.log("\n[2] Capability gating");

  await test("operations on an unconfigured adapter are refused BEFORE any vendor call", async () => {
    setEnv({ ...BASE_ENV });
    const { createCloudCommunicationsAdapter } = await import("@/providers/communications/real/adapter");
    const adapter = createCloudCommunicationsAdapter();
    await assert.rejects(() => adapter.sendSmsIdempotent({ idempotencyKey: "k", fromNumberRef: "n", to: "+1000", body: "x" }), /not configured/i);
    await assert.rejects(() => adapter.initiateCallIdempotent({ idempotencyKey: "k", fromNumberRef: "n", to: "+1000" }), /not configured/i);
  });

  await test("vendor calls remain unimplemented boundaries (no accidental paid ops)", async () => {
    setEnv({
      ...BASE_ENV,
      ONENUMBR_ENV: "production",
      FEATURE_CLOUD_COMMUNICATIONS_PROVIDER_ENABLED: "true",
      CLOUD_COMMS_PROVIDER_ID: "vendor-a",
      CLOUD_COMMS_API_KEY: "test-key",
      CLOUD_COMMS_API_SECRET: "test-secret",
      CLOUD_COMMS_CAPABILITIES: "sms,voice",
    });
    const { createCloudCommunicationsAdapter } = await import("@/providers/communications/real/adapter");
    const adapter = createCloudCommunicationsAdapter();
    await assert.rejects(
      () => adapter.sendSmsIdempotent({ idempotencyKey: "k1", fromNumberRef: "n", to: "+1000", body: "x" }),
      (err: unknown) => (err as { vendorCode?: string | null }).vendorCode === "onenumbr_vendor_not_implemented",
    );
  });

  // ---------------------------------------------------------------------------
  // 3. Service gate (flag/guard/capability ordering)
  // ---------------------------------------------------------------------------

  console.log("\n[3] Cloud comms service gate");

  await test("service refuses with flag_off before touching the adapter", async () => {
    setEnv({ ...BASE_ENV });
    const { evaluateCloudCommsGate } = await import("@/lib/cloud-comms-service");
    const gate = evaluateCloudCommsGate("sms");
    assert.equal(gate.allowed, false);
    assert.equal((gate as { code?: string }).code, "flag_off");
  });

  // ---------------------------------------------------------------------------
  // 4. Webhook verification, replay + durable idempotency semantics
  // ---------------------------------------------------------------------------

  console.log("\n[4] Webhook foundation");

  await test("webhook signature verification rejects missing/bad signatures", async () => {
    setEnv({ ...BASE_ENV });
    const { verifyProviderWebhookSignature } = await import("@/lib/webhooks-server");
    assert.equal(verifyProviderWebhookSignature({ rawBody: "{}", signatureHeader: null, secret: "s", scheme: "hmac-sha256" }), false);
    assert.equal(verifyProviderWebhookSignature({ rawBody: "{}", signatureHeader: "deadbeef", secret: "s", scheme: "hmac-sha256" }), false);
  });

  await test("webhook timestamp validation enforces the replay window", async () => {
    setEnv({ ...BASE_ENV });
    const { validateProviderWebhookTimestamp } = await import("@/lib/webhooks-server");
    const fresh = validateProviderWebhookTimestamp({ providerTimestamp: new Date(Date.now() - 60_000).toISOString() });
    assert.ok(typeof fresh === "string");
    assert.throws(() => validateProviderWebhookTimestamp({ providerTimestamp: new Date(Date.now() - 30 * 60_000).toISOString() }));
  });

  // ---------------------------------------------------------------------------
  // 5. Error normalization + retry classification
  // ---------------------------------------------------------------------------

  console.log("\n[5] Error normalization + retry");

  await test("provider errors normalize into the OneNumbr taxonomy", async () => {
    setEnv({ ...BASE_ENV });
    const { normalizeProviderErrorCategory } = await import("@/lib/provider-retry");
    assert.equal(normalizeProviderErrorCategory({ message: "401 unauthorized" }), "authentication");
    assert.equal(normalizeProviderErrorCategory({ message: "429 too many requests" }), "rate_limited");
    assert.equal(normalizeProviderErrorCategory({ message: "503 service unavailable" }), "transient");
    assert.equal(normalizeProviderErrorCategory({ message: "409 already exists" }), "conflict");
    assert.equal(normalizeProviderErrorCategory({ message: "weird vendor text" }), "permanent");
  });

  await test("retry runs only for transient/rate_limited AND idempotent operations", async () => {
    setEnv({ ...BASE_ENV });
    const { withProviderRetry } = await import("@/lib/provider-retry");

    // Idempotent + transient → retries then succeeds.
    let calls = 0;
    const ok = await withProviderRetry(
      async () => {
        calls++;
        if (calls < 3) throw Object.assign(new Error("boom"), { category: "transient" });
        return "done";
      },
      { idempotent: true, baseDelayMs: 1, maxDelayMs: 2 },
    );
    assert.equal(ok, "done");
    assert.equal(calls, 3);

    // Non-idempotent + transient → NO retry (single attempt, then throws).
    calls = 0;
    await assert.rejects(
      withProviderRetry(
        async () => {
          calls++;
          throw Object.assign(new Error("boom"), { category: "transient" });
        },
        { idempotent: false, baseDelayMs: 1 },
      ),
    );
    assert.equal(calls, 1, "non-idempotent operations must never be auto-retried");

    // Permanent error → immediate throw even when idempotent.
    calls = 0;
    await assert.rejects(
      withProviderRetry(
        async () => {
          calls++;
          throw Object.assign(new Error("bad request"), { category: "permanent" });
        },
        { idempotent: true, baseDelayMs: 1 },
      ),
    );
    assert.equal(calls, 1);
  });

  // ---------------------------------------------------------------------------
  // 6. Provider-mode guard regression (Prompt 10 intact)
  // ---------------------------------------------------------------------------

  console.log("\n[6] Provider-mode guard regression");

  await test("Prompt 10 guard still refuses mock-in-production without acknowledgement", async () => {
    setEnv({ ...BASE_ENV, ONENUMBR_ENV: "production" });
    const { assertProviderModeAllowed } = await import("@/lib/features");
    assert.throws(() => assertProviderModeAllowed("esim"), /Refusing to run/i);
    process.env.ONENUMBR_ALLOW_DEMO_IN_PRODUCTION = "true";
    assert.doesNotThrow(() => assertProviderModeAllowed("esim"));
    delete process.env.ONENUMBR_ALLOW_DEMO_IN_PRODUCTION;
  });

  // ---------------------------------------------------------------------------
  // 7. Immutability invariant (mandatory §28)
  // ---------------------------------------------------------------------------

  console.log("\n[7] Provider-swap immutability");

  await test("real adapter layer never writes identity/number/plan collections", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files = [
      "providers/communications/real/types.ts",
      "providers/communications/real/adapter.ts",
      "lib/cloud-comms-service.ts",
      "lib/webhook-idempotency.ts",
      "lib/provider-retry.ts",
    ];
    const forbidden = /onenumbr_ids|number_assignments|subscriptions\b/;
    let violations = 0;
    for (const f of files) {
      const content = fs.readFileSync(path.resolve(process.cwd(), f), "utf8");
      // The only permitted match is inside comments describing the invariant.
      const codeOnly = content
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      if (forbidden.test(codeOnly)) violations++;
    }
    assert.equal(violations, 0, "provider infrastructure must never touch identity/number/plan collections");
  });

  await test("adapter refuses to own the OneNumbr identity: no vendor number becomes +1739 numbering", async () => {
    setEnv({
      ...BASE_ENV,
      ONENUMBR_ENV: "production",
      FEATURE_CLOUD_COMMUNICATIONS_PROVIDER_ENABLED: "true",
      CLOUD_COMMS_PROVIDER_ID: "vendor-a",
      CLOUD_COMMS_API_KEY: "test-key",
      CLOUD_COMMS_API_SECRET: "test-secret",
      CLOUD_COMMS_CAPABILITIES: "numbering",
    });
    const { createCloudCommunicationsAdapter } = await import("@/providers/communications/real/adapter");
    const adapter = createCloudCommunicationsAdapter();
    // The adapter exposes numbering as a capability — but exposes no method that
    // could reassign the OneNumbr identity or redefine +1739 as official PSTN
    // numbering. Structural check: the adapter surface carries only comm + health
    // operations.
    const surface = Object.keys(adapter);
    for (const forbidden of ["assignIdentity", "setOneNumbrNumber", "claimCountryCode", "portIdentity"]) {
      assert.ok(!surface.includes(forbidden), `adapter must not expose ${forbidden}`);
    }
    void adapter;
  });

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  console.log(`\n=== Prompt 17 contract tests: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    for (const f of failures) console.log(`  FAILED: ${f}`);
    process.exit(1);
  }

}

void main();
