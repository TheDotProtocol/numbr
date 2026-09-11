// =============================================================================
// OneNumbr — Auth service (Firebase Authentication wrapper)
//
// All UI calls flow through this module. Errors are normalized to AppError
// before they ever reach a component. Designed so social/phone/passkey
// providers can be added later without touching UI code.
// =============================================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updatePassword,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/firebase/client";
import { AppError, appError, toAppError } from "@/lib/errors";
import { createUserRecord, touchLastLogin } from "@/services/userService";

/**
 * Sign up with email/password. Creates the Firebase Auth user, the
 * users/{uid} record, and sends the verification email.
 */
export async function signUp(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<User> {
  const auth = getFirebaseAuth();
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      input.email,
      input.password,
    );
    try {
      await createUserRecord(cred.user.uid, input.email);
    } catch (err) {
      console.error("[OneNumbr] users/{uid} creation failed post-signup:", err);
    }
    try {
      await sendEmailVerification(cred.user);
    } catch (err) {
      console.error("[OneNumbr] verification email failed to send:", err);
    }
    return cred.user;
  } catch (err) {
    throw toAppError(err);
  }
}

/**
 * Sign in with email/password. Blocks unverified emails, refreshes the
 * Firestore account record, and updates lastLoginAt.
 */
export async function login(input: { email: string; password: string }): Promise<User> {
  const auth = getFirebaseAuth();
  try {
    const cred = await signInWithEmailAndPassword(auth, input.email, input.password);

    if (!cred.user.emailVerified) {
      // Keep the session (so "Resend verification" works) but signal the gate.
      throw appError("auth/unverified-email");
    }

    await touchLastLogin(cred.user.uid);
    return cred.user;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw toAppError(err);
  }
}

/** Sign out. */
export async function logout(): Promise<void> {
  try {
    await signOut(getFirebaseAuth());
  } catch (err) {
    throw toAppError(err);
  }
}

/** Send a password reset email. */
export async function sendResetEmail(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  } catch (err) {
    throw toAppError(err);
  }
}

/** Resend the verification email for the current user. */
export async function resendVerificationEmail(user?: User): Promise<void> {
  const target = user ?? getFirebaseAuth().currentUser;
  if (!target) throw toAppError(new Error("not signed in"));
  try {
    await sendEmailVerification(target);
  } catch (err) {
    throw toAppError(err);
  }
}

/** Change password for the current user (re-authenticates implicitly via recent login). */
export async function changePassword(newPassword: string): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw toAppError(new Error("not signed in"));
  try {
    await updatePassword(user, newPassword);
  } catch (err) {
    throw toAppError(err);
  }
}

/** Reload the current user from the server (e.g. after clicking a verification link). */
export async function reloadUser(): Promise<User | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  try {
    await user.reload();
    return getFirebaseAuth().currentUser;
  } catch (err) {
    throw toAppError(err);
  }
}

/**
 * Subscribe to auth state. Always resolves the initial state before firing
 * (via onAuthStateChanged), so the app can gate on a definitive answer.
 */
export function observeAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export const authService = {
  signUp,
  login,
  logout,
  sendResetEmail,
  resendVerificationEmail,
  changePassword,
  reloadUser,
  observeAuth,
};
