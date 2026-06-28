import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { id } = await params;
  if (!isQuestionId(id)) return Response.json({ message: "Invalid session identifier." }, { status: 400 });
  const { error } = await supabase.from("class_join_sessions").update({ is_active: false, closed_at: new Date().toISOString() }).eq("id", id);
  if (error) return Response.json({ message: "Session could not be closed." }, { status: 500 });
  return Response.json({ message: "QR join session closed." });
}
