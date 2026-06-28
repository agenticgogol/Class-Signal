import { isQuestionId, validateAdminQuestionUpdate } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  if (!isQuestionId(id)) {
    return Response.json({ message: "Invalid question identifier." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Submit a valid JSON request." }, { status: 400 });
  }

  const validation = validateAdminQuestionUpdate(body);
  if (!validation.success) {
    return Response.json({ message: validation.message }, { status: 422 });
  }
  if (validation.data.duplicate_of_question_id === id) {
    return Response.json({ message: "A question cannot duplicate itself." }, { status: 422 });
  }

  const update = { ...validation.data } as typeof validation.data & { answered_at?: string; answer_html?: null; answer_source?: "instructor" };
  if (Object.prototype.hasOwnProperty.call(validation.data, "answer_markdown")) {
    update.answer_html = null;
    update.answer_source = "instructor";
  }
  if (validation.data.status === "Answered") {
    const { data: existing, error: lookupError } = await supabase
      .from("questions")
      .select("answered_at")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) {
      console.error("Admin question answer timestamp lookup failed", { code: lookupError.code, message: lookupError.message });
      return Response.json({ message: "Question could not be updated." }, { status: 500 });
    }
    if (!existing) return Response.json({ message: "Question not found." }, { status: 404 });
    update.answered_at = existing.answered_at ?? new Date().toISOString();
  }

  let result = await supabase
    .from("questions")
    .update(update)
    .eq("id", id)
    .select("id, updated_at")
    .maybeSingle();
  if (result.error?.code === "42703" && Object.prototype.hasOwnProperty.call(update, "answer_html")) {
    const legacyUpdate = { ...validation.data, ...(update.answered_at ? { answered_at: update.answered_at } : {}) };
    result = await supabase.from("questions").update(legacyUpdate).eq("id", id).select("id, updated_at").maybeSingle();
  }
  const { data, error } = result;

  if (error) {
    console.error("Admin question update failed", { code: error.code, message: error.message, hint: error.hint });
    return Response.json(
      { message: error.code === "23503" ? "The selected duplicate question does not exist." : "Question could not be updated." },
      { status: error.code === "23503" ? 422 : 500 },
    );
  }
  if (!data) return Response.json({ message: "Question not found." }, { status: 404 });

  return Response.json({ question: data }, { headers: { "Cache-Control": "private, no-store" } });
}
