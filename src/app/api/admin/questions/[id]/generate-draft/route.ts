import { getAiProvider } from "@/lib/ai";
import { getActiveAiRuntimeSettings } from "@/lib/ai/settings";
import { AiProviderError } from "@/lib/ai/types";
import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
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

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("id, question_text, course_name, class_date, class_number, module_topic, reference_links")
    .eq("id", id)
    .maybeSingle();

  if (questionError) {
    console.error("AI draft question lookup failed", {
      code: questionError.code,
      message: questionError.message,
    });
    return Response.json({ message: "Question could not be loaded." }, { status: 500 });
  }
  if (!question) return Response.json({ message: "Question not found." }, { status: 404 });

  try {
    const settings = await getActiveAiRuntimeSettings();
    if (!settings) {
      return Response.json(
        { message: "No active AI configuration was found. Save a provider, model, and API key in AI settings." },
        { status: 422 },
      );
    }

    const provider = getAiProvider(settings.providerName);
    const draft = await provider.generateDraftAnswer(
      {
        questionText: question.question_text,
        courseName: question.course_name,
        classDate: question.class_date,
        classNumber: question.class_number,
        moduleTopic: question.module_topic,
        referenceLinks: question.reference_links,
      },
      settings,
    );

    const { error: updateError } = await supabase
      .from("questions")
      .update({ ai_draft_answer: draft })
      .eq("id", id);
    if (updateError) {
      console.error("AI draft persistence failed", {
        code: updateError.code,
        message: updateError.message,
      });
      return Response.json({ message: "The draft was generated but could not be saved." }, { status: 500 });
    }

    return Response.json(
      { draft, message: "Draft answer generated." },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AiProviderError) {
      return Response.json({ message: error.publicMessage }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "AUTH_REQUIRED") {
      return Response.json({ message: "Authentication required." }, { status: 401 });
    }
    if (code === "SETTINGS_UNAVAILABLE") {
      return Response.json({ message: "AI settings could not be loaded." }, { status: 503 });
    }
    if (code === "API_KEY_REQUIRED") {
      return Response.json({ message: "The active AI provider has no API key. Update AI settings." }, { status: 422 });
    }
    if (code === "MODEL_REQUIRED") {
      return Response.json({ message: "The active AI provider has no model name. Update AI settings." }, { status: 422 });
    }
    if (code === "PROVIDER_REQUIRED") {
      return Response.json({ message: "The active AI provider is missing. Update AI settings." }, { status: 422 });
    }
    console.error("Unexpected AI draft generation failure", error);
    return Response.json({ message: "Draft generation failed unexpectedly." }, { status: 500 });
  }
}
