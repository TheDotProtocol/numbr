# OneNumbr — Firebase Setup Guide

Everything you must do manually in the Firebase console to make the platform
fully functional. Local development works without these steps (the app shows
honest "not configured" states), but auth/Firestore require a real project.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. Name it (e.g. `onenumbr-prod` or `onenumbr-dev`). Google Analytics optional.

## 2. Register a Web app

1. Project settings (⚙️) → **General** → *Your apps* → **Web** (`</>`).
2. Register the app (nickname: `onenumbr-web`). **Do not enable Firebase
   Hosting here** — hosting is configured via `firebase.json` in this repo.
3. Copy the `firebaseConfig` values into `.env.local`:

   | Console value     | Environment variable                      |
   | ----------------- | ----------------------------------------- |
   | `apiKey`          | `NEXT_PUBLIC_FIREBASE_API_KEY`            |
   | `authDomain`      | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`        |
   | `projectId`       | `NEXT_PUBLIC_FIREBASE_PROJECT_ID`         |
   | `storageBucket`   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`     |
   | `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId`           | `NEXT_PUBLIC_FIREBASE_APP_ID`             |

   These are **public client identifiers** — safe to expose, protected by
   security rules. Never prefix server credentials with `NEXT_PUBLIC_`.

## 3. Enable Authentication

1. Build → **Authentication** → *Get started*.
2. Enable the **Email/Password** provider. (Leave Google/Apple/Phone disabled
   for Prompt 1 — the architecture supports adding them later.)
3. *Authorized domains*: add `localhost` (present by default) plus your
   production domain when you deploy.

## 4. Create Firestore

1. Build → **Firestore Database** → *Create database*.
2. Choose **Production mode** (our `firestore.rules` are the source of truth).
3. Pick a region close to your users (e.g. `europe-west1`, `us-central1`).
4. Deploy rules + indexes:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

   (Log in first with `firebase login` and select the project with
   `firebase use --add`.)

## 5. Create Cloud Storage

1. Build → **Storage** → *Get started*.
2. Accept the default bucket. Deploy storage rules:

   ```bash
   firebase deploy --only storage
   ```

## 6. Service account (server-side)

The server routes (`/api/onboarding/*`, `/api/admin/*`) and the
`set-admin` script need Admin SDK credentials.

1. Project settings → **Service accounts** → *Generate new private key*.
2. A JSON file downloads. **Never commit it.** Either:
   - Paste the entire JSON on one line into
     `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env.local`, **or**
   - Save it as `serviceAccountKey.json` inside
     `artifacts/onenumbr-app/` (gitignored) and set
     `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json`.
3. When deploying to Firebase Hosting/Cloud Functions, Application Default
   Credentials work with no env var at all.

## 7. Create the first admin

1. Sign up in the app with your own email (normal signup flow).
2. Add your email to `ADMIN_EMAILS` in `.env.local`, or pass it directly:

   ```bash
   pnpm --filter @workspace/onenumbr-app set-admin you@yourdomain.com
   ```

3. **Sign out and sign in again** — custom claims are minted into the ID
   token at sign-in. Your account will now see `/admin`.

## 8. Email verification & password reset emails

Firebase Auth sends these from a fixed sender. To customize:

1. Authentication → *Templates* — edit the verification and password-reset
   templates (sender name, subject).
2. For a custom domain, set up a custom email action handler or connect a
   third-party sender (optional; not required for Prompt 1).

## 9. Upgrade plan (when deploying)

The Spark (free) plan works for local development. Production deployments
that use Cloud Functions or require outbound API calls need the **Blaze**
pay-as-you-go plan. Firestore/Auth/Storage have generous free tiers.

## 10. Deploy

```bash
firebase deploy --only hosting,firestore:rules,storage
```

`firebase.json` routes `/api/onboarding/**` and `/api/admin/**` to the
Cloud Function entry point and all other paths to the static export.
