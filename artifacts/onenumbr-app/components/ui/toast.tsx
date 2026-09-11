"use client";

// =============================================================================
// OneNumbr UI — Toast system
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "@/lib/cx";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-success/40 text-success",
  error: "border-destructive/50 text-destructive",
  info: "border-primary/40 text-primary",
};

const TONE_ICONS: Record<ToastTone, string> = {
  success: "✓",
  error: "✕",
  info: "·",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cx(
              "pointer-events-auto animate-fade-up rounded-lg border bg-surface px-4 py-3 shadow-xl shadow-black/40",
              "flex items-start gap-2.5 text-sm",
              TONE_STYLES[toast.tone],
            )}
          >
            <span className="mt-0.5 font-semibold">{TONE_ICONS[toast.tone]}</span>
            <span className="text-foreground">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
