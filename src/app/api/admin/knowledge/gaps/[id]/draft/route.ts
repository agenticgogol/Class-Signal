import { normalizeQuestionText } from "@/lib/questions/similarity";
import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { id } = await params;
  if (!isQuestionId(id)) return Response.json({ message: "Invalid gap identifier." }, { status: 400 });
  const { data: gap, error } = await supabase.from("knowledge_gaps").select("id, concept_label, module_topic, suggested_kind, knowledge_gap_questions(question_id, questions(question_text))").eq("id", id).maybeSingle();
  if (error || !gap) return Response.json({ message: "Knowledge gap not found." }, { status: 404 });
  const related = gap.knowledge_gap_questions as unknown as Array<{ question_id: string; questions: { question_text: string } | null }>;
  const questions = related.flatMap((item) => item.questions?.question_text ? [item.questions.question_text] : []);
  const contentText = [`# ${gap.concept_label}`, "", "## Student questions to address", ...questions.map((question) => `- ${question}`), "", "## Instructor draft", "Explain the concept using approved course terminology, an example, and the common misconception. Replace this scaffold before publishing."].join("\n");
  const contentHtml = `<h2>${escapeHtml(gap.concept_label)}</h2><h3>Student questions to address</h3><ul>${questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul><h3>Instructor draft</h3><p>Explain the concept using approved course terminology, an example, and the common misconception. Replace this scaffold before publishing.</p>`;
  const documentKey = `knowledge-gap:${gap.id}`;
  const { data: previous } = await supabase.from("knowledge_documents").select("id, version_number").eq("document_key", documentKey).eq("is_current", true).maybeSingle();
  if (previous) await supabase.from("knowledge_documents").update({ is_current: false, is_visible: false }).eq("id", previous.id);
  const { data: document, error: documentError } = await supabase.from("knowledge_documents").insert({ title: `Draft: ${gap.concept_label}`, kind: gap.suggested_kind, module_topic: gap.module_topic, source_filename: null, document_key: documentKey, version_number: (previous?.version_number ?? 0) + 1, is_current: true, is_visible: false, supersedes_document_id: previous?.id ?? null }).select("id").single();
  if (documentError || !document) return Response.json({ message: "Draft knowledge document could not be created." }, { status: 500 });
  const { data: entry, error: entryError } = await supabase.from("knowledge_entries").insert({ document_id: document.id, section_key: `gap-${gap.id}`, title: gap.concept_label, module_topic: gap.module_topic, content_html: contentHtml, content_text: contentText, normalized_text: normalizeQuestionText(contentText), is_visible: false, sequence_number: 0 }).select("id").single();
  if (entryError || !entry) return Response.json({ message: "Draft knowledge entry could not be created." }, { status: 500 });
  await supabase.from("knowledge_gaps").update({ status: "drafting", resolved_by_entry_id: entry.id, updated_at: new Date().toISOString() }).eq("id", id);
  return Response.json({ document_id: document.id, entry_id: entry.id, message: `Draft ${String(gap.suggested_kind).toUpperCase()} entry created. Review and publish it from Course Library.` }, { status: 201 });
}
