import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const claims = await requireAdmin();
  const email = typeof claims.email === "string" ? claims.email : undefined;

  return <AdminShell email={email}>{children}</AdminShell>;
}
