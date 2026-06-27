import {
  adminSortOptions,
  questionPriorities,
  questionStatuses,
  satisfactionStatuses,
  feedbackPresenceOptions,
  answeredStateOptions,
  visibilityOptions,
  aiDraftStateOptions,
  duplicateStateOptions,
  type AdminQuestionFilters,
  type QuestionPriority,
  type QuestionStatus,
  type SatisfactionStatus,
  type FeedbackPresence,
  type AnsweredState,
  type VisibilityState,
  type AiDraftState,
  type DuplicateState,
} from "@/lib/questions/admin-types";
import { isValidIsoDate, questionLimits } from "@/lib/questions/validation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateAdminQuestionFilters(
  input: Record<string, string | string[] | undefined>,
): { success: true; data: AdminQuestionFilters } | { success: false; errors: string[] } {
  const errors: string[] = [];
  const data: AdminQuestionFilters = { sort: "newest" };
  const stringFields = {
    course_name: questionLimits.course_name,
    class_number: questionLimits.class_number,
    module_topic: questionLimits.module_topic,
    student_name: questionLimits.student_name,
    student_email: questionLimits.student_email,
    search: 200,
  } as const;

  for (const [field, maxLength] of Object.entries(stringFields)) {
    const raw = input[field];
    if (raw === undefined || raw === "") continue;
    if (Array.isArray(raw) || raw.trim().length > maxLength) {
      errors.push(`Invalid ${field.replaceAll("_", " ")} filter.`);
      continue;
    }
    if (raw.trim()) data[field as keyof typeof stringFields] = raw.trim();
  }

  const date = input.class_date;
  if (date && (Array.isArray(date) || !isValidIsoDate(date))) {
    errors.push("Invalid class date filter.");
  } else if (typeof date === "string" && date) {
    data.class_date = date;
  }

  for (const field of ["asked_from", "asked_to"] as const) {
    const value = input[field];
    if (value && (Array.isArray(value) || !isValidIsoDate(value))) {
      errors.push(`Invalid ${field === "asked_from" ? "asked from" : "asked to"} date.`);
    } else if (typeof value === "string" && value) {
      data[field] = value;
    }
  }
  if (data.asked_from && data.asked_to && data.asked_from > data.asked_to) {
    errors.push("Asked from date must be on or before asked to date.");
  }

  const status = input.status;
  if (status && (Array.isArray(status) || !questionStatuses.includes(status as QuestionStatus))) {
    errors.push("Invalid status filter.");
  } else if (typeof status === "string" && status) {
    data.status = status as QuestionStatus;
  }

  const priority = input.priority;
  if (priority && (Array.isArray(priority) || !questionPriorities.includes(priority as QuestionPriority))) {
    errors.push("Invalid priority filter.");
  } else if (typeof priority === "string" && priority) {
    data.priority = priority as QuestionPriority;
  }

  const sort = input.sort;
  if (sort && (Array.isArray(sort) || !adminSortOptions.includes(sort as AdminQuestionFilters["sort"]))) {
    errors.push("Invalid sort option.");
  } else if (typeof sort === "string" && sort) {
    data.sort = sort as AdminQuestionFilters["sort"];
  }

  const satisfaction = input.satisfaction_status;
  if (satisfaction && (Array.isArray(satisfaction) || !satisfactionStatuses.includes(satisfaction as SatisfactionStatus))) {
    errors.push("Invalid satisfaction status filter.");
  } else if (typeof satisfaction === "string" && satisfaction) {
    data.satisfaction_status = satisfaction as SatisfactionStatus;
  }

  const presence = input.feedback_presence;
  if (presence && (Array.isArray(presence) || !feedbackPresenceOptions.includes(presence as FeedbackPresence))) {
    errors.push("Invalid feedback presence filter.");
  } else if (typeof presence === "string" && presence) {
    data.feedback_presence = presence as FeedbackPresence;
  }

  const notSatisfiedOnly = input.not_satisfied_only;
  if (notSatisfiedOnly !== undefined && notSatisfiedOnly !== "true") {
    errors.push("Invalid not satisfied filter.");
  } else if (notSatisfiedOnly === "true") {
    data.not_satisfied_only = true;
  }


  for (const [field, options, message] of [
    ["answered_state", answeredStateOptions, "answered state"],
    ["visibility", visibilityOptions, "visibility"],
    ["ai_draft_state", aiDraftStateOptions, "AI draft state"],
    ["duplicate_state", duplicateStateOptions, "duplicate state"],
  ] as const) {
    const value = input[field];
    if (value && (Array.isArray(value) || !(options as readonly string[]).includes(value))) {
      errors.push(`Invalid ${message} filter.`);
    } else if (typeof value === "string" && value) {
      if (field === "answered_state") data.answered_state = value as AnsweredState;
      if (field === "visibility") data.visibility = value as VisibilityState;
      if (field === "ai_draft_state") data.ai_draft_state = value as AiDraftState;
      if (field === "duplicate_state") data.duplicate_state = value as DuplicateState;
    }
  }

  return errors.length > 0 ? { success: false, errors } : { success: true, data };
}

