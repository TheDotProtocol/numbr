"use client";

// =============================================================================
// OneNumbr — KYC & notification hooks
//
// `useKyc("live")` subscribes to the single kyc/{uid} doc (verification
// pages). `useKyc("once")` does a one-shot read (dashboard cards) —
// deliberate free-tier-aware listener usage.
// =============================================================================

import { useEffect, useState } from "react";
import { useAuthContext } from "@/hooks/useAuth";
import { observeKycStatus, getKycStatus } from "@/services/kycService";
import type { KycRecord } from "@/types/kyc";
import type { UserNotification } from "@/types/notifications";
import { getFirebaseDb } from "@/firebase/client";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

export function useKyc(mode: "live" | "once" = "once"): {
  kyc: KycRecord | null;
  loaded: boolean;
} {
  const [kyc, setKyc] = useState<KycRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  const { firebaseUser } = useAuthContext();

  useEffect(() => {
    const uid = firebaseUser?.uid ?? null;
    if (!uid) return;

    if (mode === "live") {
      return observeKycStatus(uid, (record) => {
        setKyc(record);
        setLoaded(true);
      });
    }
    let cancelled = false;
    getKycStatus(uid)
      .then((record) => {
        if (!cancelled) {
          setKyc(record);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, firebaseUser]);

  return { kyc, loaded };
}



// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------

export function useNotifications(max = 20): {
  notifications: UserNotification[];
  loaded: boolean;
  unreadCount: number;
  markAllRead: () => Promise<void>;
} {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { firebaseUser: notifUser } = useAuthContext();

  useEffect(() => {
    const uid = notifUser?.uid ?? null;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const ref = collection(getFirebaseDb(), "notifications", uid, "items");
        const snap = await getDocs(
          query(ref, orderBy("createdAt", "desc"), limit(max)),
        );
        if (cancelled) return;
        setNotifications(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              uid,
              kind: data.kind as UserNotification["kind"],
              title: String(data.title ?? ""),
              message: String(data.message ?? ""),
              read: Boolean(data.read),
              createdAt: data.createdAt?.toMillis?.() ?? null,
            };
          }),
        );
      } catch (err) {
        console.error("[OneNumbr] notifications load failed:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [max, notifUser]);

  async function markAllRead(): Promise<void> {
    const uid = notifUser?.uid ?? null;
    if (!uid) return;
    const { doc, updateDoc, writeBatch } = await import("firebase/firestore");
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      if (unread.length === 1) {
        await updateDoc(
          doc(getFirebaseDb(), "notifications", uid, "items", unread[0].id),
          { read: true },
        );
      } else {
        const batch = writeBatch(getFirebaseDb());
        unread.forEach((n) =>
          batch.update(
            doc(getFirebaseDb(), "notifications", uid, "items", n.id),
            { read: true },
          ),
        );
        await batch.commit();
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("[OneNumbr] mark-read failed:", err);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, loaded, unreadCount, markAllRead };
}
