import type { Metadata } from "next";

import { AdminKnowledgeManager } from "@/components/admin-knowledge-manager";
import { getKnowledgeDocuments, getSuggestedQuestionIds } from "@/lib/knowledge/admin";
import { getAdminQuestions } from "@/lib/questions/admin";

export const metadata: Metadata = { title: "FAQ & Theory" };

export default async function KnowledgePage() {
  const [documents, questions, suggestedIds] = await Promise.all([
    getKnowledgeDocuments(), getAdminQuestions({ sort: "newest" }), getSuggestedQuestionIds(),
  ]);
  const gaps = questions.filter((question) => !question.answer_markdown && !suggestedIds.has(question.id)).map((question) => ({ id: question.id, question_text: question.question_text, module_topic: question.module_topic }));
  return <section className="admin-page"><AdminKnowledgeManager initialDocuments={documents} gaps={gaps} /></section>;
}
