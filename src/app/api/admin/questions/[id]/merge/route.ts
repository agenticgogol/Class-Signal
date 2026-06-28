import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return supabase;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await authenticatedClient();
  if (!supabase) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Submit valid JSON." }, { status: 400 }); }
  const canonicalId = typeof body === "object" && body !== null && "canonical_question_id" in body
    ? (body as { canonical_question_id?: unknown }).canonical_question_id : null;
  if (!isQuestionId(id) || typeof canonicalId !== "string" || !isQuestionId(canonicalId)) {
    return Response.json({ message: "Select a valid canonical question." }, { status: 422 });
  }

  const { data, error } = await supabase.rpc("merge_duplicate_question", {
    p_duplicate_id: id,
    p_canonical_id: canonicalId,
  });
  if (error) {
    console.error("Duplicate merge failed", { code: error.code, message: error.message });
    const missingMigration = error.code === "PGRST202" || error.code === "42883";
    return Response.json({
      message: missingMigration
        ? "Phase 5 database migration is required before questions can be merged."
        : error.message.includes("Circular") ? "This merge would create a circular relationship." : "Questions could not be merged.",
    }, { status: missingMigration ? 503 : 422 });
  }
  return Response.json({ merge_id: data, canonical_question_id: canonicalId, message: "Questions consolidated. Votes and answers now follow the canonical question." });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await authenticatedClient();
  if (!supabase) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { id } = await params;
  if (!isQuestionId(id)) return Response.json({ message: "Invalid question identifier." }, { status: 400 });
  const { error } = await supabase.rpc("undo_duplicate_merge", { p_duplicate_id: id });
  if (error) {
    console.error("Duplicate merge undo failed", { code: error.code, message: error.message });
    return Response.json({ message: "The active merge could not be undone." }, { status: 422 });
  }
  const { data: question } = await supabase.from("questions").select("status, duplicate_of_question_id, updated_at").eq("id", id).maybeSingle();
  return Response.json({ question, message: "Merge undone. The original question lifecycle was restored." });
}
