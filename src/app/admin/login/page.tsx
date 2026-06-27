import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { AdminLoginForm } from "@/components/admin-login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Instructor sign in" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims && params.reauth !== "1") redirect("/admin/dashboard");

  return (
    <div className="admin-login-page">
      <div className="admin-login-card"><AdminLoginForm /></div>
      <p className="admin-login-help">
        Access is restricted to authenticated instructors. <Link href="/questions">Return to the public board</Link>
      </p>
    </div>
  );
}
