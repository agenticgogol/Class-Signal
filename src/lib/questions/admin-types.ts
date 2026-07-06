export const questionStatuses = [
  "New",
  "Answered",
  "Explained verbally",
  "Will discuss later",
  "Out of scope",
  "Duplicate",
  "Needs follow-up",
] as const;

export const questionPriorities = ["Low", "Medium", "High", "Discuss live"] as const;
export const adminSortOptions = ["newest", "upvotes", "status", "priority"] as const;
export const satisfactionStatuses = ["satisfied", "not_satisfied"] as const;
export const feedbackPresenceOptions = ["has_feedback", "no_feedback"] as const;
export const answeredStateOptions = ["answered", "unanswered"] as const;
export const visibilityOptions = ["public", "private"] as const;
export const aiDraftStateOptions = ["has_ai_draft", "no_ai_draft"] as const;
export const duplicateStateOptions = ["duplicate", "not_duplicate"] as const;
export const questionStatusLabel = (status: string) => status === "Will discuss later" ? "Will be discussed later" : status === "Out of scope" ? "Out of course scope" : status;

export type QuestionStatus = (typeof questionStatuses)[number];
export type QuestionPriority = (typeof questionPriorities)[number];
export type AdminQuestionSort = (typeof adminSortOptions)[number];
export type SatisfactionStatus = (typeof satisfactionStatuses)[number];
export type FeedbackPresence = (typeof feedbackPresenceOptions)[number];
export type AnsweredState = (typeof answeredStateOptions)[number];
export type VisibilityState = (typeof visibilityOptions)[number];
export type AiDraftState = (typeof aiDraftStateOptions)[number];
export type DuplicateState = (typeof duplicateStateOptions)[number];

export type QuestionFeedback = {
  satisfaction_status: SatisfactionStatus;
  reason: string | null;
  participant_email: string;
  created_at: string;
  updated_at: string;
};

export type AdminQuestion = {
  id: string;
  student_name: string;
  student_email: string;
  course_name: string;
  class_date: string | null;
  class_number: string | null;
  module_topic: string | null;
  question_text: string;
  normalized_question_text: string | null;
  status: string;
  priority: string;
  answer_markdown: string | null;
  reference_links: string | null;
  admin_notes: string | null;
  ai_draft_answer: string | null;
  ai_answer_mode: "course" | "external" | null;
  answer_source: "instructor" | "knowledge";
  is_answer_public: boolean;
  is_public: boolean;
  duplicate_of_question_id: string | null;
  created_at: string;
  updated_at: string;
  answered_at: string | null;
  upvote_count: number;
  feedback: QuestionFeedback | null;
};

export type AdminQuestionFilters = {
  course_name?: string;
  class_date?: string;
  asked_from?: string;
  asked_to?: string;
  class_number?: string;
  module_topic?: string;
  student_name?: string;
  student_email?: string;
  status?: QuestionStatus;
  priority?: QuestionPriority;
  search?: string;
  satisfaction_status?: SatisfactionStatus;
  feedback_presence?: FeedbackPresence;
  not_satisfied_only?: boolean;
  answered_state?: AnsweredState;
  visibility?: VisibilityState;
  ai_draft_state?: AiDraftState;
  duplicate_state?: DuplicateState;
  sort: AdminQuestionSort;
};

export type DuplicateQuestionOption = {
  id: string;
  question_text: string;
  course_name: string;
};

export type SimilarQuestion = {
  id: string;
  question_text: string;
  course_name: string;
  status: string;
  similarity_score: number;
  method: string;
  similarity_reason: string | null;
  participant_count?: number;
};

export type SimilarQuestionsBySource = Record<string, SimilarQuestion[]>;
