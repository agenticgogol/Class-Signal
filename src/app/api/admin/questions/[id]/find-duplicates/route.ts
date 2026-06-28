import { getAiProvider } from "@/lib/ai";
import { getActiveAiRuntimeSettings } from "@/lib/ai/settings";
import { AiProviderError } from "@/lib/ai/types";
import { isQuestionId } from "@/lib/questions/admin-validation";
import { jaccardSimilarity } from "@/lib/questions/similarity";
import { createClient } from "@/lib/supabase/server";

type QuestionRow = {
  id: string;
  question_text: string;
  course_name: string;
  status: string;
  question_votes: Array<{ voter_email: string }> | null;
};

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

  const { data: source, error: sourceError } = await supabase
    .from("questions")
    .select("id, question_text, course_name, status, question_votes(voter_email)")
    .eq("id", id)
    .maybeSingle();
  if (sourceError) {
    console.error("Duplicate source lookup failed", { code: sourceError.code, message: sourceError.message });
    return Response.json({ message: "Questions could not be loaded." }, { status: 500 });
  }
  if (!source) return Response.json({ message: "Question not found." }, { status: 404 });

  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  const { data, error } = await supabase
    .from("questions")
    .select("id, question_text, course_name, status")
    .neq("id", id)
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Duplicate candidate lookup failed", { code: error.code, message: error.message });
    return Response.json({ message: "Candidate questions could not be loaded." }, { status: 500 });
  }

  const localCandidates = (data as QuestionRow[])
    .map((question) => ({
      ...question,
      similarity_score: jaccardSimilarity(source.question_text, question.question_text),
      participant_count: new Set((question.question_votes ?? []).map((vote) => vote.voter_email.toLocaleLowerCase("en-US"))).size,
    }))
    .sort((left, right) => right.similarity_score - left.similarity_score)
    .slice(0, 10);

  let matches = localCandidates
    .filter((candidate) => candidate.similarity_score > 0)
    .map((candidate) => ({
      ...candidate,
      method: "local_similarity",
      similarity_reason: `${Math.round(candidate.similarity_score * 100)}% normalized token overlap.`,
    }));
  let aiReranked = false;
  let aiWarning: string | null = null;
  if (localCandidates.length > 0) {
    try {
      const settings = await getActiveAiRuntimeSettings();
      if (settings) {
        const provider = getAiProvider(settings.providerName);
        if (provider.rerankDuplicates) {
          const ranking = await provider.rerankDuplicates(
            source.question_text,
            localCandidates.map((candidate) => ({
              id: candidate.id,
              questionText: candidate.question_text,
              localScore: candidate.similarity_score,
            })),
            settings,
          );
          const candidateById = new Map(localCandidates.map((candidate) => [candidate.id, candidate]));
          const method = settings.providerName === "anthropic" ? "anthropic_ai" : `${settings.providerName}_ai`;
          const aiMatches = ranking.flatMap((result) => {
            const candidate = candidateById.get(result.questionId);
            return candidate ? [{
              ...candidate,
              similarity_score: result.similarityScore,
              similarity_reason: result.reason,
              method,
            }] : [];
          });
          if (aiMatches.length > 0) {
            matches = aiMatches.sort((left, right) => right.similarity_score - left.similarity_score);
            aiReranked = true;
          }
        }
      }
    } catch (aiError) {
      console.warn("AI duplicate re-ranking skipped", aiError);
      aiWarning = aiError instanceof AiProviderError
        ? `${aiError.publicMessage} Local similarity results are shown.`
        : "AI duplicate scoring was unavailable. Local similarity results are shown.";
    }
  }

  const { error: deleteError } = await supabase
    .from("question_similarity")
    .delete()
    .eq("source_question_id", id);
  if (deleteError) {
    console.error("Old duplicate matches could not be cleared", {
      code: deleteError.code,
      message: deleteError.message,
    });
    return Response.json({ message: "Duplicate matches could not be saved." }, { status: 500 });
  }

  if (matches.length > 0) {
    const { error: insertError } = await supabase.from("question_similarity").insert(
      matches.map((candidate) => ({
        source_question_id: id,
        similar_question_id: candidate.id,
        similarity_score: candidate.similarity_score,
        similarity_reason: candidate.similarity_reason,
        participant_count: candidate.participant_count,
        method: candidate.method,
      })),
    );
    if (insertError) {
      console.error("Duplicate match persistence failed", {
        code: insertError.code,
        message: insertError.message,
      });
      return Response.json({ message: "Duplicate matches could not be saved." }, { status: 500 });
    }
  }

  return Response.json(
    {
      matches: matches.map((candidate) => ({
        id: candidate.id,
        question_text: candidate.question_text,
        course_name: candidate.course_name,
        status: candidate.status,
        similarity_score: candidate.similarity_score,
        method: candidate.method,
        similarity_reason: candidate.similarity_reason,
      })),
      ai_reranked: aiReranked,
      ai_warning: aiWarning,
      message: matches.length === 0 ? "No similar questions found." : `${matches.length} similar question${matches.length === 1 ? "" : "s"} found.`,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
