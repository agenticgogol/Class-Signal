export type PublicQuestionFilters = {
  course_name?: string;
  class_date?: string;
  class_number?: string;
  module_topic?: string;
};

export type PublicQuestion = {
  id: string;
  question_text: string;
  course_name: string;
  class_date: string | null;
  class_number: string | null;
  module_topic: string | null;
  status: string;
  answer_markdown: string | null;
  answer_html: string | null;
  answer_source: "instructor" | "knowledge";
  reference_links: string | null;
  created_at: string;
  upvote_count: number;
  canonical_question_id: string | null;
  canonical_question_text: string | null;
};

export type PublicQuestionsResponse = {
  questions: PublicQuestion[];
};
