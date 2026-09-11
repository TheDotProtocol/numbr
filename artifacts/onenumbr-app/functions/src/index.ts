// =============================================================================
// OneNumbr — Cloud Functions entry (scaffold)
//
// Prompt 1 keeps all server logic in Next.js API routes. This scaffold exists
// so future prompts (KYC webhooks, eSIM provisioning callbacks, scheduled
// jobs) can add functions without restructuring the project.
// =============================================================================

import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

/** Health check used by firebase.json hosting rewrites. */
export const api = onRequest((req, res) => {
  res.status(200).json({
    ok: true,
    service: "onenumbr-functions",
    note: "Scaffold — business functions arrive in Prompts 2-5",
  });
});
