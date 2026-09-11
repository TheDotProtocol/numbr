import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>
        <AdminGuard>{children}</AdminGuard>
      </AdminShell>
    </AuthProvider>
  );
}
