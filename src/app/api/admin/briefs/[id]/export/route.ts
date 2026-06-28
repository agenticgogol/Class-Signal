import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { id } = await params;
  if (!isQuestionId(id)) return Response.json({ message: "Invalid brief identifier." }, { status: 400 });
  const { data: brief } = await supabase.from("teaching_briefs").select("course_name, class_date, version_number, content_markdown").eq("id", id).maybeSingle();
  if (!brief) return Response.json({ message: "Brief not found." }, { status: 404 });
  const filename = `${brief.course_name}-${brief.class_date}-brief-v${brief.version_number}`.toLocaleLowerCase("en-US").replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-");
  return new Response(brief.content_markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.md"`, "Cache-Control": "private, no-store" } });
}
