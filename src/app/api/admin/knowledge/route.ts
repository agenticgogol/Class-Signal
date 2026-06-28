import { isCodeKnowledgeFile, parseKnowledgeFile, supportedKnowledgeExtensions } from "@/lib/knowledge/file-parser";
import { prepareManualKnowledge } from "@/lib/knowledge/parser";
import type { KnowledgeKind } from "@/lib/knowledge/types";
import { createClient } from "@/lib/supabase/server";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return error || !data?.claims ? null : supabase;
}

function documentKey(value: string, kind: KnowledgeKind) {
  return `${value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "knowledge"}:${kind}`;
}

export async function GET() {
  const supabase = await authenticatedClient();
  if (!supabase) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, title, kind, source_filename, module_topic, is_visible, document_key, version_number, is_current, supersedes_document_id, created_at, updated_at, knowledge_entries(id, title, module_topic, is_visible, sequence_number, provenance_label, created_at)")
    .order("created_at", { ascending: false });
  if (error?.code === "PGRST205" || error?.code === "42P01") return Response.json({ documents: [], setup_required: true }, { headers: { "Cache-Control": "private, no-store" } });
  if (error?.code === "42703") {
    const { data: legacy, error: legacyError } = await supabase.from("knowledge_documents").select("id, title, kind, source_filename, module_topic, is_visible, created_at, updated_at, knowledge_entries(id, title, module_topic, is_visible, created_at)").order("created_at", { ascending: false });
    if (!legacyError) return Response.json({ documents: (legacy ?? []).map((document) => ({ ...document, document_key: document.source_filename ?? document.id, version_number: 1, is_current: true, supersedes_document_id: null, knowledge_entries: (document.knowledge_entries ?? []).map((entry, sequence_number) => ({ ...entry, sequence_number })) })), upgrade_required: true }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (error) return Response.json({ message: "Knowledge documents could not be loaded." }, { status: 500 });
  return Response.json({ documents: (data ?? []).map((document) => ({ ...document, knowledge_entries: [...(document.knowledge_entries ?? [])].sort((left, right) => left.sequence_number - right.sequence_number) })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const supabase = await authenticatedClient();
  if (!supabase) return Response.json({ message: "Authentication required." }, { status: 401 });

  const { error: schemaError } = await supabase.from("knowledge_documents").select("id, document_key", { head: true, count: "exact" }).limit(1);
  if (schemaError?.code === "PGRST205" || schemaError?.code === "42P01") {
    return Response.json({ message: "FAQ & Theory storage is not installed yet. Run Supabase migrations 005 and 006, then retry." }, { status: 503 });
  }
  if (schemaError?.code === "42703") return Response.json({ message: "Knowledge versioning is not installed yet. Run Supabase migration 202606280006_knowledge_versioning.sql, then retry." }, { status: 503 });

  const contentType = request.headers.get("content-type") ?? "";
  let title = "";
  let kind: KnowledgeKind;
  let moduleTopic: string | null = null;
  let sourceFilename: string | null = null;
  let entries: Array<{ section_key: string | null; title: string; content_html: string; content_text: string; normalized_text: string; sequence_number: number }> = [];
  let replaceDocumentId: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const rawKind = form.get("kind");
    const lowerName = file instanceof File ? file.name.toLocaleLowerCase("en-US") : "";
    if (!(file instanceof File) || !supportedKnowledgeExtensions.some((extension) => lowerName.endsWith(extension)) || file.size > 2_000_000) {
      return Response.json({ message: "Upload an HTML, Python, notebook, Markdown or text file no larger than 2 MB." }, { status: 422 });
    }
    if (rawKind !== "faq" && rawKind !== "theory" && rawKind !== "code") return Response.json({ message: "Select FAQ, Theory or Code." }, { status: 422 });
    let parsed;
    try { parsed = parseKnowledgeFile(file.name, await file.text()); } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "The file could not be parsed." }, { status: 422 }); }
    if (parsed.entries.length === 0) return Response.json({ message: "No usable sections were found in this file." }, { status: 422 });
    title = String(form.get("title") || parsed.title).trim().slice(0, 500);
    moduleTopic = String(form.get("module_topic") || "").trim().slice(0, 200) || null;
    sourceFilename = file.name.slice(0, 255);
    replaceDocumentId = String(form.get("replace_document_id") || "").trim() || null;
    kind = isCodeKnowledgeFile(file.name) ? "code" : rawKind;
    entries = parsed.entries;
  } else {
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ message: "Submit valid knowledge content." }, { status: 400 }); }
    if (typeof body !== "object" || body === null || Array.isArray(body)) return Response.json({ message: "Submit valid knowledge content." }, { status: 422 });
    const values = body as Record<string, unknown>;
    if (values.kind !== "faq" && values.kind !== "theory" && values.kind !== "code") return Response.json({ message: "Select FAQ, Theory or Code." }, { status: 422 });
    title = typeof values.title === "string" ? values.title.trim().slice(0, 500) : "";
    const content = typeof values.content === "string" ? values.content.trim() : "";
    if (!title || !content || content.length > 50_000) return Response.json({ message: "Title and content are required." }, { status: 422 });
    const entry = prepareManualKnowledge(title, content);
    if (!entry) return Response.json({ message: "Knowledge content is too short." }, { status: 422 });
    kind = values.kind;
    moduleTopic = typeof values.module_topic === "string" ? values.module_topic.trim().slice(0, 200) || null : null;
    entries = [entry];
  }

  const key = documentKey(sourceFilename ?? title, kind);
  let previous: { id: string; document_key: string; version_number: number; is_visible: boolean } | null = null;
  const previousQuery = supabase.from("knowledge_documents").select("id, document_key, version_number, is_visible").eq("is_current", true);
  const { data: previousData, error: previousError } = replaceDocumentId
    ? await previousQuery.eq("id", replaceDocumentId).maybeSingle()
    : await previousQuery.eq("document_key", key).maybeSingle();
  if (previousError) return Response.json({ message: "Existing document version could not be checked." }, { status: 500 });
  previous = previousData;
  const activeKey = previous?.document_key ?? key;
  const nextVersion = (previous?.version_number ?? 0) + 1;
  if (previous) await supabase.from("knowledge_documents").update({ is_current: false, is_visible: false }).eq("id", previous.id);

  const { data: document, error: documentError } = await supabase.from("knowledge_documents").insert({
    title, kind, source_filename: sourceFilename, module_topic: moduleTopic, is_visible: false,
    document_key: activeKey, version_number: nextVersion, is_current: true, supersedes_document_id: previous?.id ?? null,
  }).select("id, title, kind, source_filename, module_topic, is_visible, document_key, version_number, is_current, supersedes_document_id, created_at, updated_at").single();
  if (documentError) {
    if (previous) await supabase.from("knowledge_documents").update({ is_current: true, is_visible: previous.is_visible }).eq("id", previous.id);
    console.error("Knowledge document insert failed", { code: documentError.code, message: documentError.message });
    return Response.json({ message: documentError.code === "23514" && kind === "code" ? "Code knowledge is not enabled in Supabase yet. Run migration 202606280007_code_knowledge_type.sql and retry." : "Knowledge document could not be saved." }, { status: 500 });
  }
  const { data: savedEntries, error: entriesError } = await supabase.from("knowledge_entries").insert(entries.map((entry) => ({
    ...entry, document_id: document.id, module_topic: moduleTopic, is_visible: false,
  }))).select("id, title, module_topic, is_visible, sequence_number, created_at");
  if (entriesError) {
    await supabase.from("knowledge_documents").delete().eq("id", document.id);
    if (previous) await supabase.from("knowledge_documents").update({ is_current: true, is_visible: previous.is_visible }).eq("id", previous.id);
    console.error("Knowledge entries insert failed", { code: entriesError.code, message: entriesError.message });
    return Response.json({ message: "Knowledge sections could not be saved." }, { status: 500 });
  }
  return Response.json({ document: { ...document, knowledge_entries: savedEntries }, message: `Version ${nextVersion} imported with ${savedEntries.length} detected ${savedEntries.length === 1 ? "module" : "modules"}.` }, { status: 201 });
}
