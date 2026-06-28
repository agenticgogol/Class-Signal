import "server-only";

import type {
  AdminQuestion,
  AdminQuestionFilters,
  DuplicateQuestionOption,
  SimilarQuestionsBySource,
} from "@/lib/questions/admin-types";
import { createClient } from "@/lib/supabase/server";

type AdminQuestionRow = Omit<AdminQuestion, "upvote_count" | "feedback"> & {
  question_votes: Array<{ count: number }> | null;
  question_feedback: AdminQuestion["feedback"][] | null;
};

const adminQuestionSelect = `
  id, student_name, student_email, course_name, class_date, class_number,
  module_topic, question_text, normalized_question_text, status, priority,
  answer_markdown, reference_links, admin_notes, ai_draft_answer, is_answer_public, is_public,
  duplicate_of_question_id, created_at, updated_at, answered_at,
  question_votes(count),
  question_feedback(satisfaction_status, reason, participant_email, created_at, updated_at)
`;

const priorityRank: Record<string, number> = {
  "Discuss live": 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export async function getAdminQuestions(filters: AdminQuestionFilters): Promise<AdminQuestion[]> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) throw new Error("Unauthorized admin question request.");

  let query = supabase.from("questions").select(adminQuestionSelect);
  for (const field of ["course_name", "class_date", "class_number", "module_topic", "status", "priority"] as const) {
    const value = filters[field];
    if (value) query = query.eq(field, value);
  }
  if (filters.asked_from) query = query.gte("created_at", `${filters.asked_from}T00:00:00.000Z`);
  if (filters.asked_to) {
    const exclusiveEnd = new Date(`${filters.asked_to}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    query = query.lt("created_at", exclusiveEnd.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error("Admin questions query failed", { code: error.code, message: error.message, hint: error.hint });
    throw new Error("Unable to load admin questions.");
  }

  let questions = (data as AdminQuestionRow[]).map((row) => ({
    id: row.id,
    student_name: row.student_name,
    student_email: row.student_email,
    course_name: row.course_name,
    class_date: row.class_date,
    class_number: row.class_number,
    module_topic: row.module_topic,
    question_text: row.question_text,
    normalized_question_text: row.normalized_question_text,
    status: row.status,
    priority: row.priority,
    answer_markdown: row.answer_markdown,
    answer_source: "instructor" as const,
    reference_links: row.reference_links,
    admin_notes: row.admin_notes,
    ai_draft_answer: row.ai_draft_answer,
    is_answer_public: row.is_answer_public,
    is_public: row.is_public,
    duplicate_of_question_id: row.duplicate_of_question_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    answered_at: row.answered_at,
    upvote_count: row.question_votes?.[0]?.count ?? 0,
    feedback: row.question_feedback?.[0] ?? null,
  }));

  if (filters.search) {
    const search = filters.search.toLocaleLowerCase("en-US");
    questions = questions.filter((question) =>
      [question.question_text, question.student_name, question.student_email].some((value) =>
        value.toLocaleLowerCase("en-US").includes(search),
      ),
    );
  }
  if (filters.student_name) {
    const name = filters.student_name.toLocaleLowerCase("en-US");
    questions = questions.filter((question) => question.student_name.toLocaleLowerCase("en-US").includes(name));
  }
  if (filters.student_email) {
    const email = filters.student_email.toLocaleLowerCase("en-US");
    questions = questions.filter((question) => question.student_email.toLocaleLowerCase("en-US").includes(email));
  }

  if (filters.satisfaction_status) {
    questions = questions.filter((question) => question.feedback?.satisfaction_status === filters.satisfaction_status);
  }
  if (filters.feedback_presence === "has_feedback") {
    questions = questions.filter((question) => question.feedback !== null);
  } else if (filters.feedback_presence === "no_feedback") {
    questions = questions.filter((question) => question.feedback === null);
  }
  if (filters.not_satisfied_only) {
    questions = questions.filter((question) => question.feedback?.satisfaction_status === "not_satisfied");
  }
  if (filters.answered_state) {
    questions = questions.filter((question) => {
      const answered = Boolean(question.answer_markdown?.trim()) || question.status === "Answered";
      return filters.answered_state === "answered" ? answered : !answered;
    });
  }
  if (filters.visibility) {
    questions = questions.filter((question) => filters.visibility === "public" ? question.is_public : !question.is_public);
  }
  if (filters.ai_draft_state) {
    questions = questions.filter((question) => filters.ai_draft_state === "has_ai_draft" ? Boolean(question.ai_draft_answer?.trim()) : !question.ai_draft_answer?.trim());
  }
  if (filters.duplicate_state) {
    questions = questions.filter((question) => {
      const duplicate = Boolean(question.duplicate_of_question_id) || question.status === "Duplicate";
      return filters.duplicate_state === "duplicate" ? duplicate : !duplicate;
    });
  }

  return questions.sort((left, right) => {
    if (filters.sort === "upvotes") return right.upvote_count - left.upvote_count || Date.parse(right.created_at) - Date.parse(left.created_at);
    if (filters.sort === "status") return left.status.localeCompare(right.status) || Date.parse(right.created_at) - Date.parse(left.created_at);
    if (filters.sort === "priority") return (priorityRank[left.priority] ?? 99) - (priorityRank[right.priority] ?? 99) || Date.parse(right.created_at) - Date.parse(left.created_at);
    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });
}

export async function getDuplicateQuestionOptions(): Promise<DuplicateQuestionOption[]> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) throw new Error("Unauthorized duplicate options request.");

  const { data, error } = await supabase
    .from("questions")
    .select("id, question_text, course_name")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Duplicate question options query failed", { code: error.code, message: error.message });
    throw new Error("Unable to load duplicate options.");
  }

  return (data as DuplicateQuestionOption[]).map((row) => ({
    id: row.id,
    question_text: row.question_text,
    course_name: row.course_name,
  }));
}

export async function getStoredQuestionSimilarities(): Promise<SimilarQuestionsBySource> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) throw new Error("Unauthorized similarity request.");

  const { data: similarities, error } = await supabase
    .from("question_similarity")
    .select("source_question_id, similar_question_id, similarity_score, method, similarity_reason")
    .order("similarity_score", { ascending: false });
  if (error) {
    console.error("Question similarities query failed", { code: error.code, message: error.message });
    throw new Error("Unable to load question similarities.");
  }

  const questionIds = [...new Set((similarities ?? []).map((row) => row.similar_question_id))];
  if (questionIds.length === 0) return {};
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, question_text, course_name, status")
    .in("id", questionIds);
  if (questionsError) {
    console.error("Similar question details query failed", {
      code: questionsError.code,
      message: questionsError.message,
    });
    throw new Error("Unable to load similar question details.");
  }

  const questionById = new Map((questions ?? []).map((question) => [question.id, question]));
  const grouped: SimilarQuestionsBySource = {};
  for (const similarity of similarities ?? []) {
    const question = questionById.get(similarity.similar_question_id);
    if (!question) continue;
    (grouped[similarity.source_question_id] ??= []).push({
      ...question,
      similarity_score: Number(similarity.similarity_score),
      method: similarity.method,
      similarity_reason: similarity.similarity_reason,
    });
  }
  return grouped;
}
