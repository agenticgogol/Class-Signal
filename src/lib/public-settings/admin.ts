import "server-only";

import type { PublicSettings } from "@/lib/public-settings/types";
import { createClient } from "@/lib/supabase/server";

const defaults: PublicSettings = {
  active_access_code: "AgenticAI-2026",
  public_board_enabled: true,
  submissions_enabled: true,
  voting_enabled: true,
  default_course_name: "Advanced Agentic AI",
  timezone: "Asia/Kolkata",
  updated_at: null,
};

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) throw new Error("AUTH_REQUIRED");
  return supabase;
}

export function validatePublicSettings(input: unknown):
  | { success: true; data: Omit<PublicSettings, "updated_at"> }
  | { success: false; message: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, message: "Submit valid public board settings." };
  }
  const record = input as Record<string, unknown>;
  const allowed = new Set([
    "active_access_code", "public_board_enabled", "submissions_enabled", "voting_enabled",
    "default_course_name", "timezone",
  ]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    return { success: false, message: "The settings contain unsupported fields." };
  }
  const accessCode = typeof record.active_access_code === "string" ? record.active_access_code.trim() : "";
  const courseName = typeof record.default_course_name === "string" ? record.default_course_name.trim() : "";
  const timezone = typeof record.timezone === "string" ? record.timezone.trim() : "";
  if (accessCode.length > 200) return { success: false, message: "Access code must be 200 characters or fewer." };
  if (!courseName || courseName.length > 160) return { success: false, message: "Default course name is required." };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    return { success: false, message: "Enter a valid IANA timezone, such as Asia/Kolkata." };
  }
  for (const field of ["public_board_enabled", "submissions_enabled", "voting_enabled"] as const) {
    if (typeof record[field] !== "boolean") return { success: false, message: "Toggle values must be true or false." };
  }
  return {
    success: true,
    data: {
      active_access_code: accessCode || null,
      public_board_enabled: record.public_board_enabled as boolean,
      submissions_enabled: record.submissions_enabled as boolean,
      voting_enabled: record.voting_enabled as boolean,
      default_course_name: courseName,
      timezone,
    },
  };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase
    .from("public_settings")
    .select("active_access_code, public_board_enabled, submissions_enabled, voting_enabled, default_course_name, timezone, updated_at")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("SETTINGS_UNAVAILABLE");
  return data ? data as PublicSettings : defaults;
}

export async function savePublicSettings(values: Omit<PublicSettings, "updated_at">): Promise<PublicSettings> {
  const supabase = await authenticatedClient();
  const { data: existing, error: lookupError } = await supabase
    .from("public_settings")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error("SETTINGS_UNAVAILABLE");

  const result = existing
    ? await supabase.from("public_settings").update(values).eq("id", existing.id)
      .select("active_access_code, public_board_enabled, submissions_enabled, voting_enabled, default_course_name, timezone, updated_at").single()
    : await supabase.from("public_settings").insert({ ...values, is_active: true })
      .select("active_access_code, public_board_enabled, submissions_enabled, voting_enabled, default_course_name, timezone, updated_at").single();
  if (result.error) {
    console.error("Public settings save failed", { code: result.error.code, message: result.error.message });
    throw new Error("SETTINGS_UNAVAILABLE");
  }
  return result.data as PublicSettings;
}
