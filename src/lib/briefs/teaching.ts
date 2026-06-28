import "server-only";

import { createHash } from "node:crypto";

import type { AdminQuestion } from "@/lib/questions/admin-types";
import { getAdminQuestions } from "@/lib/questions/admin";
import { questionTokens } from "@/lib/questions/similarity";
import { createClient } from "@/lib/supabase/server";
import type { JoinSession, SessionDescriptor, TeachingBrief, TeachingBriefMetrics } from "@/lib/briefs/types";

export function sessionKey(courseName: string, classDate: string, classNumber: string | null) {
  return createHash("sha256").update(JSON.stringify([courseName.trim(), classDate, classNumber?.trim() || null])).digest("hex");
}

function answered(question: AdminQuestion) { return Boolean(question.answer_markdown?.trim()) || question.status === "Answered"; }
function knowledgeKind(text: string): "faq" | "theory" | "code" {
  if (/\b(code|python|function|class|api|error|debug|implementation)\b/i.test(text)) return "code";
  if (/\b(why|difference|concept|architecture|explain|works?)\b/i.test(text)) return "theory";
  return "faq";
}
function concept(question: string) {
  const terms = [...questionTokens(question)].slice(0, 5);
  return terms.length ? terms.map((term) => term[0].toUpperCase() + term.slice(1)).join(" · ") : question.slice(0, 80);
}
function questionLink(question: { id: string; question: string }) {
  return `[${question.question.replaceAll("[", "\\[").replaceAll("]", "\\]")}](/admin/questions?search=${encodeURIComponent(question.question.slice(0, 80))})`;
}

export async function getBriefWorkspace(): Promise<{ sessions: SessionDescriptor[]; joins: JoinSession[]; briefs: TeachingBrief[]; migrationRequired: boolean }> {
  const questions = await getAdminQuestions({ sort: "newest" });
  const grouped = new Map<string, SessionDescriptor>();
  for (const question of questions) {
    if (!question.class_date) continue;
    const key = sessionKey(question.course_name, question.class_date, question.class_number);
    const current = grouped.get(key);
    grouped.set(key, current ? { ...current, question_count: current.question_count + 1 } : { session_key: key, course_name: question.course_name, class_date: question.class_date, class_number: question.class_number, question_count: 1 });
  }
  const supabase = await createClient();
  const [joinResult, briefResult] = await Promise.all([
    supabase.from("class_join_sessions").select("id, public_id, session_key, course_name, class_date, class_number, is_active, created_at, closed_at").order("class_date", { ascending: false }),
    supabase.from("teaching_briefs").select("id, session_key, course_name, class_date, class_number, version_number, input_metrics, content_markdown, created_at").order("created_at", { ascending: false }),
  ]);
  const missing = [joinResult.error, briefResult.error].some((error) => error && ["42P01", "PGRST205"].includes(error.code));
  return {
    sessions: [...grouped.values()].sort((a, b) => b.class_date.localeCompare(a.class_date)),
    joins: missing ? [] : (joinResult.data ?? []).map((join) => ({ ...join, question_count: grouped.get(join.session_key)?.question_count ?? 0 })) as JoinSession[],
    briefs: missing ? [] : (briefResult.data ?? []) as unknown as TeachingBrief[],
    migrationRequired: missing,
  };
}

