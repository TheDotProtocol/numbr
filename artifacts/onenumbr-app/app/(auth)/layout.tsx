import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";

export default function AuthPagesLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
