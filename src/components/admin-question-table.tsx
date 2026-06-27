"use client";

import { format, parseISO } from "date-fns";
import { Edit3, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AdminQuestionEditor } from "@/components/admin-question-editor";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import type {
  AdminQuestion,
  DuplicateQuestionOption,
  SimilarQuestionsBySource,
} from "@/lib/questions/admin-types";

export function AdminQuestionTable({
  questions,
  duplicateOptions,
  similarities,
}: {
  questions: AdminQuestion[];
  duplicateOptions: DuplicateQuestionOption[];
  similarities: SimilarQuestionsBySource;
}) {
  const [selected, setSelected] = useState<AdminQuestion | null>(null);

  if (questions.length === 0) {
    return (
      <div className="admin-table-empty">
        <h3>No questions match the current filters.</h3>
        <p>Clear the filters or change the search terms to bring submissions back into view.</p>
        <Link className="button button--secondary" href="/admin/dashboard">
          Reset dashboard
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-question-table">
          <thead><tr><th>Student</th><th>Question</th><th>Class</th><th>Status</th><th>Priority</th><th>Feedback</th><th>Votes</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {questions.map((question) => (
              <tr key={question.id}>
                <td><strong>{question.student_name}</strong><span>{question.student_email}</span></td>
                <td className="admin-question-cell"><strong>{question.question_text}</strong><span>{question.module_topic ?? "No module"}{!question.is_public && <> · <EyeOff size={12} /> Private</>}</span></td>
                <td><strong>{question.course_name}</strong><span>{question.class_date ?? "No date"} · #{question.class_number ?? "—"}</span></td>
                <td><StatusBadge status={question.status} /></td>
                <td><PriorityBadge priority={question.priority} /></td>
                <td className="admin-feedback-cell">
                  {question.feedback ? (
                    <><strong className={`feedback-status feedback-status--${question.feedback.satisfaction_status}`}>{question.feedback.satisfaction_status === "satisfied" ? "Satisfied" : "Not satisfied"}</strong><span>{question.feedback.reason ?? "No reason provided"}</span></>
                  ) : <span>No feedback</span>}
                </td>
                <td className="admin-vote-count">{question.upvote_count}</td>
                <td><time dateTime={question.created_at}>{format(parseISO(question.created_at), "MMM d, yyyy")}</time></td>
                <td><button className="admin-edit-button" type="button" onClick={() => setSelected(question)}><Edit3 size={15} /> Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <AdminQuestionEditor
          key={selected.id}
          question={selected}
          duplicateOptions={duplicateOptions}
          initialSimilarQuestions={similarities[selected.id] ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
