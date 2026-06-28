export type KnowledgeKind = "faq" | "theory";

export type KnowledgeEntrySummary = {
  id: string;
  title: string;
  module_topic: string | null;
  is_visible: boolean;
  created_at: string;
  sequence_number: number;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  kind: KnowledgeKind;
  source_filename: string | null;
  module_topic: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  document_key: string;
  version_number: number;
  is_current: boolean;
  supersedes_document_id: string | null;
  knowledge_entries: KnowledgeEntrySummary[];
};

export type PublicKnowledgeEntry = {
  id: string;
  title: string;
  module_topic: string | null;
  content_html: string;
  sequence_number: number;
};

export type PublicKnowledgeDocument = {
  id: string;
  title: string;
  kind: KnowledgeKind;
  module_topic: string | null;
  knowledge_entries: PublicKnowledgeEntry[];
};

export type KnowledgeSuggestion = {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content_html: string;
  similarity_score: number;
};
