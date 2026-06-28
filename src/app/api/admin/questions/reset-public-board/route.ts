import { createClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ message: "Submit valid JSON." }, { status: 400 }); }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmation = body.confirmation;
  if (!email || !password || confirmation !== "RESET PUBLIC BOARD") {
    return Response.json({ message: "Enter admin credentials and the required confirmation phrase." }, { status: 422 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return Response.json({ message: "Authentication is not configured." }, { status: 503 });
  const verifier = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: authError } = await verifier.auth.signInWithPassword({ email, password });
  if (authError) return Response.json({ message: "Invalid admin email or password." }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("questions").update({ is_public: false }).eq("is_public", true).select("id");
    if (error) throw error;
    return Response.json({ archived_count: data?.length ?? 0, message: `${data?.length ?? 0} public questions archived.` });
  } catch (error) {
    console.error("Public board reset failed", error);
    return Response.json({ message: "The public board could not be reset." }, { status: 500 });
  } finally {
    await verifier.auth.signOut();
  }
}
