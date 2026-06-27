import "server-only";

import type { StudentQuestion, StudentQuestionFeedback } from "@/lib/questions/mine-types";
import { createAdminClient } from "@/lib/supabase/admin";

const studentQuestionSelect = `
  id,
  question_text,
  status,
  answer_markdown,
  is_answer_public,
  reference_links,
  course_name,
  class_date,
  class_number,
  module_topic,
  created_at,
  question_feedback(satisfaction_status, reason, created_at, updated_at)
`;

type StudentQuestionRow = Omit<StudentQuestion, "feedback"> & {
  question_feedback: StudentQuestionFeedback[] | null;
};

export async function getQuestionsByStudentEmail(email: string): Promise<StudentQuestion[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .select(studentQuestionSelect)
    .eq("student_email", email)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Student question lookup failed", {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });
    throw new Error("Unable to load student questions.");
  }

  return (data as StudentQuestionRow[]).map((row) => ({
    id: row.id,
    question_text: row.question_text,
    status: row.status,
    answer_markdown: row.is_answer_public ? row.answer_markdown : null,
    reference_links: row.is_answer_public ? row.reference_links : null,
    is_answer_public: row.is_answer_public,
    course_name: row.course_name,
    class_date: row.class_date,
    class_number: row.class_number,
    module_topic: row.module_topic,
    created_at: row.created_at,
    feedback: row.question_feedback?.[0] ?? null,
  }));
}
