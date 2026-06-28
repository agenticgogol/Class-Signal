import { isQuestionId } from "@/lib/questions/admin-validation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isQuestionId(id)) return Response.json({ message: "Invalid class link." }, { status: 400 });
  const { data, error } = await createAdminClient().from("class_join_sessions").select("course_name, class_date, class_number, is_active").eq("public_id", id).maybeSingle();
  if (error || !data || !data.is_active) return Response.json({ message: "This class join link is no longer active." }, { status: 404 });
  return Response.json({ session: { course_name: data.course_name, class_date: data.class_date, class_number: data.class_number }, access_required: true }, { headers: { "Cache-Control": "private, no-store" } });
}