export async function generateTeachingBrief(input: { course_name: string; class_date: string; class_number: string | null }): Promise<TeachingBrief> {
  const questions = (await getAdminQuestions({ sort: "newest" })).filter((question) => question.course_name === input.course_name && question.class_date === input.class_date && (question.class_number ?? "") === (input.class_number ?? ""));
  if (!questions.length) throw new Error("SESSION_EMPTY");
  const unresolved = questions.filter((question) => !answered(question) && question.status !== "Duplicate").sort((a, b) => b.upvote_count - a.upvote_count || Date.parse(a.created_at) - Date.parse(b.created_at));
  const followUp = questions.filter((question) => question.status === "Needs follow-up" || question.feedback?.satisfaction_status === "not_satisfied");
  const moduleSignals = new Map<string, { questions: number; negative: number; score: number }>();
  for (const question of questions) {
    const name = question.module_topic?.trim() || "No module";
    const negative = (question.feedback?.satisfaction_status === "not_satisfied" ? 1 : 0) + (question.status === "Needs follow-up" ? 1 : 0) + (!answered(question) ? 1 : 0);
    const current = moduleSignals.get(name) ?? { questions: 0, negative: 0, score: 0 };
    moduleSignals.set(name, { questions: current.questions + 1, negative: current.negative + negative, score: current.score + 1 + negative * 3 + question.upvote_count });
  }
  const confusing = [...moduleSignals].sort((a, b) => b[1].score - a[1].score)[0];
  const satisfied = questions.filter((question) => question.feedback?.satisfaction_status === "satisfied").length;
  const notSatisfied = questions.filter((question) => question.feedback?.satisfaction_status === "not_satisfied").length;
  const updateCandidates = [...unresolved, ...followUp.filter((question) => !unresolved.some((item) => item.id === question.id))].slice(0, 5);
  const recommendedUpdates = updateCandidates.map((question) => ({ kind: knowledgeKind(question.question_text), concept: concept(question.question_text), evidence_question_ids: [question.id] }));
  const agenda = [
    ...(confusing ? [`Revisit ${confusing[0]} using one concrete worked example.`] : []),
    ...unresolved.slice(0, 3).map((question) => `Resolve: ${question.question_text}`),
    ...(followUp.length ? [`Close the loop with ${followUp.length} participant${followUp.length === 1 ? "" : "s"} awaiting follow-up.`] : []),
    ...(recommendedUpdates.length ? [`Review and publish ${recommendedUpdates.length} recommended Course Library update${recommendedUpdates.length === 1 ? "" : "s"}.`] : []),
  ].slice(0, 6);
  const feedbackCount = satisfied + notSatisfied;
  const metrics: TeachingBriefMetrics = {
    generated_at: new Date().toISOString(), source_question_ids: questions.map((question) => question.id), total_questions: questions.length,
    answered: questions.filter(answered).length, unresolved: unresolved.length,
    unique_participants: new Set(questions.map((question) => question.student_email.toLocaleLowerCase("en-US"))).size,
    total_upvotes: questions.reduce((sum, question) => sum + question.upvote_count, 0), satisfied, not_satisfied: notSatisfied,
    satisfaction_rate: feedbackCount ? satisfied / feedbackCount : null,
    most_confusing_module: confusing ? { name: confusing[0], score: confusing[1].score, questions: confusing[1].questions, negative_signals: confusing[1].negative } : null,
    top_unresolved: unresolved.slice(0, 5).map((question) => ({ id: question.id, question: question.question_text, upvotes: question.upvote_count, module: question.module_topic })),
    follow_up: followUp.slice(0, 10).map((question) => ({ id: question.id, question: question.question_text, reason: question.feedback?.reason ?? null })),
    recommended_updates: recommendedUpdates, suggested_agenda: agenda,
  };
  const percent = metrics.satisfaction_rate === null ? "No feedback yet" : `${Math.round(metrics.satisfaction_rate * 100)}% satisfied`;
  const markdown = [`# Post-class teaching brief`, ``, `**${input.course_name} · ${input.class_date}${input.class_number ? ` · Class ${input.class_number}` : ""}**`, ``, `Generated ${new Date(metrics.generated_at).toLocaleString()}. This is an immutable deterministic snapshot.`, ``, `## Session signal`, ``, `- ${metrics.total_questions} questions from ${metrics.unique_participants} participants`, `- ${metrics.answered} answered · ${metrics.unresolved} unresolved`, `- ${metrics.total_upvotes} consolidated upvotes`, `- ${percent} (${satisfied} satisfied, ${notSatisfied} not satisfied)`, ``, `## Most confusing module`, ``, metrics.most_confusing_module ? `**${metrics.most_confusing_module.name}** — ${metrics.most_confusing_module.questions} questions and ${metrics.most_confusing_module.negative_signals} negative/unresolved signals.` : `No module signal available.`, ``, `## Top unresolved questions`, ``, ...(metrics.top_unresolved.length ? metrics.top_unresolved.map((question) => `- ${questionLink(question)} — ${question.upvotes} votes${question.module ? ` · ${question.module}` : ""}`) : ["- No unresolved questions."]), ``, `## Follow-up list`, ``, ...(metrics.follow_up.length ? metrics.follow_up.map((question) => `- ${questionLink(question)}${question.reason ? ` — ${question.reason}` : ""}`) : ["- No participant follow-up required."]), ``, `## Recommended Course Library updates`, ``, ...(metrics.recommended_updates.length ? metrics.recommended_updates.map((update) => `- **${update.kind.toUpperCase()}** — ${update.concept}`) : ["- No update recommended from current signals."]), ``, `## Suggested next-class agenda`, ``, ...(metrics.suggested_agenda.length ? metrics.suggested_agenda.map((item, index) => `${index + 1}. ${item}`) : ["1. Continue with the planned syllabus."]), ``].join("\n");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) throw new Error("AUTH_REQUIRED");
  const key = sessionKey(input.course_name, input.class_date, input.class_number);
  const { data: latest } = await supabase.from("teaching_briefs").select("version_number").eq("session_key", key).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const { data: brief, error } = await supabase.from("teaching_briefs").insert({ session_key: key, course_name: input.course_name, class_date: input.class_date, class_number: input.class_number, version_number: (latest?.version_number ?? 0) + 1, input_metrics: metrics, content_markdown: markdown, created_by: auth.claims.sub }).select("id, session_key, course_name, class_date, class_number, version_number, input_metrics, content_markdown, created_at").single();
  if (error || !brief) throw new Error("BRIEF_SAVE_FAILED");
  return brief as unknown as TeachingBrief;
}
