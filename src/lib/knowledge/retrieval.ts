import "server-only";

import type { GroundingSource } from "@/lib/ai/types";
import { createKnowledgeEmbeddings } from "@/lib/knowledge/embeddings";
import { jaccardSimilarity } from "@/lib/questions/similarity";
import { createAdminClient } from "@/lib/supabase/admin";

type EntryRow = {
  id: string;
  title: string;
  module_topic: string | null;
  content_text: string;
  provenance_label: string | null;
  knowledge_documents: {
    kind: "faq" | "theory" | "code";
    title: string;
    module_topic: string | null;
  };
};

export async function retrieveCourseSources(questionText: string, moduleTopic: string | null) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_entries")
    .select("id, title, module_topic, content_text, provenance_label, knowledge_documents!inner(kind, title, module_topic, is_visible, is_current)")
    .eq("is_visible", true)
    .eq("knowledge_documents.is_visible", true)
    .eq("knowledge_documents.is_current", true);

  if (error) {
    console.error("Grounding source lookup failed", { code: error.code, message: error.message });
    throw new Error("GROUNDING_UNAVAILABLE");
  }

  const semanticById = new Map<string, number>();
  try {
    const embedding = (await createKnowledgeEmbeddings([questionText]))?.[0];
    if (embedding) {
      const { data: semantic } = await supabase.rpc("match_knowledge_entries", { query_embedding: embedding, match_count: 20 });
      for (const match of semantic ?? []) semanticById.set(match.id, match.semantic_score);
    }
  } catch { /* Phase 3 migration or embedding provider is optional; lexical retrieval remains available. */ }
  const normalizedModule = moduleTopic?.trim().toLocaleLowerCase("en-US");
  const ranked = (data as unknown as EntryRow[]).map((entry) => {
    const textScore = Math.max(
      jaccardSimilarity(questionText, entry.title),
      jaccardSimilarity(questionText, `${entry.title} ${entry.content_text.slice(0, 5000)}`),
    );
    const entryModule = (entry.module_topic ?? entry.knowledge_documents.module_topic)?.trim().toLocaleLowerCase("en-US");
    const moduleBoost = normalizedModule && entryModule &&
      (entryModule.includes(normalizedModule) || normalizedModule.includes(entryModule)) ? 0.12 : 0;
    const semanticScore = semanticById.get(entry.id) ?? null;
    const hybridScore = semanticScore === null ? textScore : textScore * 0.55 + semanticScore * 0.45;
    return { entry, lexicalScore: textScore, semanticScore, score: Math.min(1, hybridScore + moduleBoost) };
  }).filter(({ score }) => score >= 0.08)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  let remainingCharacters = 16_000;
  const sources: GroundingSource[] = [];
  for (const [index, item] of ranked.entries()) {
    if (remainingCharacters < 500) break;
    const excerpt = item.entry.content_text.trim().slice(0, Math.min(5_000, remainingCharacters));
    if (!excerpt) continue;
    remainingCharacters -= excerpt.length;
    sources.push({
      citationId: `C${index + 1}`,
      entryId: item.entry.id,
      kind: item.entry.knowledge_documents.kind,
      documentTitle: item.entry.knowledge_documents.title,
      sectionTitle: item.entry.title,
      moduleTopic: item.entry.module_topic ?? item.entry.knowledge_documents.module_topic,
      excerpt,
      similarityScore: item.score,
      lexicalScore: item.lexicalScore,
      semanticScore: item.semanticScore,
      provenanceLabel: item.entry.provenance_label,
    });
  }
  return sources;
}
