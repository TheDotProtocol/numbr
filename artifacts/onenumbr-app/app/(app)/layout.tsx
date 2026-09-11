import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { AppShell } from "@/components/app/AppShell";

export default function AuthedAppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
