import type { Metadata } from "next";

import { AdminAnswerWorkspace } from "@/components/admin-answer-workspace";
import { AdminAutoRefresh } from "@/components/admin-auto-refresh";
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
      <AdminAutoRefresh intervalMs={30_000} />
      <AdminAnswerWorkspace
        initialQuestions={questions}
        duplicateOptions={duplicateOptions}
        similarities={similarities}
      />
    </section>
  );
}
