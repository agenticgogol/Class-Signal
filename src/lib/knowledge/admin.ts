import "server-only";

import type { KnowledgeDocument } from "@/lib/knowledge/types";
import { createClient } from "@/lib/supabase/server";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) throw new Error("AUTH_REQUIRED");
  return supabase;
}

export async function getKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, title, kind, source_filename, module_topic, is_visible, document_key, version_number, is_current, supersedes_document_id, created_at, updated_at, knowledge_entries(id, title, module_topic, is_visible, sequence_number, created_at)")
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    if (error.code === "42703") {
      const { data: legacy, error: legacyError } = await supabase.from("knowledge_documents").select("id, title, kind, source_filename, module_topic, is_visible, created_at, updated_at, knowledge_entries(id, title, module_topic, is_visible, created_at)").order("created_at", { ascending: false });
      if (!legacyError) return (legacy ?? []).map((document) => ({ ...document, document_key: document.source_filename ?? document.id, version_number: 1, is_current: true, supersedes_document_id: null, knowledge_entries: (document.knowledge_entries ?? []).map((entry, sequence_number) => ({ ...entry, sequence_number })) })) as unknown as KnowledgeDocument[];
    }
    console.error("Knowledge documents query failed", { code: error.code, message: error.message });
    throw new Error("KNOWLEDGE_UNAVAILABLE");
  }
  return (data ?? []).map((document) => ({ ...document, knowledge_entries: [...(document.knowledge_entries ?? [])].sort((left, right) => left.sequence_number - right.sequence_number) })) as unknown as KnowledgeDocument[];
}

export async function getSuggestedQuestionIds() {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.from("question_knowledge_suggestions").select("question_id");
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return new Set<string>();
    console.error("Knowledge suggestion ids query failed", { code: error.code, message: error.message });
    throw new Error("KNOWLEDGE_UNAVAILABLE");
  }
  return new Set((data ?? []).map((row) => row.question_id));
}