export type AdminQuestionUpdate = {
  status?: QuestionStatus;
  priority?: QuestionPriority;
  answer_markdown?: string | null;
  reference_links?: string | null;
  admin_notes?: string | null;
  is_public?: boolean;
  is_answer_public?: boolean;
  duplicate_of_question_id?: string | null;
};

const editableFields = new Set([
  "status",
  "priority",
  "answer_markdown",
  "reference_links",
  "admin_notes",
  "is_public",
  "is_answer_public",
  "duplicate_of_question_id",
]);

function optionalText(value: unknown, max: number) {
  if (value === null || value === "") return { valid: true as const, value: null };
  if (typeof value !== "string" || value.length > max) return { valid: false as const };
  return { valid: true as const, value: value.trim() || null };
}

export function validateAdminQuestionUpdate(input: unknown):
  | { success: true; data: AdminQuestionUpdate }
  | { success: false; message: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, message: "Submit a valid question update." };
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0 || keys.some((key) => !editableFields.has(key))) {
    return { success: false, message: "The update contains unsupported fields." };
  }

  const update: AdminQuestionUpdate = {};
  if ("status" in record) {
    if (typeof record.status !== "string" || !questionStatuses.includes(record.status as QuestionStatus)) {
      return { success: false, message: "Select a valid status." };
    }
    update.status = record.status as QuestionStatus;
  }
  if ("priority" in record) {
    if (typeof record.priority !== "string" || !questionPriorities.includes(record.priority as QuestionPriority)) {
      return { success: false, message: "Select a valid priority." };
    }
    update.priority = record.priority as QuestionPriority;
  }

  for (const [field, max] of [
    ["answer_markdown", 50_000],
    ["reference_links", 10_000],
    ["admin_notes", 20_000],
  ] as const) {
    if (field in record) {
      const result = optionalText(record[field], max);
      if (!result.valid) return { success: false, message: `${field.replaceAll("_", " ")} is too long.` };
      update[field] = result.value;
    }
  }

  if ("is_public" in record) {
    if (typeof record.is_public !== "boolean") {
      return { success: false, message: "Visibility must be true or false." };
    }
    update.is_public = record.is_public;
  }

  if ("is_answer_public" in record) {
    if (typeof record.is_answer_public !== "boolean") {
      return { success: false, message: "Answer visibility must be true or false." };
    }
    update.is_answer_public = record.is_answer_public;
  }

  if ("duplicate_of_question_id" in record) {
    const duplicate = record.duplicate_of_question_id;
    if (duplicate !== null && duplicate !== "" && (typeof duplicate !== "string" || !uuidPattern.test(duplicate))) {
      return { success: false, message: "Select a valid duplicate question." };
    }
    update.duplicate_of_question_id = typeof duplicate === "string" && duplicate ? duplicate : null;
  }

  return { success: true, data: update };
}

export function isQuestionId(value: string) {
  return uuidPattern.test(value);
}
