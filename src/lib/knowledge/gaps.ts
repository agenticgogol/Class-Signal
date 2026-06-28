import "server-only";

import { jaccardSimilarity, questionTokens } from "@/lib/questions/similarity";
import { createKnowledgeEmbeddings } from "@/lib/knowledge/embeddings";
import { createClient } from "@/lib/supabase/server";

export type KnowledgeGap = {
  id: string;
  concept_key: string;
  concept_label: string;
  module_topic: string | null;
  suggested_kind: "faq" | "theory" | "code";
  status: "open" | "drafting" | "resolved" | "dismissed";
  question_ids: string[];
  representative_questions: Array<{ id: string; question_text: string }>;
  question_count: number;
  participant_count: number;
  session_count: number;
  upvote_count: number;
  rejected_suggestions: number;
  dissatisfied_count: number;
  follow_up_count: number;
  unanswered_count: number;
  existing_source: string | null;
  source_match: number;
  score: number;
};

type QuestionRow = {
  id: string; question_text: string; student_email: string; module_topic: string | null;
  class_date: string | null; class_number: string | null; status: string; answer_markdown: string | null;
  created_at: string; question_votes: Array<{ voter_email: string }> | null;
  question_feedback: Array<{ satisfaction_status: string }> | null;
  question_knowledge_suggestions: Array<{ suggestion_status: string }> | null;
};

export async function getStoredKnowledgeGaps(): Promise<{ gaps: KnowledgeGap[]; migrationRequired: boolean }> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) throw new Error("AUTH_REQUIRED");
  const { data, error } = await supabase.from("knowledge_gaps").select("id, concept_key, concept_label, module_topic, suggested_kind, status, signal_summary, knowledge_gap_questions(question_id, questions(id, question_text))").order("updated_at", { ascending: false }).limit(50);
  if (error && ["42P01", "PGRST205"].includes(error.code)) return { gaps: [], migrationRequired: true };
  if (error) throw new Error("GAP_STORE_UNAVAILABLE");
  const gaps = (data ?? []).map((row) => {
    const summary = (row.signal_summary ?? {}) as Record<string, unknown>;
    const links = row.knowledge_gap_questions as unknown as Array<{ question_id: string; questions: { id: string; question_text: string } | null }>;
    const questions = links.flatMap((link) => link.questions ? [{ id: link.questions.id, question_text: link.questions.question_text }] : []);
    const number = (key: string) => typeof summary[key] === "number" ? summary[key] as number : 0;
    return {
      id: row.id, concept_key: row.concept_key, concept_label: row.concept_label, module_topic: row.module_topic,
      suggested_kind: row.suggested_kind as KnowledgeGap["suggested_kind"], status: row.status as KnowledgeGap["status"],
      question_ids: links.map((link) => link.question_id), representative_questions: questions.slice(0, 4),
      question_count: number("question_count"), participant_count: number("participant_count"), session_count: number("session_count"),
      upvote_count: number("upvote_count"), rejected_suggestions: number("rejected_suggestions"), dissatisfied_count: number("dissatisfied_count"),
      follow_up_count: number("follow_up_count"), unanswered_count: number("unanswered_count"),
      existing_source: typeof summary.existing_source === "string" ? summary.existing_source : null,
      source_match: number("source_match"), score: number("score"),
    } satisfies KnowledgeGap;
  });
  return { gaps, migrationRequired: false };
}

function conceptLabel(questions: QuestionRow[]) {
  const frequencies = new Map<string, number>();
  for (const question of questions) for (const token of questionTokens(question.question_text)) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  const terms = [...frequencies].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([term]) => term);
  return terms.length ? terms.map((term) => term[0].toUpperCase() + term.slice(1)).join(" · ") : questions[0].question_text.slice(0, 80);
}

function suggestedKind(questions: QuestionRow[]): KnowledgeGap["suggested_kind"] {
  const text = questions.map((question) => question.question_text).join(" ").toLocaleLowerCase("en-US");
  if (/\b(code|python|function|class|error|exception|api|implementation|syntax|debug)\b/.test(text)) return "code";
  if (/\b(why|concept|difference|explain|architecture|theory|works?)\b/.test(text)) return "theory";
  return "faq";
}

