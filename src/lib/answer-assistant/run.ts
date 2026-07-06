import "server-only";

import { getAiProvider } from "@/lib/ai";
import { getActiveAiRuntimeSettings } from "@/lib/ai/settings";
import { AiProviderError } from "@/lib/ai/types";
import { retrieveCourseSources } from "@/lib/knowledge/retrieval";
import { jaccardSimilarity } from "@/lib/questions/similarity";
import { createClient } from "@/lib/supabase/server";

const MAX_QUESTIONS_PER_RUN = 25;
const AGENDA_MATCH_THRESHOLD = 0.12;

type CandidateQuestion = {
  id: string;
  question_text: string;
  course_name: string;
  class_date: string | null;
  class_number: string | null;
  module_topic: string | null;
  reference_links: string | null;
};

type AgendaEntry = {
  id: string;
  class_number: string;
  concepts: string | null;
  hands_on: string | null;
};

export type AnswerAssistantResult = {
  question_id: string;
  mode: "course" | "external";
  agenda_entry_id: string | null;
  confidence: "high" | "medium" | "low";
  error?: string;
};

export type AnswerAssistantRun = {
  id: string;
  status: "running" | "completed" | "failed";
  questions_considered: number;
  drafts_generated: number;
  results: AnswerAssistantResult[];
  created_at: string;
  completed_at: string | null;
};

function bestAgendaMatch(question: CandidateQuestion, agenda: AgendaEntry[]) {
  let best: { entry: AgendaEntry; score: number } | null = null;
  for (const entry of agenda) {
    const text = [entry.concepts, entry.hands_on].filter(Boolean).join(" ");
    if (!text) continue;
    const score = Math.max(
      jaccardSimilarity(question.question_text, text),
      question.module_topic ? jaccardSimilarity(question.module_topic, text) : 0,
    );
    if (score >= AGENDA_MATCH_THRESHOLD && (!best || score > best.score)) best = { entry, score };
  }
  return best;
}

export async function runAnswerAssistant(): Promise<AnswerAssistantRun> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) throw new Error("AUTH_REQUIRED");
  const triggeredBy = authData.claims.sub as string | undefined;

  const settings = await getActiveAiRuntimeSettings();
  if (!settings) throw new Error("SETTINGS_UNAVAILABLE");
  const provider = getAiProvider(settings.providerName);

  const { data: run, error: runError } = await supabase
    .from("answer_assistant_runs")
    .insert({ status: "running", triggered_by: triggeredBy ?? null })
    .select("id, status, questions_considered, drafts_generated, results, created_at, completed_at")
    .single();
  if (runError || !run) throw new Error("RUN_STORE_UNAVAILABLE");

  try {
    const [{ data: questions, error: questionsError }, { data: agenda, error: agendaError }] = await Promise.all([
      supabase.from("questions")
        .select("id, question_text, course_name, class_date, class_number, module_topic, reference_links")
        .in("status", ["New", "Needs follow-up"])
        .order("created_at", { ascending: true })
        .limit(MAX_QUESTIONS_PER_RUN),
      supabase.from("classwise_agenda").select("id, class_number, concepts, hands_on"),
    ]);
    if (questionsError) throw new Error("QUESTIONS_UNAVAILABLE");
    if (agendaError && !["42P01", "PGRST205"].includes(agendaError.code)) throw new Error("AGENDA_UNAVAILABLE");

    const candidateQuestions = (questions ?? []) as CandidateQuestion[];
    const agendaEntries = (agenda ?? []) as AgendaEntry[];
    const results: AnswerAssistantResult[] = [];
    let draftsGenerated = 0;

    for (const question of candidateQuestions) {
      try {
        const agendaMatch = bestAgendaMatch(question, agendaEntries);
        const courseSources = await retrieveCourseSources(question.question_text, question.module_topic);
        const covered = Boolean(agendaMatch) && courseSources.length > 0;
        const groundingMode = covered ? "course_only" : "course_and_web";

        const draft = await provider.generateDraftAnswer(
          {
            questionText: question.question_text,
            courseName: question.course_name,
            classDate: question.class_date,
            classNumber: question.class_number,
            moduleTopic: question.module_topic,
            referenceLinks: question.reference_links,
            groundingMode,
            courseSources: covered ? courseSources : [],
          },
          settings,
        );

        const confidence: AnswerAssistantResult["confidence"] = covered
          ? (courseSources[0].similarityScore >= 0.35 ? "high" : courseSources[0].similarityScore >= 0.18 ? "medium" : "low")
          : "low";

        const { error: updateError } = await supabase.from("questions").update({
          ai_draft_answer: draft.draft,
          agenda_entry_id: covered ? agendaMatch!.entry.id : null,
          ai_answer_mode: covered ? "course" : "external",
        }).eq("id", question.id);
        if (updateError) throw new Error("Draft could not be saved.");

        draftsGenerated += 1;
        results.push({
          question_id: question.id,
          mode: covered ? "course" : "external",
          agenda_entry_id: covered ? agendaMatch!.entry.id : null,
          confidence,
        });
      } catch (error) {
        const message = error instanceof AiProviderError ? error.publicMessage : error instanceof Error ? error.message : "Draft generation failed.";
        results.push({ question_id: question.id, mode: "external", agenda_entry_id: null, confidence: "low", error: message });
      }
    }

    const { data: completedRun, error: completeError } = await supabase.from("answer_assistant_runs").update({
      status: "completed",
      questions_considered: candidateQuestions.length,
      drafts_generated: draftsGenerated,
      results,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id).select("id, status, questions_considered, drafts_generated, results, created_at, completed_at").single();
    if (completeError || !completedRun) throw new Error("RUN_STORE_UNAVAILABLE");
    return completedRun as AnswerAssistantRun;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Answer assistant run failed.";
    await supabase.from("answer_assistant_runs").update({ status: "failed", error_message: message, completed_at: new Date().toISOString() }).eq("id", run.id);
    throw error;
  }
}

export async function getLatestAnswerAssistantRun(): Promise<AnswerAssistantRun | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) throw new Error("AUTH_REQUIRED");
  const { data, error } = await supabase.from("answer_assistant_runs")
    .select("id, status, questions_considered, drafts_generated, results, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error?.code === "42P01" || error?.code === "PGRST205") return null;
  if (error) throw new Error("RUN_STORE_UNAVAILABLE");
  return data as AnswerAssistantRun | null;
}
