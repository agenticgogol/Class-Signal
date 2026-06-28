import { resolveKnowledgeAssetUrls } from "@/lib/knowledge/assets";
import { accessCodeFromRequest, studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";
import { isQuestionId } from "@/lib/questions/admin-validation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await validateStudentAccess(accessCodeFromRequest(request), "board"); }
  catch (error) { return studentAccessErrorResponse(error); }
  const { id } = await params; if (!isQuestionId(id)) return Response.json({ message: "Invalid section identifier." }, { status: 400 });
  const { data, error } = await createAdminClient().from("knowledge_entries").select("id, content_html, knowledge_documents!inner(is_visible, is_current)").eq("id", id).eq("is_visible", true).eq("knowledge_documents.is_visible", true).eq("knowledge_documents.is_current", true).maybeSingle();
  if (error || !data) return Response.json({ message: "Published section not found." }, { status: 404 });
  return Response.json({ entry: { id: data.id, content_html: await resolveKnowledgeAssetUrls(data.content_html) } }, { headers: { "Cache-Control": "private, no-store" } });
}
