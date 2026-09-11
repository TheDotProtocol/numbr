import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
