import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

const statuses = new Set(["open", "drafting", "resolved", "dismissed"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Submit valid JSON." }, { status: 400 }); }
  const status = typeof body === "object" && body !== null && "status" in body ? (body as { status?: unknown }).status : null;
  if (!isQuestionId(id) || typeof status !== "string" || !statuses.has(status)) return Response.json({ message: "Select a valid gap status." }, { status: 422 });
  const { error } = await supabase.from("knowledge_gaps").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return Response.json({ message: "Gap status could not be updated." }, { status: 500 });
  return Response.json({ message: "Knowledge-gap status updated." });
}
