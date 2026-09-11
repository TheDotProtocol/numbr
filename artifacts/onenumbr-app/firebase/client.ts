// =============================================================================
// OneNumbr — Firebase client initialization (browser SDK)
//
// Exposes lazy, singleton instances of Auth, Firestore and Storage. All app
// code imports from here — never from "firebase/*" directly.
// =============================================================================

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
  type FirebaseStorage,
} from "firebase/storage";

import { firebaseConfig, isEmulatorEnabled } from "@/lib/env";

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

/** Get (or lazily create) the singleton Firebase web app. */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

/** Firebase Authentication (persistent browser session). */
export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
    // Keep users signed in across refreshes/tabs.
    void setPersistence(authInstance, browserLocalPersistence).catch((err) =>
      console.error("[OneNumbr] failed to set auth persistence:", err),
    );
    if (isEmulatorEnabled()) {
      connectAuthEmulator(authInstance, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    }
  }
  return authInstance;
}

/** Cloud Firestore client. */
export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
    if (isEmulatorEnabled()) {
      connectFirestoreEmulator(dbInstance, "127.0.0.1", 8080);
    }
  }
  return dbInstance;
}

/** Cloud Storage client. */
export function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(getFirebaseApp());
    if (isEmulatorEnabled()) {
      connectStorageEmulator(storageInstance, "127.0.0.1", 9199);
    }
  }
  return storageInstance;
}
