"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, BrainCircuit, CheckCircle2, CheckSquare2, Clock3, Eye, EyeOff, FileUp, LoaderCircle, Pencil, Plus, RefreshCw, ThumbsUp, Trash2, Upload, Users, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { KnowledgeHtml } from "@/components/knowledge-html";
import libraryTabs from "@/components/course-library-tabs.module.css";
import type { KnowledgeDocument, KnowledgeKind } from "@/lib/knowledge/types";
import type { KnowledgeGap } from "@/lib/knowledge/gaps";

type IngestionJob = { id: string; status: string; progress: number; stage_message: string | null; warnings: string[]; error_message: string | null; created_at: string; knowledge_source_versions: { original_filename: string; processing_status: string; knowledge_sources: { title: string; kind: string } } };

export function AdminKnowledgeManager({ initialDocuments, initialGaps, migrationRequired }: { initialDocuments: KnowledgeDocument[]; initialGaps: KnowledgeGap[]; migrationRequired: boolean }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [gaps, setGaps] = useState(initialGaps);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<KnowledgeKind>("faq");
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({ loading: false });
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [previews, setPreviews] = useState<Record<string, { loading: boolean; html?: string; error?: string }>>({});
  const jobsRef = useRef<IngestionJob[]>([]);
  const jobsRequestRef = useRef(false);
  const previewRequestsRef = useRef(new Set<string>());

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/admin/knowledge"); const result = await response.json() as { documents?: KnowledgeDocument[] };
    if (response.ok) setDocuments(result.documents ?? []);
  }, []);

  const loadJobs = useCallback(async () => {
    if (jobsRequestRef.current) return jobsRef.current;
    jobsRequestRef.current = true;
    try {
      const response = await fetch("/api/admin/knowledge/ingestion"); const result = await response.json() as { jobs?: IngestionJob[] };
      if (!response.ok) return jobsRef.current;
      const latest = result.jobs ?? [];
      const wasActive = jobsRef.current.some((job) => ["queued", "scanning", "extracting", "storing"].includes(job.status));
      const isActive = latest.some((job) => ["queued", "scanning", "extracting", "storing"].includes(job.status));
      jobsRef.current = latest; setJobs(latest);
      if (wasActive && !isActive) await loadDocuments();
      return latest;
    } finally { jobsRequestRef.current = false; }
  }, [loadDocuments]);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadJobs(), 0);
    return () => window.clearTimeout(initial);
  }, [loadJobs]);

  const hasActiveJobs = jobs.some((job) => ["queued", "scanning", "extracting", "storing"].includes(job.status));
  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = window.setInterval(() => void loadJobs(), 3_000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs, loadJobs]);

  async function loadPreview(id: string) {
    if (previews[id]?.html || previewRequestsRef.current.has(id)) return;
    previewRequestsRef.current.add(id); setPreviews((current) => ({ ...current, [id]: { loading: true } }));
    try {
      const response = await fetch(`/api/admin/knowledge/entry/${id}/preview`); const result = await response.json() as { entry?: { content_html: string }; message?: string };
      setPreviews((current) => ({ ...current, [id]: response.ok && result.entry ? { loading: false, html: result.entry.content_html } : { loading: false, error: result.message ?? "Preview unavailable." } }));
    } catch { setPreviews((current) => ({ ...current, [id]: { loading: false, error: "Preview unavailable." } })); }
    finally { previewRequestsRef.current.delete(id); }
  }

  async function refresh() {
    const [documentsResponse, gapsResponse] = await Promise.all([fetch("/api/admin/knowledge"), fetch("/api/admin/knowledge/gaps", { method: "POST" })]);
    const result = await documentsResponse.json() as { documents?: KnowledgeDocument[] };
    const gapResult = await gapsResponse.json() as { gaps?: KnowledgeGap[]; message?: string };
    if (documentsResponse.ok) setDocuments(result.documents ?? []);
    if (gapsResponse.ok) setGaps(gapResult.gaps ?? []);
    await loadJobs();
  }

  async function updateGap(id: string, status: KnowledgeGap["status"]) {
    const response = await fetch(`/api/admin/knowledge/gaps/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json() as { message?: string };
    if (!response.ok) { setState({ loading: false, error: result.message ?? "Gap could not be updated." }); return; }
    setGaps((current) => current.map((gap) => gap.id === id ? { ...gap, status } : gap));
    setState({ loading: false, message: result.message });
  }

  async function createGapDraft(gap: KnowledgeGap) {
    setState({ loading: true });
    const response = await fetch(`/api/admin/knowledge/gaps/${gap.id}/draft`, { method: "POST" });
    const result = await response.json() as { message?: string };
    if (!response.ok) { setState({ loading: false, error: result.message ?? "Draft entry could not be created." }); return; }
    await refresh(); setActiveKind(gap.suggested_kind); setGaps((current) => current.map((item) => item.id === gap.id ? { ...item, status: "drafting" } : item));
    setState({ loading: false, message: result.message });
  }

  async function retryJob(id: string) {
    const response = await fetch(`/api/admin/knowledge/ingestion/${id}/retry`, { method: "POST" }); const result = await response.json() as { message?: string };
    if (!response.ok) { setState({ loading: false, error: result.message ?? "Job could not be retried." }); return; }
    await loadJobs(); setState({ loading: false, message: result.message });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true });
    const form = event.currentTarget;
    const values = new FormData(form);
    const files = values.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) { setState({ loading: false, error: "Choose at least one supported knowledge file." }); return; }

    try {
      let queued = 0;
      for (const file of files) {
        const payload = new FormData();
        payload.set("file", file);
        payload.set("kind", String(values.get("kind") ?? "faq"));
        payload.set("module_topic", String(values.get("module_topic") ?? ""));
        if (files.length === 1) payload.set("title", String(values.get("title") ?? ""));
        const response = await fetch("/api/admin/knowledge/ingestion", { method: "POST", body: payload });
        const result = await response.json() as { job?: { id: string }; message?: string };
        if (!response.ok) throw new Error(`${file.name}: ${result.message ?? "Import failed."}`);
        if (result.job?.id) queued += 1;
      }
      form.reset();
      await loadJobs();
      setState({ loading: false, message: `${queued} file${queued === 1 ? "" : "s"} secured and queued. Review extracted sections when processing completes.` });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Upload failed." });
    }
  }

  async function toggle(type: "document" | "entry", id: string, visible: boolean) {
    const response = await fetch(`/api/admin/knowledge/${type}/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_visible: visible }),
    });
    if (!response.ok) {
      const result = await response.json() as { message?: string };
      setState({ loading: false, error: result.message ?? "Visibility could not be changed." });
      return;
    }
    await refresh();
  }

  async function setAll(document: KnowledgeDocument, visible: boolean) {
    await Promise.all(document.knowledge_entries.map((entry) => fetch(`/api/admin/knowledge/entry/${entry.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_visible: visible }),
    })));
    await refresh();
  }

  async function replaceVersion(document: KnowledgeDocument, file: File) {
    setState({ loading: true });
    const payload = new FormData();
    payload.set("file", file); payload.set("kind", document.kind); payload.set("title", document.title);
    payload.set("module_topic", document.module_topic ?? ""); payload.set("replace_document_id", document.id);
    try {
      const response = await fetch("/api/admin/knowledge/ingestion", { method: "POST", body: payload });
      const result = await response.json() as { job?: { id: string }; message?: string };
      if (!response.ok) throw new Error(result.message ?? "New version could not be imported.");
      await loadJobs();
      setState({ loading: false, message: result.message ?? "New version queued." });
    } catch (error) { setState({ loading: false, error: error instanceof Error ? error.message : "New version could not be imported." }); }
  }

  async function modifyDocument(event: FormEvent<HTMLFormElement>, document: KnowledgeDocument) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/knowledge/document/${document.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: values.get("title"), module_topic: values.get("module_topic") }) });
    const result = await response.json() as { message?: string };
    if (!response.ok) { setState({ loading: false, error: result.message ?? "Document could not be modified." }); return; }
    await refresh(); setState({ loading: false, message: "Document details updated." });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this document and all its sections?")) return;
    const response = await fetch(`/api/admin/knowledge/document/${id}`, { method: "DELETE" });
    if (response.ok) await refresh();
    else setState({ loading: false, error: "Document could not be deleted." });
  }

  return <>
    <header className="admin-page__header"><div><div className="admin-page__eyebrow">Controlled course knowledge</div><h1>Course Library</h1><p>Manage FAQ, Theory and Code sources, review detected modules, and release only what has been covered.</p></div></header>
    <div className="knowledge-admin-grid">
      <section className="admin-card knowledge-upload">
        <div className="admin-card__title"><FileUp /><div><h2>Import knowledge</h2><p>Originals are stored privately, scanned, extracted asynchronously and kept with page/slide/cell/line provenance.</p></div></div>
        <form onSubmit={submit}>
          <label>Knowledge files<input name="files" type="file" accept=".pdf,.pptx,.zip,.html,.htm,.py,.ipynb,.md,.txt,application/pdf" multiple required /><span>PDF, PowerPoint, ZIP, HTML, Python, notebooks, Markdown or text · up to 25 MB each</span></label>
          <div><label>Content type<select name="kind"><option value="faq">FAQ</option><option value="theory">Theory</option><option value="code">Code</option></select></label><label>Module <span>optional</span><input name="module_topic" /></label></div>
          <label>Display title <span>one-file uploads only</span><input name="title" placeholder="Uses the HTML title if empty" /></label>
          {state.error && <p className="form-alert">{state.error}</p>}{state.message && <p className="answer-composer__success">{state.message}</p>}
          <Button type="submit" disabled={state.loading}><Plus /> {state.loading ? "Securing upload…" : "Upload & process"}</Button>
        </form>
        {jobs.length > 0 && <div className="ingestion-jobs"><header><strong>Processing activity</strong><button onClick={() => void loadJobs()}><RefreshCw /> Refresh</button></header>{jobs.slice(0, 6).map((job) => <article key={job.id} className={`ingestion-job ingestion-job--${job.status}`}><span>{job.status === "completed" ? <CheckCircle2 /> : job.status === "failed" ? <XCircle /> : <LoaderCircle />}</span><div><strong>{job.knowledge_source_versions.original_filename}</strong><small>{job.stage_message ?? job.status}{job.error_message ? ` · ${job.error_message}` : ""}</small><i><b style={{ width: `${job.progress}%` }} /></i>{job.warnings?.map((warning) => <em key={warning}>{warning}</em>)}{job.status === "failed" && <button className="ingestion-retry" onClick={() => void retryJob(job.id)}><RefreshCw /> Retry extraction</button>}</div><b>{job.progress}%</b></article>)}</div>}
      </section>
      <section className="admin-card knowledge-gaps knowledge-gaps--intelligence"><div className="admin-card__title"><BrainCircuit /><div><h2>Knowledge-gap intelligence</h2><p>Explainable recommendations from repeated questions, rejection, dissatisfaction, votes and course coverage.</p></div></div>{migrationRequired && <p className="form-alert"><AlertTriangle size={14} /> Apply migration 202606280009 to enable lifecycle actions.</p>}<strong>{gaps.filter((gap) => gap.status === "open" || gap.status === "drafting").length} active gaps</strong><div>{gaps.slice(0, 12).map((gap) => <article key={gap.id} className={`knowledge-gap knowledge-gap--${gap.status}`}><header><span>{gap.module_topic ?? "Cross-module"}</span><b>{gap.status}</b></header><h3>{gap.concept_label}</h3><div className="knowledge-gap__signals"><span><Users size={12} />{gap.participant_count} participants</span><span><ThumbsUp size={12} />{gap.upvote_count} votes</span><span><AlertTriangle size={12} />{gap.dissatisfied_count + gap.rejected_suggestions} negative signals</span></div><details><summary>Why this was recommended</summary><p>{gap.question_count} related questions across {gap.session_count} session{gap.session_count === 1 ? "" : "s"}; {gap.unanswered_count} unanswered, {gap.rejected_suggestions} rejected suggestions, {gap.dissatisfied_count} dissatisfied responses and {gap.follow_up_count} follow-ups.</p>{gap.existing_source ? <p>Closest published source: <strong>{gap.existing_source}</strong> ({Math.round(gap.source_match * 100)}% lexical coverage).</p> : <p>No related published source was found.</p>}<ul>{gap.representative_questions.map((question) => <li key={question.id}>{question.question_text}</li>)}</ul></details><footer><Button variant="secondary" disabled={migrationRequired || state.loading} onClick={() => void createGapDraft(gap)}>Create draft {gap.suggested_kind.toUpperCase()}</Button>{gap.status !== "resolved" && <button disabled={migrationRequired} onClick={() => void updateGap(gap.id, "resolved")}>Mark resolved</button>}{gap.status !== "dismissed" && <button disabled={migrationRequired} onClick={() => void updateGap(gap.id, "dismissed")}>Dismiss</button>}</footer></article>)}</div></section>
    </div>

    <section className="knowledge-documents">
      <header className="knowledge-documents__heading"><div><h2>Choose public modules</h2><p>Move a module right to make it eligible for public display and similarity matching. Publish the document when ready.</p></div><Button variant="secondary" onClick={() => void refresh()}><RefreshCw /> Refresh list</Button></header>
      <nav className={`${libraryTabs.tabs} ${libraryTabs.admin}`} aria-label="Knowledge type">{(["faq", "theory", "code"] as const).map((kind) => <button type="button" key={kind} className={activeKind === kind ? libraryTabs.active : ""} onClick={() => setActiveKind(kind)}>{kind === "faq" ? "FAQ" : kind === "theory" ? "Theory" : "Code"}<span>{documents.filter((document) => document.is_current && document.kind === kind).length}</span></button>)}</nav>
      {documents.filter((document) => document.is_current && document.kind === activeKind).length === 0 ? <div className="admin-card board-empty"><BookOpen /><h2>No {activeKind === "faq" ? "FAQ" : activeKind === "theory" ? "Theory" : "Code"} sources imported</h2><p>Upload one or more supported files to begin.</p></div> : documents.filter((document) => document.is_current && document.kind === activeKind).map((document) => {
        const available = document.knowledge_entries.filter((entry) => !entry.is_visible).sort((left, right) => left.sequence_number - right.sequence_number);
        const selected = document.knowledge_entries.filter((entry) => entry.is_visible).sort((left, right) => left.sequence_number - right.sequence_number);
        const history = documents.filter((version) => !version.is_current && version.document_key === document.document_key).sort((left, right) => right.version_number - left.version_number);
        return <article className="admin-card knowledge-document" key={document.id}>
          <header><div><span>{document.kind} · version {document.version_number}</span><h3>{document.title}</h3><small>{document.knowledge_entries.length} modules · {document.source_filename ?? "Manual entry"}</small></div><div className="knowledge-document__actions"><label className="knowledge-version-upload"><Upload /><span>Upload new version</span><input hidden type="file" accept=".pdf,.pptx,.zip,.html,.htm,.py,.ipynb,.md,.txt,application/pdf" disabled={state.loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceVersion(document, file); event.target.value = ""; }} /></label><Button variant="secondary" disabled={!document.is_visible && selected.length === 0} onClick={() => void toggle("document", document.id, !document.is_visible)}>{document.is_visible ? <EyeOff /> : <Eye />} {document.is_visible ? "Unpublish" : "Publish selected"}</Button><button className="icon-danger" onClick={() => void remove(document.id)} aria-label="Delete current document"><Trash2 /></button></div></header>
          <div className="knowledge-document__management">
            <nav aria-label="Document management"><button className={openPanel === `${document.id}:edit` ? "is-active" : ""} onClick={() => setOpenPanel((current) => current === `${document.id}:edit` ? null : `${document.id}:edit`)}><Pencil /> Modify details</button><button className={openPanel === `${document.id}:history` ? "is-active" : ""} onClick={() => setOpenPanel((current) => current === `${document.id}:history` ? null : `${document.id}:history`)}><Clock3 /> Version history <b>{history.length}</b></button></nav>
            {openPanel === `${document.id}:edit` && <div className="knowledge-management-panel"><form onSubmit={(event) => void modifyDocument(event, document)}><label>Document title<input name="title" defaultValue={document.title} required /></label><label>Module label<input name="module_topic" defaultValue={document.module_topic ?? ""} placeholder="Optional" /></label><Button type="submit">Save changes</Button></form></div>}
            {openPanel === `${document.id}:history` && <div className="knowledge-management-panel">{history.length ? <div className="knowledge-version-history">{history.map((version) => <div key={version.id}><span><strong>Version {version.version_number}</strong><small>{new Date(version.created_at).toLocaleString()} · {version.knowledge_entries.length} modules</small></span><button onClick={() => void remove(version.id)}><Trash2 /> Delete version</button></div>)}</div> : <p className="knowledge-management-empty">No previous versions.</p>}</div>}
          </div>
          <div className="knowledge-document__bulk"><button onClick={() => void setAll(document, true)}><CheckSquare2 /> Move all right</button><button onClick={() => void setAll(document, false)}><EyeOff /> Hide all</button></div>
          <div className="knowledge-dual-list">
            <section><header><div><strong>Available modules</strong><span>Hidden</span></div><b>{available.length}</b></header><div>{available.length ? available.map((entry) => <button key={entry.id} onClick={() => void toggle("entry", entry.id, true)}><span>{entry.title}{entry.provenance_label && <small>{entry.provenance_label}</small>}</span><ArrowRight /></button>) : <p>All modules are selected.</p>}</div></section>
            <section className="knowledge-dual-list__selected"><header><div><strong>Public modules</strong><span>Visible after publishing</span></div><b>{selected.length}</b></header><div>{selected.length ? selected.map((entry) => <button key={entry.id} onClick={() => void toggle("entry", entry.id, false)}><ArrowLeft /><span>{entry.title}{entry.provenance_label && <small>{entry.provenance_label}</small>}</span></button>) : <p>Move modules here to publish them.</p>}</div></section>
          </div>
          <details className="knowledge-extraction-preview"><summary><Eye /> Preview extracted sections</summary><div>{document.knowledge_entries.map((entry) => <details key={entry.id} onToggle={(event) => { if (event.currentTarget.open) void loadPreview(entry.id); }}><summary>{entry.title}<small>{entry.provenance_label ?? "Section"}</small></summary>{previews[entry.id]?.loading ? <p>Loading preview…</p> : previews[entry.id]?.html ? <KnowledgeHtml html={previews[entry.id].html ?? ""} /> : <p>{previews[entry.id]?.error ?? "Open to load this section preview."}</p>}</details>)}</div></details>
        </article>;
      })}
    </section>
  </>;
}
