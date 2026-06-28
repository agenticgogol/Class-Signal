import "server-only";

import type { StudentQuestion, StudentQuestionFeedback } from "@/lib/questions/mine-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveKnowledgeAssetUrls } from "@/lib/knowledge/assets";

const studentQuestionSelect = `
  id,
  question_text,
  status,
  answer_markdown,
  answer_html,
  is_answer_public,
  duplicate_of_question_id,
  reference_links,
  course_name,
  class_date,
  class_number,
  module_topic,
  created_at,
  question_feedback(satisfaction_status, reason, created_at, updated_at)
`;

type StudentQuestionRow = Omit<StudentQuestion, "feedback" | "canonical_question_id" | "canonical_question_text"> & {
  question_feedback: StudentQuestionFeedback[] | null;
};

export async function getQuestionsByStudentEmail(email: string): Promise<StudentQuestion[]> {
  const supabase = createAdminClient();
  async function run(select: string) {
    return await supabase.from("questions").select(select).eq("student_email", email).order("created_at", { ascending: false });
  }
  let result = await run(studentQuestionSelect);
  if (result.error?.code === "42703") result = await run(studentQuestionSelect.replace("  answer_html,\n", ""));
  const { data, error } = result;

  if (error) {
    console.error("Student question lookup failed", {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });
    throw new Error("Unable to load student questions.");
  }

  const rows = data as unknown as Array<StudentQuestionRow & { duplicate_of_question_id: string | null }>;
  const canonicalIds = [...new Set(rows.flatMap((row) => row.duplicate_of_question_id ? [row.duplicate_of_question_id] : []))];
  const { data: canonicalRows } = canonicalIds.length
    ? await supabase.from("questions").select("id, question_text, status, answer_markdown, answer_html, reference_links, is_answer_public").in("id", canonicalIds)
    : { data: [] };
  const canonicalById = new Map((canonicalRows ?? []).map((row) => [row.id, row]));

  return Promise.all(rows.map(async (row) => {
    const canonical = row.duplicate_of_question_id ? canonicalById.get(row.duplicate_of_question_id) : null;
    const answerVisible = canonical ? canonical.is_answer_public : row.is_answer_public;
    return ({
    id: row.id,
    question_text: row.question_text,
    status: canonical?.status ?? row.status,
    answer_markdown: answerVisible ? canonical?.answer_markdown ?? row.answer_markdown : null,
    answer_html: answerVisible ? await resolveKnowledgeAssetUrls(canonical?.answer_html ?? row.answer_html ?? "") || null : null,
    reference_links: answerVisible ? canonical?.reference_links ?? row.reference_links : null,
    is_answer_public: answerVisible,
    course_name: row.course_name,
    class_date: row.class_date,
    class_number: row.class_number,
    module_topic: row.module_topic,
    created_at: row.created_at,
    feedback: row.question_feedback?.[0] ?? null,
    canonical_question_id: row.duplicate_of_question_id,
    canonical_question_text: canonical?.question_text ?? null,
  });
  }));
}
