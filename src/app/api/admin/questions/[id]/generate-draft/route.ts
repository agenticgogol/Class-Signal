import { getAiProvider } from "@/lib/ai";
import { getActiveAiRuntimeSettings } from "@/lib/ai/settings";
import { AiProviderError } from "@/lib/ai/types";
import type { GroundingMode } from "@/lib/ai/types";
import { retrieveCourseSources } from "@/lib/knowledge/retrieval";
import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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
    let body: unknown = {};
    try { body = await request.json(); } catch { /* An empty body uses the safe default. */ }
    const requestedMode = typeof body === "object" && body !== null && "grounding_mode" in body
      ? (body as { grounding_mode?: unknown }).grounding_mode
      : "course_only";
    if (requestedMode !== "course_only" && requestedMode !== "course_and_web") {
      return Response.json({ message: "Invalid grounding mode." }, { status: 400 });
    }
    const groundingMode: GroundingMode = requestedMode;
    const courseSources = await retrieveCourseSources(question.question_text, question.module_topic);
    if (groundingMode === "course_only" && courseSources.length === 0) {
      return Response.json({
        message: "No sufficiently relevant published course material was found. Publish a matching FAQ/Theory section or explicitly use Course + web.",
      }, { status: 422 });
    }

    const settings = await getActiveAiRuntimeSettings();
    if (!settings) {
      return Response.json(
        { message: "No active AI configuration was found. Save a provider, model, and API key in AI settings." },
        { status: 422 },
      );
    }

    const provider = getAiProvider(settings.providerName);
    const result = await provider.generateDraftAnswer(
      {
        questionText: question.question_text,
        courseName: question.course_name,
        classDate: question.class_date,
        classNumber: question.class_number,
        moduleTopic: question.module_topic,
        referenceLinks: question.reference_links,
        groundingMode,
        courseSources,
      },
      settings,
    );

    if (groundingMode === "course_only") {
      const allowedCitations = new Set(courseSources.map((source) => source.citationId));
      const citedIds = [...result.draft.matchAll(/\[(C\d+)\]/g)].map((match) => match[1]);
      if (citedIds.length === 0 || citedIds.some((citationId) => !allowedCitations.has(citationId))) {
        throw new AiProviderError(
          "The provider returned a draft without valid course citations, so it was rejected. Try again or use Course + web.",
          502,
        );
      }
    }

    const { error: updateError } = await supabase
      .from("questions")
      .update({ ai_draft_answer: result.draft })
      .eq("id", id);
    if (updateError) {
      console.error("AI draft persistence failed", {
        code: updateError.code,
        message: updateError.message,
      });
      return Response.json({ message: "The draft was generated but could not be saved." }, { status: 500 });
    }

    return Response.json(
      {
        draft: result.draft,
        grounding_mode: groundingMode,
        confidence: courseSources.length >= 2 && courseSources[0].similarityScore >= 0.35 && (courseSources[0].semanticScore === null || Math.abs(courseSources[0].semanticScore - courseSources[0].lexicalScore) <= 0.35)
          ? "high"
          : courseSources[0]?.similarityScore >= 0.18 ? "medium" : "low",
        course_sources: courseSources.map((source) => ({
          citationId: source.citationId,
          entryId: source.entryId,
          kind: source.kind,
          documentTitle: source.documentTitle,
          sectionTitle: source.sectionTitle,
          moduleTopic: source.moduleTopic,
          similarityScore: source.similarityScore,
          provenanceLabel: source.provenanceLabel,
        })),
        external_citations: result.externalCitations,
        web_search_used: result.webSearchUsed,
        warning: courseSources[0]?.similarityScore < 0.18
          ? "Course-material coverage is weak. Verify the draft carefully before publishing."
          : null,
        message: result.webSearchUsed ? "Grounded draft generated with course and web sources." : "Grounded draft generated from course material.",
      },
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
    if (code === "GROUNDING_UNAVAILABLE") {
      return Response.json({ message: "Approved course material could not be loaded." }, { status: 503 });
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
