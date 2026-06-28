import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server";

import { basicFileScan, supportedUploadExtensions } from "@/lib/knowledge/binary-parser";
import { processIngestionJob } from "@/lib/knowledge/ingestion";
import type { KnowledgeKind } from "@/lib/knowledge/types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

function documentKey(value: string, kind: KnowledgeKind) { return `${value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "knowledge"}:${kind}`; }

export async function GET() {
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { data, error } = await supabase.from("ingestion_jobs").select("id, status, progress, stage_message, warnings, error_message, created_at, completed_at, knowledge_source_versions(original_filename, processing_status, knowledge_sources(title, kind))").order("created_at", { ascending: false }).limit(30);
  if (error) return Response.json({ jobs: [], migration_required: ["42P01", "PGRST205"].includes(error.code) }, { headers: { "Cache-Control": "private, no-store" } });
  return Response.json({ jobs: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const form = await request.formData(); const file = form.get("file"); const rawKind = form.get("kind");
  if (!(file instanceof File) || (rawKind !== "faq" && rawKind !== "theory" && rawKind !== "code")) return Response.json({ message: "Choose a supported file and knowledge type." }, { status: 422 });
  const extension = `.${file.name.split(".").pop()?.toLocaleLowerCase("en-US")}`;
  if (!supportedUploadExtensions.includes(extension as typeof supportedUploadExtensions[number])) return Response.json({ message: "Supported formats: PDF, PPTX, ZIP, HTML, Python, notebooks, Markdown and text." }, { status: 422 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  try { basicFileScan(file.name, bytes); } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "File validation failed." }, { status: 422 }); }
  const kind = rawKind as KnowledgeKind; const requestedTitle = String(form.get("title") || file.name.replace(/\.[^.]+$/, "")).trim().slice(0, 500);
  const moduleTopic = String(form.get("module_topic") || "").trim().slice(0, 200) || null; const replaceDocumentId = String(form.get("replace_document_id") || "").trim() || null;
  let key = documentKey(file.name, kind); let sourceId: string | null = null;
  if (replaceDocumentId) {
    const { data: previous } = await supabase.from("knowledge_documents").select("document_key, source_version_id, knowledge_source_versions(source_id)").eq("id", replaceDocumentId).maybeSingle();
    if (previous) { key = previous.document_key; sourceId = (previous.knowledge_source_versions as unknown as { source_id: string } | null)?.source_id ?? null; }
  }
  if (!sourceId) {
    const { data: source, error: sourceError } = await supabase.from("knowledge_sources").upsert({ title: requestedTitle, kind, document_key: key, module_topic: moduleTopic, created_by: auth.claims.sub }, { onConflict: "document_key" }).select("id").single();
    if (sourceError || !source) return Response.json({ message: ["42P01", "PGRST205"].includes(sourceError?.code ?? "") ? "Apply Phase 3 migration 202606280011 before uploading." : "Knowledge source could not be created." }, { status: 503 });
    sourceId = source.id;
  }
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const { data: duplicate } = await supabase.from("knowledge_source_versions").select("id, processing_status").eq("source_id", sourceId).eq("checksum_sha256", checksum).maybeSingle();
  if (duplicate) return Response.json({ message: `This exact file version already exists (${duplicate.processing_status}).` }, { status: 409 });
  const { data: latest } = await supabase.from("knowledge_source_versions").select("version_number").eq("source_id", sourceId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const versionId = randomUUID(); const storagePath = `${sourceId}/${versionId}/${file.name.replace(/[^A-Za-z0-9._-]/g, "-")}`;
  const { error: uploadError } = await supabase.storage.from("knowledge-originals").upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) return Response.json({ message: "Original file could not be stored. Confirm the Phase 3 Storage buckets exist." }, { status: 500 });
  const { data: version, error: versionError } = await supabase.from("knowledge_source_versions").insert({ id: versionId, source_id: sourceId, version_number: (latest?.version_number ?? 0) + 1, original_filename: file.name.slice(0, 255), mime_type: file.type || null, byte_size: file.size, checksum_sha256: checksum, storage_path: storagePath, created_by: auth.claims.sub }).select("id").single();
  if (versionError || !version) { await supabase.storage.from("knowledge-originals").remove([storagePath]); return Response.json({ message: "Source version could not be queued." }, { status: 500 }); }
  const { data: job, error: jobError } = await supabase.from("ingestion_jobs").insert({ source_version_id: version.id, status: "queued", progress: 0, stage_message: "Waiting to process" }).select("id").single();
  if (jobError || !job) return Response.json({ message: "Ingestion job could not be queued." }, { status: 500 });
  after(() => processIngestionJob(job.id));
  return Response.json({ job: { id: job.id, status: "queued", progress: 0, filename: file.name }, message: "Upload secured. Extraction is running in the background." }, { status: 202 });
}
