import type { Metadata } from "next";

import { AdminAnswerWorkspace } from "@/components/admin-answer-workspace";
import {
  getAdminQuestions,
  getDuplicateQuestionOptions,
  getStoredQuestionSimilarities,
} from "@/lib/questions/admin";

export const metadata: Metadata = { title: "Answer questions" };

export default async function AdminQuestionsPage() {
  const [questions, duplicateOptions, similarities] = await Promise.all([
    getAdminQuestions({ sort: "newest" }),
    getDuplicateQuestionOptions(),
    getStoredQuestionSimilarities(),
  ]);

  return (
    <section className="admin-page admin-answer-page">
      <AdminAnswerWorkspace
        initialQuestions={questions}
        duplicateOptions={duplicateOptions}
        similarities={similarities}
      />
    </section>
  );
}
