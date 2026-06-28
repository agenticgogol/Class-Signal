export type SessionDescriptor = { session_key: string; course_name: string; class_date: string; class_number: string | null; question_count: number };
export type JoinSession = SessionDescriptor & { id: string; public_id: string; is_active: boolean; created_at: string; closed_at: string | null; join_url?: string; qr_data_url?: string };
export type TeachingBriefMetrics = {
  generated_at: string;
  source_question_ids: string[];
  total_questions: number;
  answered: number;
  unresolved: number;
  unique_participants: number;
  total_upvotes: number;
  satisfied: number;
  not_satisfied: number;
  satisfaction_rate: number | null;
  most_confusing_module: { name: string; score: number; questions: number; negative_signals: number } | null;
  top_unresolved: Array<{ id: string; question: string; upvotes: number; module: string | null }>;
  follow_up: Array<{ id: string; question: string; reason: string | null }>;
  recommended_updates: Array<{ kind: "faq" | "theory" | "code"; concept: string; evidence_question_ids: string[] }>;
  suggested_agenda: string[];
};
export type TeachingBrief = {
  id: string; session_key: string; course_name: string; class_date: string; class_number: string | null;
  version_number: number; input_metrics: TeachingBriefMetrics; content_markdown: string; created_at: string;
};
