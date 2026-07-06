import "server-only";

import type { ClasswiseAgendaEntry } from "@/lib/classwise-agenda/types";
import { createClient } from "@/lib/supabase/server";

const agendaLimits = {
  course_name: 160,
  class_number: 50,
  concepts: 20_000,
  hands_on: 20_000,
} as const;

export type AgendaSubmission = {
  course_name: string;
  class_number: string;
  class_date: string | null;
  concepts: string | null;
  hands_on: string | null;
  is_visible: boolean;
};

export type AgendaValidationResult =
  | { success: true; data: AgendaSubmission }
  | { success: false; errors: Record<string, string> };

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateAgendaSubmission(input: unknown): AgendaValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, errors: { form: "Submit a valid agenda entry." } };
  }
  const values = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const courseName = typeof values.course_name === "string" ? values.course_name.trim() : "";
  if (!courseName) errors.course_name = "Course name is required.";
  else if (courseName.length > agendaLimits.course_name) errors.course_name = `Course name must be ${agendaLimits.course_name} characters or fewer.`;

  const classNumber = typeof values.class_number === "string" ? values.class_number.trim() : "";
  if (!classNumber) errors.class_number = "Class number is required.";
  else if (classNumber.length > agendaLimits.class_number) errors.class_number = `Class number must be ${agendaLimits.class_number} characters or fewer.`;

  const rawClassDate = typeof values.class_date === "string" ? values.class_date.trim() : "";
  if (rawClassDate && !isValidIsoDate(rawClassDate)) errors.class_date = "Enter a valid class date.";

  const concepts = typeof values.concepts === "string" ? values.concepts.trim() : "";
  if (concepts.length > agendaLimits.concepts) errors.concepts = `Concepts must be ${agendaLimits.concepts} characters or fewer.`;

  const handsOn = typeof values.hands_on === "string" ? values.hands_on.trim() : "";
  if (handsOn.length > agendaLimits.hands_on) errors.hands_on = `Hands-on notes must be ${agendaLimits.hands_on} characters or fewer.`;

  if (Object.keys(errors).length > 0) return { success: false, errors };

  return {
    success: true,
    data: {
      course_name: courseName,
      class_number: classNumber,
      class_date: rawClassDate || null,
      concepts: concepts || null,
      hands_on: handsOn || null,
      is_visible: values.is_visible !== false,
    },
  };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return error || !data?.claims ? null : supabase;
}

const agendaColumns = "id, course_name, class_number, class_date, concepts, hands_on, is_visible, created_at, updated_at";

export async function getAgendaEntries(): Promise<{ entries: ClasswiseAgendaEntry[]; migrationRequired: boolean }> {
  const supabase = await authenticatedClient();
  if (!supabase) throw new Error("AUTH_REQUIRED");
  const { data, error } = await supabase.from("classwise_agenda").select(agendaColumns).order("class_number", { ascending: true });
  if (error?.code === "42P01" || error?.code === "PGRST205") return { entries: [], migrationRequired: true };
  if (error) throw new Error("AGENDA_STORE_UNAVAILABLE");
  return { entries: (data ?? []) as ClasswiseAgendaEntry[], migrationRequired: false };
}

export async function createAgendaEntry(submission: AgendaSubmission) {
  const supabase = await authenticatedClient();
  if (!supabase) throw new Error("AUTH_REQUIRED");
  const { data, error } = await supabase.from("classwise_agenda").insert(submission).select(agendaColumns).single();
  if (error) throw error;
  return data as ClasswiseAgendaEntry;
}

export async function updateAgendaEntry(id: string, submission: AgendaSubmission) {
  const supabase = await authenticatedClient();
  if (!supabase) throw new Error("AUTH_REQUIRED");
  const { data, error } = await supabase.from("classwise_agenda").update(submission).eq("id", id).select(agendaColumns).single();
  if (error) throw error;
  return data as ClasswiseAgendaEntry;
}

export async function deleteAgendaEntry(id: string) {
  const supabase = await authenticatedClient();
  if (!supabase) throw new Error("AUTH_REQUIRED");
  const { error } = await supabase.from("classwise_agenda").delete().eq("id", id);
  if (error) throw error;
}
