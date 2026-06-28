import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { type, id } = await params;
  if (!isQuestionId(id) || !["document", "entry"].includes(type)) return Response.json({ message: "Invalid knowledge identifier." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Submit valid JSON." }, { status: 400 }); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return Response.json({ message: "Submit valid knowledge changes." }, { status: 422 });
  const values = body as Record<string, unknown>;
  const update: Record<string, string | boolean | null> = {};
  if (typeof values.is_visible === "boolean") update.is_visible = values.is_visible;
  if (type === "document") {
    if (typeof values.title === "string" && values.title.trim()) update.title = values.title.trim().slice(0, 500);
    if (typeof values.module_topic === "string") update.module_topic = values.module_topic.trim().slice(0, 200) || null;
  }
  if (Object.keys(update).length === 0) return Response.json({ message: "No valid changes were provided." }, { status: 422 });
  const table = type === "document" ? "knowledge_documents" : "knowledge_entries";
  const { data, error } = await supabase.from(table).update(update).eq("id", id).select("id, is_visible").maybeSingle();
  if (error) return Response.json({ message: "Knowledge item could not be updated." }, { status: 500 });
  if (!data) return Response.json({ message: "Knowledge item not found." }, { status: 404 });
  if (type === "document" && Object.prototype.hasOwnProperty.call(update, "module_topic")) await supabase.from("knowledge_entries").update({ module_topic: update.module_topic }).eq("document_id", id);
  return Response.json({ item: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { type, id } = await params;
  if (type !== "document" || !isQuestionId(id)) return Response.json({ message: "Only knowledge documents can be deleted." }, { status: 400 });
  const { data: document, error: lookupError } = await supabase.from("knowledge_documents").select("id, document_key, is_current").eq("id", id).maybeSingle();
  if (lookupError && lookupError.code !== "42703") return Response.json({ message: "Knowledge document could not be loaded." }, { status: 500 });
  const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
  if (error) return Response.json({ message: "Knowledge document could not be deleted." }, { status: 500 });
  if (document?.is_current && document.document_key) {
    const { data: previous } = await supabase.from("knowledge_documents").select("id").eq("document_key", document.document_key).order("version_number", { ascending: false }).limit(1).maybeSingle();
    if (previous) await supabase.from("knowledge_documents").update({ is_current: true, is_visible: false }).eq("id", previous.id);
  }
  return Response.json({ message: "Knowledge document deleted." });
}
