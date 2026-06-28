import "server-only";

import type { PublicQuestion, PublicQuestionFilters } from "@/lib/questions/public-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveKnowledgeAssetUrls } from "@/lib/knowledge/assets";

type PublicQuestionRow = Omit<PublicQuestion, "upvote_count" | "canonical_question_id" | "canonical_question_text"> & {
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
  answer_html,
  answer_source,
  reference_links,
  is_answer_public,
  duplicate_of_question_id,
  created_at,
  question_votes(count)
`;

export async function getPublicQuestions(
  filters: PublicQuestionFilters = {},
): Promise<PublicQuestion[]> {
  const supabase = createAdminClient();
  const cutoff = (() => {
      const cutoff = new Date();
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
      return cutoff.toISOString();
    })();
  async function run(select: string) {
    let query = supabase.from("questions").select(select).eq("is_public", true).gte("created_at", cutoff).order("created_at", { ascending: false });
    for (const [field, value] of Object.entries(filters)) if (value) query = query.eq(field, value);
    return await query;
  }
  let result = await run(publicQuestionSelect);
  if (result.error?.code === "42703") result = await run(publicQuestionSelect.replace("  answer_html,\n  answer_source,\n", ""));
  const { data, error } = result;
  if (error) {
    console.error("Public questions query failed", {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });
    throw new Error("Unable to load public questions.");
  }

  const rows = data as unknown as Array<PublicQuestionRow & { duplicate_of_question_id: string | null }>;
  const questionIds = rows.map((row) => row.id);
  const canonicalIds = [...new Set(rows.flatMap((row) => row.duplicate_of_question_id ? [row.duplicate_of_question_id] : []))];
  const { data: canonicalRows } = canonicalIds.length
    ? await supabase.from("questions").select("id, question_text, status, answer_markdown, answer_html, answer_source, reference_links, is_answer_public, is_public").in("id", canonicalIds)
    : { data: [] };
  const canonicalById = new Map((canonicalRows ?? []).map((row) => [row.id, row]));
  const rootIds = [...new Set(rows.map((row) => row.duplicate_of_question_id ?? row.id))];
  const { data: duplicateMembers } = rootIds.length ? await supabase.from("questions").select("id, duplicate_of_question_id").in("duplicate_of_question_id", rootIds) : { data: [] };
  const allVoteQuestionIds = [...new Set([...questionIds, ...canonicalIds, ...(duplicateMembers ?? []).map((row) => row.id)])];
  const { data: voteRows } = allVoteQuestionIds.length
    ? await supabase.from("question_votes").select("question_id, voter_email").in("question_id", allVoteQuestionIds)
    : { data: [] };
  const membersByCanonical = new Map<string, Set<string>>();
  for (const row of rows) {
    const canonicalId = row.duplicate_of_question_id ?? row.id;
    const members = membersByCanonical.get(canonicalId) ?? new Set<string>([canonicalId]);
    members.add(row.id); membersByCanonical.set(canonicalId, members);
  }
  for (const row of duplicateMembers ?? []) {
    if (!row.duplicate_of_question_id) continue;
    const members = membersByCanonical.get(row.duplicate_of_question_id) ?? new Set<string>([row.duplicate_of_question_id]);
    members.add(row.id); membersByCanonical.set(row.duplicate_of_question_id, members);
  }
  const votesByQuestion = new Map<string, Set<string>>();
  for (const vote of voteRows ?? []) {
    const emails = votesByQuestion.get(vote.question_id) ?? new Set<string>();
    emails.add(vote.voter_email.trim().toLocaleLowerCase("en-US")); votesByQuestion.set(vote.question_id, emails);
  }
  const canonicalVoteCount = (canonicalId: string) => {
    const emails = new Set<string>();
    for (const memberId of membersByCanonical.get(canonicalId) ?? [canonicalId]) {
      for (const email of votesByQuestion.get(memberId) ?? []) emails.add(email);
    }
    return emails.size;
  };

  const mapped = await Promise.all(rows
    .filter((row) => !row.duplicate_of_question_id || canonicalById.get(row.duplicate_of_question_id)?.is_public === true)
    .map(async (row) => {
      const canonical = row.duplicate_of_question_id ? canonicalById.get(row.duplicate_of_question_id) : null;
      const answerVisible = canonical ? canonical.is_answer_public : row.is_answer_public;
      return {
          status: canonical?.status ?? row.status,
          answer_markdown: answerVisible ? canonical?.answer_markdown ?? row.answer_markdown : null,
          answer_html: answerVisible ? await resolveKnowledgeAssetUrls(canonical?.answer_html ?? row.answer_html ?? "") || null : null,
          answer_source: canonical?.answer_source ?? row.answer_source ?? ((canonical?.answer_html ?? row.answer_html) ? "knowledge" : "instructor"),
          reference_links: answerVisible ? canonical?.reference_links ?? row.reference_links : null,
          id: row.id,
          question_text: row.question_text,
          course_name: row.course_name,
          class_date: row.class_date,
          class_number: row.class_number,
          module_topic: row.module_topic,
          created_at: row.created_at,
          upvote_count: canonicalVoteCount(row.duplicate_of_question_id ?? row.id),
          canonical_question_id: row.duplicate_of_question_id,
          canonical_question_text: row.duplicate_of_question_id ? canonicalById.get(row.duplicate_of_question_id)?.question_text ?? null : null,
      };
    }));
  return mapped.sort(
      (left, right) =>
        right.upvote_count - left.upvote_count ||
        Date.parse(right.created_at) - Date.parse(left.created_at),
    );
}
