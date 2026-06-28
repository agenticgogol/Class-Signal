import { normalizeQuestionText, validateQuestionSubmission } from "@/lib/questions/validation";
import { studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { findKnowledgeSuggestion } from "@/lib/knowledge/similarity";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { message: "Submit a valid JSON request.", errors: { form: "Invalid request body." } },
      { status: 400 },
    );
  }

  const validation = validateQuestionSubmission(body);
  if (!validation.success) {
    return Response.json(
      { message: "Check the highlighted fields and try again.", errors: validation.errors },
      { status: 422 },
    );
  }

  const question = validation.data;

  try {
    const accessCode = typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).access_code
      : undefined;
    const settings = await validateStudentAccess(accessCode, "submissions");
    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: settings.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts();
    const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((value) => value.type === type)?.value;
    const classDate = `${part("year")}-${part("month")}-${part("day")}`;
    const supabase = createAdminClient();
    const publicSessionId = typeof body === "object" && body !== null && !Array.isArray(body) && typeof (body as Record<string, unknown>).public_session_id === "string"
      ? String((body as Record<string, unknown>).public_session_id) : null;
    let session: { course_name: string; class_date: string; class_number: string | null } | null = null;
    if (publicSessionId) {
      const { data: activeSession } = await supabase.from("class_join_sessions").select("course_name, class_date, class_number").eq("public_id", publicSessionId).eq("is_active", true).maybeSingle();
      if (!activeSession) return Response.json({ message: "This class join link is no longer active." }, { status: 409 });
      session = activeSession;
    }
    const { data, error } = await supabase
      .from("questions")
      .insert({
        ...question,
        course_name: session?.course_name ?? settings.default_course_name,
        class_date: session?.class_date ?? classDate,
        class_number: session?.class_number ?? null,
        student_email: question.student_email.toLocaleLowerCase("en-US"),
        normalized_question_text: normalizeQuestionText(question.question_text),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Question insert failed", { code: error.code, message: error.message });
      return Response.json(
        { message: "We could not save your question. Please try again." },
        { status: 500 },
      );
    }

    let savedSuggestion = null;
    const match = await findKnowledgeSuggestion(question.question_text);
    if (match) {
      const { data: suggestion, error: suggestionError } = await supabase.from("question_knowledge_suggestions").insert({
        question_id: data.id,
        entry_id: match.entry_id,
        similarity_score: match.similarity_score,
      }).select("id").single();
      if (!suggestionError && suggestion) savedSuggestion = { ...match, id: suggestion.id };
    }
    return Response.json({ id: data.id, suggestion: savedSuggestion, message: "Question submitted." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "StudentAccessError") {
      return studentAccessErrorResponse(error);
    }
    console.error("Question submission failed", error);
    return Response.json(
      { message: "Question submission is temporarily unavailable." },
      { status: 503 },
    );
  }
}
