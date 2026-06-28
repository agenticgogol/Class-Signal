import { isQuestionId } from "@/lib/questions/admin-validation";
import { studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ message: "Submit valid JSON." }, { status: 400 }); }
  const questionId = typeof body.question_id === "string" ? body.question_id : "";
  const suggestionId = typeof body.suggestion_id === "string" ? body.suggestion_id : "";
  const email = typeof body.participant_email === "string" ? body.participant_email.trim().toLocaleLowerCase("en-US") : "";
  const decision = body.decision;
  if (!isQuestionId(questionId) || !isQuestionId(suggestionId) || !email || (decision !== "accepted" && decision !== "rejected")) {
    return Response.json({ message: "Question, email, suggestion, and decision are required." }, { status: 422 });
  }

  try {
    await validateStudentAccess(body.access_code, "board");
    const supabase = createAdminClient();
    const { data: question } = await supabase.from("questions").select("id, student_email").eq("id", questionId).maybeSingle();
    if (!question || question.student_email.toLocaleLowerCase("en-US") !== email) return Response.json({ message: "That email does not match this question." }, { status: 403 });
    const { data: suggestion, error } = await supabase
      .from("question_knowledge_suggestions")
      .select("id, question_id, knowledge_entries(content_text)")
      .eq("id", suggestionId)
      .eq("question_id", questionId)
      .maybeSingle();
    if (error || !suggestion) return Response.json({ message: "Suggestion not found." }, { status: 404 });

    await supabase.from("question_knowledge_suggestions").update({ suggestion_status: decision }).eq("id", suggestionId);
    if (decision === "accepted") {
      const entry = suggestion.knowledge_entries as unknown as { content_text: string } | null;
      if (!entry?.content_text) return Response.json({ message: "The suggested answer is no longer available." }, { status: 409 });
      const { error: updateError } = await supabase.from("questions").update({
        answer_markdown: entry.content_text,
        answer_source: "knowledge",
        status: "Answered",
        is_answer_public: true,
        answered_at: new Date().toISOString(),
      }).eq("id", questionId);
      if (updateError) throw updateError;
    }
    return Response.json({ message: decision === "accepted" ? "The course answer was accepted and published." : "Your question remains in the instructor queue." });
  } catch (error) {
    if (error instanceof Error && error.name === "StudentAccessError") return studentAccessErrorResponse(error);
    console.error("Knowledge suggestion feedback failed", error);
    return Response.json({ message: "Your response could not be saved." }, { status: 500 });
  }
}
