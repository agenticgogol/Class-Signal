import "server-only";

import type { KnowledgeSuggestion } from "@/lib/knowledge/types";
import type { KnowledgeKind } from "@/lib/knowledge/types";
import { resolveKnowledgeAssetUrls } from "@/lib/knowledge/assets";
import { createKnowledgeEmbeddings } from "@/lib/knowledge/embeddings";
import { jaccardSimilarity } from "@/lib/questions/similarity";
import { createAdminClient } from "@/lib/supabase/admin";

type VisibleEntryRow = {
  id: string;
  title: string;
  content_html: string;
  content_text: string;
  normalized_text: string;
  provenance_label: string | null;
  knowledge_documents: { kind: KnowledgeKind; title: string; module_topic: string | null; is_visible: boolean; is_current: boolean };
};

export async function findKnowledgeSuggestion(questionText: string): Promise<Omit<KnowledgeSuggestion, "id"> | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_entries")
    .select("id, title, content_html, content_text, normalized_text, provenance_label, knowledge_documents!inner(kind, title, module_topic, is_visible, is_current)")
    .eq("is_visible", true)
    .eq("knowledge_documents.is_visible", true)
    .eq("knowledge_documents.is_current", true);
  // Only the active version is eligible for automatic answers.
  if (error) {
    console.error("Visible knowledge lookup failed", { code: error.code, message: error.message });
    return null;
  }

  const semanticById = new Map<string, number>();
  try {
    const embedding = (await createKnowledgeEmbeddings([questionText]))?.[0];
    if (embedding) {
      const { data: matches } = await supabase.rpc("match_knowledge_entries", { query_embedding: embedding, match_count: 20 });
      for (const match of matches ?? []) semanticById.set(match.id, match.semantic_score);
    }
  } catch { /* Optional semantic index unavailable; local similarity remains free. */ }
  const ranked = (data as unknown as VisibleEntryRow[]).map((entry) => {
    const titleScore = jaccardSimilarity(questionText, entry.title);
    const contextScore = jaccardSimilarity(questionText, `${entry.title} ${entry.content_text.slice(0, 2500)}`);
    const lexical = Math.max(titleScore, contextScore); const semantic = semanticById.get(entry.id);
    return { entry, score: semantic === undefined ? lexical : lexical * 0.55 + semantic * 0.45 };
  }).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best || best.score < 0.18) return null;
  return {
    entry_id: best.entry.id,
    kind: best.entry.knowledge_documents.kind,
    title: best.entry.title,
    content_html: await resolveKnowledgeAssetUrls(best.entry.content_html),
    similarity_score: best.score,
    confidence_band: best.score >= 0.45 ? "high" : best.score >= 0.27 ? "medium" : "low",
    document_title: best.entry.knowledge_documents.title,
    module_topic: best.entry.knowledge_documents.module_topic,
    provenance_label: best.entry.provenance_label,
  };
}
