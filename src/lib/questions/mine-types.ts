export type StudentQuestion = {
  id: string;
  question_text: string;
  status: string;
  answer_markdown: string | null;
  answer_html: string | null;
  is_answer_public: boolean;
  reference_links: string | null;
  course_name: string;
  class_date: string | null;
  class_number: string | null;
  module_topic: string | null;
  created_at: string;
  feedback: StudentQuestionFeedback | null;
  canonical_question_id: string | null;
  canonical_question_text: string | null;
};

export type StudentQuestionFeedback = {
  satisfaction_status: "satisfied" | "not_satisfied";
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentQuestionsResponse = {
  questions: StudentQuestion[];
};
