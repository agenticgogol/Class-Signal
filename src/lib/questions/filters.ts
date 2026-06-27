import { isValidIsoDate, questionLimits } from "@/lib/questions/validation";
import type { PublicQuestionFilters } from "@/lib/questions/public-types";

type SearchValues = Record<string, string | string[] | undefined>;

type FilterResult =
  | { success: true; data: PublicQuestionFilters }
  | { success: false; errors: Record<string, string> };

const filterLimits = {
  course_name: questionLimits.course_name,
  class_date: 10,
  class_number: questionLimits.class_number,
  module_topic: questionLimits.module_topic,
} as const;

export function validatePublicQuestionFilters(input: SearchValues): FilterResult {
  const filters: PublicQuestionFilters = {};
  const errors: Record<string, string> = {};

  for (const field of Object.keys(filterLimits) as Array<keyof typeof filterLimits>) {
    const rawValue = input[field];
    if (rawValue === undefined || rawValue === "") continue;

    if (Array.isArray(rawValue)) {
      errors[field] = "Use only one value for each filter.";
      continue;
    }

    const value = rawValue.trim();
    if (!value) continue;

    if (value.length > filterLimits[field]) {
      errors[field] = `Filter must be ${filterLimits[field]} characters or fewer.`;
      continue;
    }

    if (field === "class_date" && !isValidIsoDate(value)) {
      errors[field] = "Enter a valid class date.";
      continue;
    }

    filters[field] = value;
  }

  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, data: filters };
}
