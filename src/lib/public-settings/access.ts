import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type { PublicAccessInfo, PublicSettings } from "@/lib/public-settings/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type StudentCapability = "board" | "submissions" | "voting";

export class StudentAccessError extends Error {
  constructor(public readonly publicMessage: string, public readonly status: number) {
    super(publicMessage);
    this.name = "StudentAccessError";
  }
}

async function getActiveSettings(): Promise<PublicSettings | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("public_settings")
    .select("active_access_code, public_board_enabled, submissions_enabled, voting_enabled, default_course_name, timezone, updated_at")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Public settings lookup failed", { code: error.code, message: error.message });
    throw new StudentAccessError("Class access is temporarily unavailable.", 503);
  }
  return data as PublicSettings | null;
}

function codesMatch(submitted: string, active: string) {
  const left = createHash("sha256").update(submitted).digest();
  const right = createHash("sha256").update(active).digest();
  return timingSafeEqual(left, right);
}

export async function validateStudentAccess(accessCode: unknown, capability: StudentCapability) {
  if (typeof accessCode !== "string" || !accessCode.trim() || accessCode.length > 200) {
    throw new StudentAccessError("Enter the active class access code.", 401);
  }
  const settings = await getActiveSettings();
  if (!settings?.active_access_code) {
    throw new StudentAccessError("The instructor has not opened class access yet.", 403);
  }
  if (!codesMatch(accessCode.trim(), settings.active_access_code)) {
    throw new StudentAccessError("The class access code is incorrect.", 401);
  }

  const enabled = {
    board: settings.public_board_enabled,
    submissions: settings.submissions_enabled,
    voting: settings.voting_enabled,
  }[capability];
  if (!enabled) {
    throw new StudentAccessError(
      capability === "submissions" ? "Question submissions are currently closed." :
      capability === "voting" ? "Voting is currently disabled." : "The public board is currently disabled.",
      403,
    );
  }
  return settings;
}

export function toPublicAccessInfo(settings: PublicSettings): PublicAccessInfo {
  return {
    public_board_enabled: settings.public_board_enabled,
    submissions_enabled: settings.submissions_enabled,
    voting_enabled: settings.voting_enabled,
    default_course_name: settings.default_course_name,
    timezone: settings.timezone,
  };
}

export function accessCodeFromRequest(request: Request) {
  return request.headers.get("x-class-access-code");
}

export function studentAccessErrorResponse(error: unknown) {
  if (error instanceof StudentAccessError) {
    return Response.json({ message: error.publicMessage }, { status: error.status });
  }
  console.error("Unexpected student access failure", error);
  return Response.json({ message: "Class access is temporarily unavailable." }, { status: 503 });
}
