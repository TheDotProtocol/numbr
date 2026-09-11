"use client";

// =============================================================================
// OneNumbr — Auth context (session + account bundle)
//
// Central client-side session state. Exposes:
//   - firebaseUser: the raw Firebase Auth user (or null)
//   - account: { user, profile, identity } from Firestore (or null)
//   - status: "loading" | "authenticated" | "unauthenticated"
//   - helpers: refreshAccount, logout, sendVerification
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { observeAuth, logout as authLogout } from "@/services/authService";
import { getUserRecord } from "@/services/userService";
import { getProfile } from "@/services/profileService";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/firebase/client";
import type { AccountBundle, OneNumbrIdRecord, UserRecord } from "@/types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: User | null;
  account: AccountBundle | null;
  refreshAccount: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [account, setAccount] = useState<AccountBundle | null>(null);
  const unsubIdRef = useRef<(() => void) | null>(null);

  const loadAccount = useCallback(async (user: User): Promise<void> => {
    const [userRec, profileRec] = await Promise.all([
      getUserRecord(user.uid).catch(() => null),
      getProfile(user.uid).catch(() => null),
    ]);
    let identity: OneNumbrIdRecord | null = null;
    try {
      const snap = await getDoc(doc(getFirebaseDb(), "onenumbr_ids", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        identity = {
          uid: user.uid,
          onenumbr: String(data.onenumbr ?? ""),
          status: (data.status as OneNumbrIdRecord["status"]) ?? "active",
          createdAt: data.createdAt?.toMillis?.() ?? null,
          updatedAt: data.updatedAt?.toMillis?.() ?? null,
        };
      }
    } catch {
      identity = null;
    }
    setAccount({ user: userRec ?? fallbackUser(user), profile: profileRec, identity });
  }, []);

  const fallbackUser = (user: User): UserRecord => ({
    uid: user.uid,
    email: user.email ?? "",
    role: "user",
    status: "active",
    createdAt: null,
    updatedAt: null,
    lastLoginAt: null,
  });

  // Auth state subscription.
  useEffect(() => {
    const unsub = observeAuth(async (user) => {
      setFirebaseUser(user);
      if (user) {
        setStatus("authenticated");
        loadAccount(user).catch((err) => {
          console.error("[OneNumbr] failed to load account:", err);
        });
        // Register this browser's session with the server (server-coordinated
        // sessions; idempotent per device, non-blocking).
        if (user.emailVerified) {
          import("@/services/accountService")
            .then((m) => m.registerCurrentSession())
            .catch(() => undefined);
        }
      } else {
        setStatus("unauthenticated");
        setAccount(null);
        unsubIdRef.current?.();
        unsubIdRef.current = null;
      }
    });
    return () => unsub();
  }, [loadAccount]);

  // Live-refresh the identity doc once authenticated (e.g. right after the
  // server issues the OneNumbr ID during onboarding).
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(
      doc(getFirebaseDb(), "onenumbr_ids", firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setAccount((prev) =>
            prev
              ? {
                  ...prev,
                  identity: {
                    uid: firebaseUser.uid,
                    onenumbr: String(data.onenumbr ?? ""),
                    status: (data.status as OneNumbrIdRecord["status"]) ?? "active",
                    createdAt: data.createdAt?.toMillis?.() ?? null,
                    updatedAt: data.updatedAt?.toMillis?.() ?? null,
                  },
                }
              : prev,
          );
        }
      },
      (err) => console.error("[OneNumbr] identity snapshot error:", err),
    );
    unsubIdRef.current = unsub;
    return () => unsub();
  }, [firebaseUser]);

  const refreshAccount = useCallback(async () => {
    if (firebaseUser) await loadAccount(firebaseUser);
  }, [firebaseUser, loadAccount]);

  const logout = useCallback(async () => {
    await authLogout();
    setAccount(null);
    setFirebaseUser(null);
  }, []);

  const value = useMemo(
    () => ({ status, firebaseUser, account, refreshAccount, logout }),
    [status, firebaseUser, account, refreshAccount, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
