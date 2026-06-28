import { accessCodeFromRequest, studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    await validateStudentAccess(accessCodeFromRequest(request), "board");
    const supabase = createAdminClient();
    const currentResult = await supabase
      .from("knowledge_documents")
      .select("id, title, kind, module_topic")
      .eq("is_visible", true)
      .eq("is_current", true)
      .order("created_at", { ascending: false });
    const legacyResult = currentResult.error?.code === "42703"
      ? await supabase.from("knowledge_documents").select("id, title, kind, module_topic").eq("is_visible", true).order("created_at", { ascending: false })
      : null;
    const documents = legacyResult ? legacyResult.data : currentResult.data;
    const documentError = legacyResult ? legacyResult.error : currentResult.error;
    if (documentError?.code === "PGRST205" || documentError?.code === "42P01") {
      return Response.json({ documents: [], setup_required: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (documentError) throw documentError;

    const ids = (documents ?? []).map((document) => document.id);
    if (ids.length === 0) return Response.json({ documents: [] });
    const { data: entries, error: entryError } = await supabase
      .from("knowledge_entries")
      .select("id, document_id, title, module_topic, content_html, sequence_number")
      .in("document_id", ids)
      .eq("is_visible", true)
      .order("sequence_number", { ascending: true });
    if (entryError?.code === "42703") {
      const legacyEntries = await supabase.from("knowledge_entries").select("id, document_id, title, module_topic, content_html").in("document_id", ids).eq("is_visible", true).order("created_at", { ascending: true });
      if (legacyEntries.error) throw legacyEntries.error;
      return Response.json({ documents: (documents ?? []).map((document) => ({ ...document, knowledge_entries: (legacyEntries.data ?? []).filter((entry) => entry.document_id === document.id).map((entry, sequence_number) => ({ id: entry.id, title: entry.title, module_topic: entry.module_topic, content_html: entry.content_html, sequence_number })) })) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (entryError) throw entryError;

    return Response.json({
      documents: (documents ?? []).map((document) => ({
        ...document,
        knowledge_entries: (entries ?? []).filter((entry) => entry.document_id === document.id).sort((left, right) => left.sequence_number - right.sequence_number).map((entry) => ({ id: entry.id, title: entry.title, module_topic: entry.module_topic, content_html: entry.content_html, sequence_number: entry.sequence_number })),
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.name === "StudentAccessError") return studentAccessErrorResponse(error);
    console.error("Public knowledge query failed", error);
    return Response.json({ message: "Course knowledge could not be loaded." }, { status: 500 });
  }
}
