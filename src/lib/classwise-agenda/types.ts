export type ClasswiseAgendaEntry = {
  id: string;
  course_name: string;
  class_number: string;
  class_date: string | null;
  concepts: string | null;
  hands_on: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicClasswiseAgendaEntry = Pick<
  ClasswiseAgendaEntry,
  "id" | "class_number" | "class_date" | "concepts" | "hands_on"
>;
