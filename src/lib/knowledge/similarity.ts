import "server-only";

import type { KnowledgeSuggestion } from "@/lib/knowledge/types";
import { jaccardSimilarity } from "@/lib/questions/similarity";
import { createAdminClient } from "@/lib/supabase/admin";

type VisibleEntryRow = {
  id: string;
  title: string;
  content_html: string;
  content_text: string;
  normalized_text: string;
  knowledge_documents: { kind: "faq" | "theory"; is_visible: boolean; is_current: boolean };
};

export async function findKnowledgeSuggestion(questionText: string): Promise<Omit<KnowledgeSuggestion, "id"> & { entryId: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_entries")
    .select("id, title, content_html, content_text, normalized_text, knowledge_documents!inner(kind, is_visible, is_current)")
    .eq("is_visible", true)
    .eq("knowledge_documents.is_visible", true)
    .eq("knowledge_documents.is_current", true);
  // Only the active version is eligible for automatic answers.
  if (error) {
    console.error("Visible knowledge lookup failed", { code: error.code, message: error.message });
    return null;
  }

  const ranked = (data as unknown as VisibleEntryRow[]).map((entry) => {
    const titleScore = jaccardSimilarity(questionText, entry.title);
    const contextScore = jaccardSimilarity(questionText, `${entry.title} ${entry.content_text.slice(0, 2500)}`);
    return { entry, score: Math.max(titleScore, contextScore) };
  }).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best || best.score < 0.18) return null;
  return {
    entryId: best.entry.id,
    kind: best.entry.knowledge_documents.kind,
    title: best.entry.title,
    content_html: best.entry.content_html,
    similarity_score: best.score,
  };
}
