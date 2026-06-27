import "server-only";

import type { PublicQuestion, PublicQuestionFilters } from "@/lib/questions/public-types";
import { createAdminClient } from "@/lib/supabase/admin";

type PublicQuestionRow = Omit<PublicQuestion, "upvote_count"> & {
  is_answer_public: boolean;
  question_votes: Array<{ count: number }> | null;
};

// This allowlist is the privacy boundary for every public question response.
const publicQuestionSelect = `
  id,
  question_text,
  course_name,
  class_date,
  class_number,
  module_topic,
  status,
  answer_markdown,
  reference_links,
  is_answer_public,
  created_at,
  question_votes(count)
`;

export async function getPublicQuestions(
  filters: PublicQuestionFilters = {},
): Promise<PublicQuestion[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("questions")
    .select(publicQuestionSelect)
    .eq("is_public", true)
    .gte("created_at", (() => {
      const cutoff = new Date();
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
      return cutoff.toISOString();
    })())
    .order("created_at", { ascending: false });

  for (const [field, value] of Object.entries(filters)) {
    if (value) query = query.eq(field, value);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Public questions query failed", {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });
    throw new Error("Unable to load public questions.");
  }

  return (data as PublicQuestionRow[])
    .map((row) => ({
      id: row.id,
      question_text: row.question_text,
      course_name: row.course_name,
      class_date: row.class_date,
      class_number: row.class_number,
      module_topic: row.module_topic,
      status: row.status,
      answer_markdown: row.is_answer_public ? row.answer_markdown : null,
      reference_links: row.is_answer_public ? row.reference_links : null,
      created_at: row.created_at,
      upvote_count: row.question_votes?.[0]?.count ?? 0,
    }))
    .sort(
      (left, right) =>
        right.upvote_count - left.upvote_count ||
        Date.parse(right.created_at) - Date.parse(left.created_at),
    );
}
