import type { AdminQuestion } from "@/lib/questions/admin-types";
import { createClient } from "@/lib/supabase/server";

type ExportQuestionRow = Omit<AdminQuestion, "upvote_count" | "feedback"> & {
  question_votes: Array<{ count: number }> | null;
};

const exportColumns = [
  "id",
  "student_name",
  "student_email",
  "course_name",
  "class_date",
  "class_number",
  "module_topic",
  "question_text",
  "normalized_question_text",
  "status",
  "priority",
  "answer_markdown",
  "reference_links",
  "admin_notes",
  "ai_draft_answer",
  "is_public",
  "duplicate_of_question_id",
  "is_answer_public",
  "created_at",
  "updated_at",
  "answered_at",
  "upvote_count",
] as const;

const exportSelect = `
  id, student_name, student_email, course_name, class_date, class_number,
  module_topic, question_text, normalized_question_text, status, priority,
  answer_markdown, reference_links, admin_notes, ai_draft_answer, is_public,
  duplicate_of_question_id, is_answer_public, created_at, updated_at, answered_at,
  question_votes(count)
`;

function csvCell(value: string | number | boolean | null) {
  let text = value === null ? "" : String(value);
  // Prevent user-provided text from becoming a spreadsheet formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  const rows: ExportQuestionRow[] = [];
  const pageSize = 1000;
  let offset = 0;
  let total: number | null = null;

  while (total === null || offset < total) {
    const { data, error, count } = await supabase
      .from("questions")
      .select(exportSelect, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Question CSV export failed", {
        code: error.code,
        message: error.message,
        hint: error.hint,
      });
      return Response.json({ message: "Questions could not be exported." }, { status: 500 });
    }

    const page = (data ?? []) as ExportQuestionRow[];
    rows.push(...page);
    total = count ?? rows.length;
    offset += page.length;
    if (page.length === 0) break;
  }

  const csvRows = rows.map((row) => {
    const values: Record<(typeof exportColumns)[number], string | number | boolean | null> = {
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
      reference_links: row.reference_links,
      admin_notes: row.admin_notes,
      ai_draft_answer: row.ai_draft_answer,
      is_public: row.is_public,
      duplicate_of_question_id: row.duplicate_of_question_id,
      is_answer_public: row.is_answer_public,
      created_at: row.created_at,
      updated_at: row.updated_at,
      answered_at: row.answered_at,
      upvote_count: row.question_votes?.[0]?.count ?? 0,
    };
    return exportColumns.map((column) => csvCell(values[column])).join(",");
  });

  const csv = [exportColumns.map(csvCell).join(","), ...csvRows].join("\r\n");
  const currentDate = new Date().toISOString().slice(0, 10);
  const filename = `live-course-questions-${currentDate}.csv`;

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
