import "server-only";

import { createHash } from "node:crypto";

import { parseKnowledgeBuffer, basicFileScan } from "@/lib/knowledge/binary-parser";
import { createKnowledgeEmbeddings } from "@/lib/knowledge/embeddings";
import { createAdminClient } from "@/lib/supabase/admin";

type JobRow = {
  id: string;
  source_version_id: string;
  knowledge_source_versions: {
    id: string; source_id: string; version_number: number; original_filename: string; storage_path: string;
    knowledge_sources: { id: string; title: string; kind: "faq" | "theory" | "code"; document_key: string; module_topic: string | null };
  };
};

async function updateJob(jobId: string, values: Record<string, unknown>) {
  await createAdminClient().from("ingestion_jobs").update(values).eq("id", jobId);
}

async function externalVirusScan(filename: string, bytes: Uint8Array) {
  if (!process.env.CLAMAV_SCAN_URL) return "basic_passed" as const;
  const response = await fetch(process.env.CLAMAV_SCAN_URL, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Filename": encodeURIComponent(filename), ...(process.env.CLAMAV_SCAN_TOKEN ? { Authorization: `Bearer ${process.env.CLAMAV_SCAN_TOKEN}` } : {}) }, body: Buffer.from(bytes), signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("External malware scanner was unavailable; the file was not processed.");
  const result = await response.json() as { clean?: boolean; threat?: string };
  if (!result.clean) throw new Error(`Malware scan rejected this file${result.threat ? `: ${result.threat}` : "."}`);
  return "external_passed" as const;
}

export async function processIngestionJob(jobId: string) {
  const supabase = createAdminClient();
  await updateJob(jobId, { status: "scanning", progress: 8, stage_message: "Validating stored original", started_at: new Date().toISOString() });
  const { data, error } = await supabase.from("ingestion_jobs").select("id, source_version_id, knowledge_source_versions!inner(id, source_id, version_number, original_filename, storage_path, knowledge_sources!inner(id, title, kind, document_key, module_topic))").eq("id", jobId).maybeSingle();
  if (error || !data) return;
  const job = data as unknown as JobRow; const version = job.knowledge_source_versions; const source = version.knowledge_sources;
  try {
    const { data: stored, error: downloadError } = await supabase.storage.from("knowledge-originals").download(version.storage_path);
    if (downloadError || !stored) throw new Error("Stored original could not be read.");
    const bytes = new Uint8Array(await stored.arrayBuffer()); basicFileScan(version.original_filename, bytes);
    const scanStatus = await externalVirusScan(version.original_filename, bytes);
    const { data: partialAssets } = await supabase.from("knowledge_assets").select("storage_path").eq("source_version_id", version.id);
    if (partialAssets?.length) await supabase.storage.from("knowledge-assets").remove(partialAssets.map((asset) => asset.storage_path));
    await supabase.from("knowledge_assets").delete().eq("source_version_id", version.id);
    await supabase.from("knowledge_documents").delete().eq("source_version_id", version.id);
    await supabase.from("knowledge_source_versions").update({ processing_status: "extracting", scan_status: scanStatus }).eq("id", version.id);
    await updateJob(jobId, { status: "extracting", progress: 25, stage_message: "Extracting sections and provenance" });
    const parsed = await parseKnowledgeBuffer(version.original_filename, bytes);
    await updateJob(jobId, { status: "storing", progress: 62, stage_message: "Storing assets and search index", warnings: parsed.warnings });

    for (const asset of parsed.assets) {
      const extension = asset.originalPath.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
      const storagePath = `${version.id}/${asset.id}.${extension}`;
      const { error: assetUploadError } = await supabase.storage.from("knowledge-assets").upload(storagePath, asset.data, { contentType: asset.mimeType, upsert: false });
      if (assetUploadError) throw new Error(`Asset could not be stored: ${asset.originalPath}`);
      await supabase.from("knowledge_assets").insert({ id: asset.id, source_version_id: version.id, original_path: asset.originalPath, storage_path: storagePath, mime_type: asset.mimeType, byte_size: asset.data.byteLength, checksum_sha256: createHash("sha256").update(asset.data).digest("hex") });
    }

    const embeddings = await createKnowledgeEmbeddings(parsed.entries.map((entry) => `${entry.title}\n${entry.content_text.slice(0, 7000)}`));
    if (!embeddings) parsed.warnings.push("Semantic embeddings were skipped; lexical retrieval remains active. Configure an OpenAI embedding key to enable hybrid retrieval.");
    const { data: previousDocument } = await supabase.from("knowledge_documents").select("id, is_visible, version_number, source_version_id").eq("document_key", source.document_key).eq("is_current", true).maybeSingle();
    const { data: document, error: documentError } = await supabase.from("knowledge_documents").insert({ title: source.title || parsed.title, kind: source.kind, source_filename: version.original_filename, module_topic: source.module_topic, is_visible: false, document_key: source.document_key, version_number: version.version_number, is_current: true, supersedes_document_id: previousDocument?.id ?? null, source_version_id: version.id }).select("id").single();
    if (documentError || !document) throw new Error("Extracted document could not be created.");
    const rows = parsed.entries.map((entry, index) => ({ document_id: document.id, source_version_id: version.id, section_key: entry.section_key, title: entry.title, module_topic: source.module_topic, content_html: entry.content_html, content_text: entry.content_text, normalized_text: entry.normalized_text, is_visible: false, sequence_number: index, provenance_type: entry.provenance_type ?? "section", provenance_label: entry.provenance_label ?? `Section ${index + 1}`, provenance_start: entry.provenance_start ?? index + 1, provenance_end: entry.provenance_end ?? index + 1, checksum_sha256: createHash("sha256").update(entry.content_text).digest("hex"), embedding: embeddings?.[index] ?? null }));
    const { error: entriesError } = await supabase.from("knowledge_entries").insert(rows);
    if (entriesError) { await supabase.from("knowledge_documents").delete().eq("id", document.id); throw new Error("Extracted sections could not be stored."); }
    if (previousDocument) {
      await supabase.from("knowledge_documents").update({ is_current: false, is_visible: false }).eq("id", previousDocument.id);
      if (previousDocument.source_version_id) await supabase.from("knowledge_source_versions").update({ processing_status: "retired" }).eq("id", previousDocument.source_version_id);
    }
    await supabase.from("knowledge_source_versions").update({ processing_status: "ready", warnings: parsed.warnings, completed_at: new Date().toISOString() }).eq("id", version.id);
    await updateJob(jobId, { status: "completed", progress: 100, stage_message: `${rows.length} sections ready for review`, warnings: parsed.warnings, completed_at: new Date().toISOString() });
  } catch (processingError) {
    const message = processingError instanceof Error ? processingError.message.slice(0, 2000) : "Ingestion failed.";
    await supabase.from("knowledge_source_versions").update({ processing_status: "failed", error_message: message, completed_at: new Date().toISOString() }).eq("id", version.id);
    await updateJob(jobId, { status: "failed", error_message: message, stage_message: "Processing failed", completed_at: new Date().toISOString() });
  }
}
