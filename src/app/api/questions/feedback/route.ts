import { studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";
import { createAdminClient } from "@/lib/supabase/admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Submit a valid JSON request." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ message: "Submit valid feedback." }, { status: 422 });
  }
  const values = body as Record<string, unknown>;
  const questionId = typeof values.question_id === "string" ? values.question_id : "";
  const email = typeof values.participant_email === "string" ? values.participant_email.trim().toLocaleLowerCase("en-US") : "";
  const satisfactionStatus = values.satisfaction_status;
  const reason = typeof values.reason === "string" ? values.reason.trim() : "";
  if (!uuidPattern.test(questionId) || !emailPattern.test(email) || !["satisfied", "not_satisfied"].includes(String(satisfactionStatus))) {
    return Response.json({ message: "Submit valid participant feedback." }, { status: 422 });
  }
  if (satisfactionStatus === "not_satisfied" && !reason) {
    return Response.json({ message: "Tell us what is still unclear." }, { status: 422 });
  }
  if (reason.length > 2000) {
    return Response.json({ message: "Feedback reason must be 2,000 characters or fewer." }, { status: 422 });
  }
  try {
    await validateStudentAccess(values.access_code, "board");
    const supabase = createAdminClient();
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("id, answer_markdown, is_answer_public")
      .eq("id", questionId)
      .eq("student_email", email)
      .maybeSingle();
    if (questionError) throw questionError;
    if (!question?.answer_markdown || !question.is_answer_public) {
      return Response.json({ message: "Feedback is available only for your published answered questions." }, { status: 403 });
    }
    const { data: feedback, error } = await supabase.from("question_feedback").upsert(
      {
        question_id: questionId,
        participant_email: email,
        satisfaction_status: satisfactionStatus,
        reason: satisfactionStatus === "not_satisfied" ? reason : null,
      },
      { onConflict: "question_id,participant_email" },
    ).select("satisfaction_status, reason, created_at, updated_at").single();
    if (error) throw error;
    return Response.json({ feedback, message: "Feedback saved." });
  } catch (error) {
    if (error instanceof Error && error.name === "StudentAccessError") return studentAccessErrorResponse(error);
    console.error("Question feedback failed", error);
    return Response.json({ message: "Feedback could not be saved." }, { status: 500 });
  }
}

export const PUT = POST;
