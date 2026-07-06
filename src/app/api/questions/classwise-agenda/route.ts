import { accessCodeFromRequest, studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    await validateStudentAccess(accessCodeFromRequest(request), "board");
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("classwise_agenda")
      .select("id, class_number, class_date, concepts, hands_on")
      .eq("is_visible", true)
      .order("class_number", { ascending: true });
    if (error?.code === "PGRST205" || error?.code === "42P01") {
      return Response.json({ entries: [] }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (error) throw error;
    return Response.json({ entries: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.name === "StudentAccessError") return studentAccessErrorResponse(error);
    console.error("Public classwise agenda query failed", error);
    return Response.json({ message: "Classwise agenda could not be loaded." }, { status: 500 });
  }
}
