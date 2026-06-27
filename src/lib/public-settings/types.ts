export type PublicSettings = {
  active_access_code: string | null;
  public_board_enabled: boolean;
  submissions_enabled: boolean;
  voting_enabled: boolean;
  default_course_name: string;
  timezone: string;
  updated_at: string | null;
};

export type PublicAccessInfo = Omit<PublicSettings, "active_access_code" | "updated_at">;