export async function refreshKnowledgeGaps(): Promise<{ gaps: KnowledgeGap[]; migrationRequired: boolean }> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) throw new Error("AUTH_REQUIRED");

  const [{ data, error }, sourceResult, similarityResult] = await Promise.all([
    supabase.from("questions").select("id, question_text, student_email, module_topic, class_date, class_number, status, answer_markdown, created_at, question_votes(voter_email), question_feedback(satisfaction_status), question_knowledge_suggestions(suggestion_status)").neq("status", "Duplicate").order("created_at", { ascending: false }),
    supabase.from("knowledge_entries").select("id, title, content_text, knowledge_documents!inner(is_visible, is_current)").eq("is_visible", true).eq("knowledge_documents.is_visible", true).eq("knowledge_documents.is_current", true),
    supabase.from("question_similarity").select("source_question_id, similar_question_id, similarity_score").gte("similarity_score", 0.65),
  ]);
  if (error) throw new Error("GAP_SOURCE_UNAVAILABLE");
  const questions = (data as unknown as QuestionRow[]).filter((question) => {
    const suggestions = question.question_knowledge_suggestions ?? [];
    return !question.answer_markdown || question.status === "Needs follow-up" ||
      question.question_feedback?.some((feedback) => feedback.satisfaction_status === "not_satisfied") ||
      suggestions.some((suggestion) => suggestion.suggestion_status === "rejected") || suggestions.length === 0;
  });

  const parent = questions.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const join = (left: number, right: number) => { const a = find(left); const b = find(right); if (a !== b) parent[b] = a; };
  for (let left = 0; left < questions.length; left += 1) {
    for (let right = left + 1; right < questions.length; right += 1) {
      const sameModule = questions[left].module_topic && questions[right].module_topic && questions[left].module_topic === questions[right].module_topic;
      const similarity = jaccardSimilarity(questions[left].question_text, questions[right].question_text);
      if (similarity >= (sameModule ? 0.2 : 0.34)) join(left, right);
    }
  }
  const indexByQuestionId = new Map(questions.map((question, index) => [question.id, index]));
  for (const similarity of similarityResult.data ?? []) {
    const left = indexByQuestionId.get(similarity.source_question_id);
    const right = indexByQuestionId.get(similarity.similar_question_id);
    if (left !== undefined && right !== undefined) join(left, right);
  }
  const clusters = new Map<number, QuestionRow[]>();
  questions.forEach((question, index) => { const root = find(index); clusters.set(root, [...(clusters.get(root) ?? []), question]); });
  const sources = (sourceResult.data ?? []) as unknown as Array<{ id: string; title: string; content_text: string }>;
  const clusterList = [...clusters.values()]; const labels = clusterList.map((cluster) => conceptLabel(cluster));
  const semanticMatches = new Map<number, { id: string; score: number }>();
  try {
    const embeddings = await createKnowledgeEmbeddings(labels);
    if (embeddings) await Promise.all(embeddings.map(async (embedding, index) => {
      const { data: matches } = await supabase.rpc("match_knowledge_entries", { query_embedding: embedding, match_count: 1 });
      if (matches?.[0]) semanticMatches.set(index, { id: matches[0].id, score: matches[0].semantic_score });
    }));
  } catch { /* Lexical gap coverage remains available when semantic indexing is disabled. */ }
  const computed: KnowledgeGap[] = clusterList.map((cluster, clusterIndex): KnowledgeGap => {
    const label = conceptLabel(cluster);
    const moduleTopic = cluster.map((question) => question.module_topic).find(Boolean) ?? null;
    const lexicalSources = sources.map((entry) => ({ id: entry.id, title: entry.title, score: Math.max(jaccardSimilarity(label, entry.title), jaccardSimilarity(cluster[0].question_text, `${entry.title} ${entry.content_text.slice(0, 3000)}`)) })).sort((a, b) => b.score - a.score);
    const semantic = semanticMatches.get(clusterIndex); const semanticEntry = semantic ? sources.find((entry) => entry.id === semantic.id) : null;
    const semanticLexical = semanticEntry ? Math.max(jaccardSimilarity(label, semanticEntry.title), jaccardSimilarity(cluster[0].question_text, `${semanticEntry.title} ${semanticEntry.content_text.slice(0, 3000)}`)) : 0;
    const semanticCandidate = semanticEntry && semantic ? { id: semanticEntry.id, title: semanticEntry.title, score: semanticLexical * .55 + semantic.score * .45 } : null;
    const source = [lexicalSources[0], semanticCandidate].filter((item): item is { id: string; title: string; score: number } => Boolean(item)).sort((a, b) => b.score - a.score)[0];
    const participants = new Set(cluster.map((question) => question.student_email.toLocaleLowerCase("en-US")));
    const voters = new Set(cluster.flatMap((question) => (question.question_votes ?? []).map((vote) => vote.voter_email.toLocaleLowerCase("en-US"))));
    const sessions = new Set(cluster.map((question) => `${question.class_date ?? ""}:${question.class_number ?? ""}`));
    const rejected = cluster.filter((question) => question.question_knowledge_suggestions?.some((item) => item.suggestion_status === "rejected")).length;
    const dissatisfied = cluster.filter((question) => question.question_feedback?.some((item) => item.satisfaction_status === "not_satisfied")).length;
    const followUp = cluster.filter((question) => question.status === "Needs follow-up").length;
    const unanswered = cluster.filter((question) => !question.answer_markdown).length;
    const score = cluster.length * 3 + participants.size * 2 + voters.size + rejected * 4 + dissatisfied * 5 + followUp * 3 + unanswered - (source?.score ?? 0) * 4;
    const keyTerms = [...questionTokens(label)].sort().join("-") || cluster[0].id;
    return {
      id: "", concept_key: `${(moduleTopic ?? "general").toLocaleLowerCase("en-US")}:${keyTerms}`.slice(0, 300), concept_label: label,
      module_topic: moduleTopic, suggested_kind: suggestedKind(cluster), status: "open",
      question_ids: cluster.map((question) => question.id), representative_questions: cluster.slice(0, 4).map(({ id, question_text }) => ({ id, question_text })),
      question_count: cluster.length, participant_count: participants.size, session_count: sessions.size, upvote_count: voters.size,
      rejected_suggestions: rejected, dissatisfied_count: dissatisfied, follow_up_count: followUp, unanswered_count: unanswered,
      existing_source: source && source.score > 0.05 ? source.title : null, source_match: source?.score ?? 0, score,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 50);

  const { data: existing, error: gapTableError } = await supabase.from("knowledge_gaps").select("id, concept_key, status");
  if (gapTableError && ["42P01", "PGRST205"].includes(gapTableError.code)) return { gaps: computed.map((gap) => ({ ...gap, id: gap.concept_key })), migrationRequired: true };
  if (gapTableError) throw new Error("GAP_STORE_UNAVAILABLE");
  const activeKeys = new Set(computed.map((gap) => gap.concept_key));
  for (const gap of computed) {
    const summary = { question_count: gap.question_count, participant_count: gap.participant_count, session_count: gap.session_count, upvote_count: gap.upvote_count, rejected_suggestions: gap.rejected_suggestions, dissatisfied_count: gap.dissatisfied_count, follow_up_count: gap.follow_up_count, unanswered_count: gap.unanswered_count, existing_source: gap.existing_source, source_match: gap.source_match, score: gap.score };
    const { data: saved, error: saveError } = await supabase.from("knowledge_gaps").upsert({ concept_key: gap.concept_key, concept_label: gap.concept_label, module_topic: gap.module_topic, suggested_kind: gap.suggested_kind, signal_summary: summary, updated_at: new Date().toISOString() }, { onConflict: "concept_key" }).select("id, status").single();
    if (saveError) throw new Error("GAP_STORE_UNAVAILABLE");
    gap.id = saved.id; gap.status = saved.status as KnowledgeGap["status"];
    await supabase.from("knowledge_gap_questions").delete().eq("gap_id", saved.id);
    await supabase.from("knowledge_gap_questions").insert(gap.question_ids.map((question_id) => ({ gap_id: saved.id, question_id })));
  }
  const staleIds = (existing ?? []).filter((gap) => !activeKeys.has(gap.concept_key) && ["open", "drafting"].includes(gap.status)).map((gap) => gap.id);
  if (staleIds.length) await supabase.from("knowledge_gaps").update({ status: "resolved", updated_at: new Date().toISOString() }).in("id", staleIds);
  return { gaps: computed, migrationRequired: false };
}
