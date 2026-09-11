# OneNumbr — Feature Flags (Prompt 10)

Server-readable flags in `lib/features.ts` (`getFeatureFlags()`), driven by
environment variables. The UI never reads flags directly — server APIs expose
honest state (e.g. `/api/health`, `twoFactorAvailable` in the security
center). Flags are the single switchboard for provider swaps and maintenance.

## Flag reference

| Env var | Flag | Default | Purpose |
|---|---|---|---|
| `FEATURE_MANUAL_KYC` | `manualKyc` | on | Manual KYC review (implemented, Prompt 2). |
| `FEATURE_SUMSUB` | `sumsub` | off | Future Sumsub identity provider. |
| `FEATURE_STRIPE_PAYMENTS` | `stripePayments` | off | Future Stripe provider (Prompt 5 abstraction ready). |
| `FEATURE_REAL_TELECOM` | `realTelecom` | off | Future real carrier (Prompt 4 abstraction ready). |
| `FEATURE_REAL_ESIM` | `realEsim` | off | Future real eSIM provider (Prompt 3 abstraction ready). |
| `FEATURE_TWO_FACTOR` | `twoFactor` | off | Future real 2FA provider (Prompt 6 interface ready). |
| `FEATURE_ANALYTICS` | `analytics` | off | Future product analytics (Prompt 9 sink registration point). |
| `FEATURE_SUPPORT_CHAT` | `supportChat` | off | Future in-app live chat. |
| `FEATURE_COMMUNICATIONS_DISABLED` | `communicationsEnabled` | on | Communications domain (Prompt 11). |
| `FEATURE_VOICE_DISABLED` | `voiceEnabled` | on (demo) | Voice via mock provider only. |
| `FEATURE_MESSAGING_DISABLED` | `messagingEnabled` | on (demo) | Application messaging via mock provider. |
| `FEATURE_VOICEMAIL_DISABLED` | `voicemailEnabled` | on (demo) | Voicemail via mock provider. |
| `FEATURE_CONNECTIVITY_DISABLED` | `connectivityEnabled` | on | Connectivity abstraction (eSIM today). |
| `FEATURE_PSTN_ENABLED` | `pstnEnabled` | **off** | Requires a legitimate carrier/numbering arrangement. |
| `FEATURE_TAUCORE_ENABLED` | `tauCoreIntegrationEnabled` | **off** | Future TauCore integration boundary. |
| `FEATURE_ENDPOINTS_DISABLED` | `endpointsEnabled` | on | Endpoint layer (Prompt 12) — registration, lifecycle, routing. |
| `FEATURE_TAUPHONE_ENDPOINT_DISABLED` | `tauPhoneEndpointEnabled` | on (demo) | TauPhone endpoint type (mock provider). |
| `FEATURE_TAUTALK_ENDPOINT_DISABLED` | `tauTalkEndpointEnabled` | on (demo) | TauTalk endpoint type (mock provider). |
| `FEATURE_ENDPOINT_PRESENCE_DISABLED` | `endpointPresenceEnabled` | on | Endpoint presence/availability (application-layer). |
| `FEATURE_ENDPOINT_ROUTING_DISABLED` | `endpointRoutingEnabled` | on | Endpoint routing simulation. |
| `FEATURE_ENDPOINT_REAL_TAUCORE` | `endpointRealTauCoreEnabled` | **off** | Future real TauCore client integration (never demo). |
| `FEATURE_GLOBAL_PLAN_DISABLED` | `globalPlanEnabled` | on | Global Plan domain (Prompt 13). |
| `FEATURE_ENTITLEMENTS_DISABLED` | `entitlementsEnabled` | on | Entitlement gates on communications/endpoints (Prompt 13). |
| `FEATURE_CONNECTIVITY_CLOUD_DISABLED` | `connectivityCloudEnabled` | on | Cloud connectivity mechanism, demo provider (Prompt 14). |
| `FEATURE_CONNECTIVITY_MNO_ENABLED` | `connectivityMnoEnabled` | **off** | Future MNO mechanism — requires a carrier agreement. |
| `FEATURE_CONNECTIVITY_MVNO_ENABLED` | `connectivityMvnoEnabled` | **off** | Future MVNO mechanism — requires a host agreement. |
| `FEATURE_PROVIDER_READINESS_ENABLED` | `providerReadinessEnabled` | on | Provider-readiness/registry surface (describes providers; never enables a real one). |
| `FEATURE_PROVIDER_HEALTH_REPORTING_DISABLED` | `providerHealthReportingEnabled` | on | Honest provider health/availability reporting at `/api/health`. |
| `FEATURE_REAL_CLOUD_TELEPHONY_ENABLED` | `realCloudTelephonyEnabled` | **off** | Real cloud-telephony provider (Prompt 15 boundary). |
| `FEATURE_REAL_ESIM_PROVIDER_ENABLED` | `realEsimProviderEnabled` | **off** | Real eSIM provider (Prompt 15 boundary). |
| `FEATURE_REAL_MNO_ENABLED` | `realMnoEnabled` | **off** | Real MNO provider. |
| `FEATURE_REAL_MVNO_ENABLED` | `realMvnoEnabled` | **off** | Real MVNO provider. |
| `FEATURE_REAL_PHYSICAL_SIM_ENABLED` | `realPhysicalSimEnabled` | **off** | Real physical SIM provider. |
| `FEATURE_REAL_PSTN_ENABLED` | `realPstnEnabled` | **off** | Real PSTN provider. |
| `FEATURE_WEBHOOK_ARCHITECTURE_ENABLED` | `webhookArchitectureEnabled` | on | Webhook verification/normalization/idempotency framework (real provider webhooks need a configured provider + real flag). |
| `FEATURE_TRUST_AND_SAFETY_ENABLED` | `trustAndSafetyEnabled` | on | Trust & safety surface present as a readiness layer — does not mean live spam/abuse/automation protection. |
| `FEATURE_INBOUND_SPAM_FILTER_ENABLED` | `inboundSpamFilterEnabled` | **off** | Real inbound spam/abuse filter — off until a provider is configured. |
| `FEATURE_OUTBOUND_GUARD_ENABLED` | `outboundGuardEnabled` | **off** | Real outbound guard — off until a provider is configured. |
| `FEATURE_ANTI_AUTOMATION_PROVIDER_ENABLED` | `antiAutomationProviderEnabled` | **off** | Real anti-automation / behavior-detection provider — off until configured. |
| `FEATURE_SENDER_REPUTATION_ENABLED` | `senderReputationEnabled` | **off** | Real sender/committer reputation provider — off until configured. |
| `FEATURE_ABUSE_REPORTING_ENABLED` | `abuseReportingEnabled` | **off** | Real abuse-reporting pipeline — off until configured. |
| `FEATURE_INCIDENT_MANAGEMENT_ENABLED` | `incidentManagementEnabled` | **off** | Real incident management provider — off until configured. |
| `FEATURE_VERIFICATION_CHALLENGE_ENABLED` | `verificationChallengeEnabled` | **off** | Real verification/challenge provider (anti-automation) — off until configured. |
| `FEATURE_MAINTENANCE_MODE` | `maintenanceMode` | off | Platform-wide maintenance screen (staff bypass). |
| `FEATURE_MAINTENANCE_BILLING` | `maintenanceBilling` | off | Billing-domain maintenance. |
| `FEATURE_MAINTENANCE_ESIM` | `maintenanceEsim` | off | eSIM-domain maintenance. |
| `FEATURE_MAINTENANCE_NUMBER` | `maintenanceNumber` | off | Number-domain maintenance. |
| `FEATURE_MAINTENANCE_SUPPORT` | `maintenanceSupport` | off | Support-domain maintenance. |

Mock flags (`mockPayments`, `mockTelecom`, `mockEsim`) are derived — they are
on unless the corresponding real flag is on.

## Provider swap procedure

When a real provider integration lands:

1. Implement the provider interface (e.g. `StripePaymentProvider`).
2. In `providers/index.ts`, select it **only when** the corresponding flag is
   on; otherwise keep the mock. Call `assertProviderModeAllowed()` there.
3. Flip the flag in staging; validate the whole Prompt 5 regression list.
4. Flip in production; keep the mock behind the derived mock flag for instant
   rollback.

## Maintenance mode

Set `FEATURE_MAINTENANCE_MODE=true` → all customer routes 307 to `/maintenance`
with a friendly, honest screen. Bypassed for:

- verified staff (`onenumbr_staff` cookie set by staff login),
- `/admin/**` (internal console stays usable),
- `/api/health*` (monitoring keeps working),
- `/_next` static assets.

Per-domain flags are read by the engines' entry routes and should surface a
calm "briefly unavailable" state in the UI (wired per-domain as each domain's
real provider lands; platform-wide mode is fully wired in middleware today).
