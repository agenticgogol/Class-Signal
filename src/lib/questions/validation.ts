export const questionLimits = {
  student_name: 100,
  student_email: 254,
  course_name: 160,
  class_number: 50,
  module_topic: 200,
  question_text: 4000,
} as const;

export type QuestionSubmission = {
  student_name: string;
  student_email: string;
  module_topic: string;
  question_text: string;
};

export type ValidationResult =
  | { success: true; data: QuestionSubmission }
  | { success: false; errors: Record<string, string> };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateQuestionSubmission(input: unknown): ValidationResult {
  if (!isPlainObject(input)) {
    return { success: false, errors: { form: "Submit a valid question." } };
  }

  const fields = ["student_name", "student_email", "module_topic", "question_text"] as const;
  const data = {} as QuestionSubmission;
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = input[field];
    const label = field.replaceAll("_", " ");

    if (typeof value !== "string" || value.trim().length === 0) {
      errors[field] = `${label} is required.`;
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > questionLimits[field]) {
      errors[field] = `${label} must be ${questionLimits[field]} characters or fewer.`;
      continue;
    }

    data[field] = trimmed;
  }

  if (data.student_email && !emailPattern.test(data.student_email)) {
    errors.student_email = "Enter a valid email address.";
  }

  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, data };
}

export function normalizeQuestionText(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
}

export type UpvoteSubmission = { question_id: string; voter_email: string };

export function validateEmailLookup(input: unknown):
  | { success: true; data: { student_email: string } }
  | { success: false; errors: Record<string, string> } {
  if (!isPlainObject(input)) {
    return { success: false, errors: { form: "Submit a valid email lookup." } };
  }

  const email = typeof input.student_email === "string" ? input.student_email.trim() : "";
  if (!email || email.length > questionLimits.student_email || !emailPattern.test(email)) {
    return { success: false, errors: { student_email: "Enter a valid email address." } };
  }

  return {
    success: true,
    data: { student_email: email.toLocaleLowerCase("en-US") },
  };
}

export function validateUpvoteSubmission(input: unknown):
  | { success: true; data: UpvoteSubmission }
  | { success: false; errors: Record<string, string> } {
  if (!isPlainObject(input)) {
    return { success: false, errors: { form: "Submit a valid upvote." } };
  }

  const errors: Record<string, string> = {};
  const questionId = typeof input.question_id === "string" ? input.question_id.trim() : "";
  const voterEmail = typeof input.voter_email === "string" ? input.voter_email.trim() : "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(questionId)) {
    errors.question_id = "Select a valid question.";
  }
  if (!voterEmail) {
    errors.voter_email = "Email address is required.";
  } else if (voterEmail.length > questionLimits.student_email || !emailPattern.test(voterEmail)) {
    errors.voter_email = "Enter a valid email address.";
  }

  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, data: { question_id: questionId, voter_email: voterEmail } };
}
