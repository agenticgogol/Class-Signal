import { resolveKnowledgeAssetUrls } from "@/lib/knowledge/assets";
import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { id } = await params; if (!isQuestionId(id)) return Response.json({ message: "Invalid section identifier." }, { status: 400 });
  const { data, error } = await supabase.from("knowledge_entries").select("id, title, content_html, provenance_label").eq("id", id).maybeSingle();
  if (error || !data) return Response.json({ message: "Section preview could not be loaded." }, { status: 404 });
  return Response.json({ entry: { ...data, content_html: await resolveKnowledgeAssetUrls(data.content_html) } }, { headers: { "Cache-Control": "private, no-store" } });
}
