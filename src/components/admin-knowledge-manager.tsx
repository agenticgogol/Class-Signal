"use client";

import { ArrowLeft, ArrowRight, BookOpen, CheckSquare2, Clock3, Eye, EyeOff, Files, FileUp, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { KnowledgeDocument } from "@/lib/knowledge/types";

type Gap = { id: string; question_text: string; module_topic: string | null };

export function AdminKnowledgeManager({ initialDocuments, gaps }: { initialDocuments: KnowledgeDocument[]; gaps: Gap[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({ loading: false });

  async function refresh() {
    const response = await fetch("/api/admin/knowledge");
    const result = await response.json() as { documents?: KnowledgeDocument[] };
    if (response.ok) setDocuments(result.documents ?? []);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true });
    const form = event.currentTarget;
    const values = new FormData(form);
    const files = values.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) { setState({ loading: false, error: "Choose at least one HTML file." }); return; }

    try {
      const imported: string[] = [];
      for (const file of files) {
        const payload = new FormData();
        payload.set("file", file);
        payload.set("kind", String(values.get("kind") ?? "faq"));
        payload.set("module_topic", String(values.get("module_topic") ?? ""));
        if (files.length === 1) payload.set("title", String(values.get("title") ?? ""));
        const response = await fetch("/api/admin/knowledge", { method: "POST", body: payload });
        const result = await response.json() as { document?: KnowledgeDocument; message?: string };
        if (!response.ok) throw new Error(`${file.name}: ${result.message ?? "Import failed."}`);
        if (result.document?.id) imported.push(result.document.id);
      }
      form.reset();
      await refresh();
      setReviewIds(imported);
      setState({ loading: false, message: `${files.length} file${files.length === 1 ? "" : "s"} imported. Move modules to the Public column, then publish each document.` });
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
      const response = await fetch("/api/admin/knowledge", { method: "POST", body: payload });
      const result = await response.json() as { document?: KnowledgeDocument; message?: string };
      if (!response.ok) throw new Error(result.message ?? "New version could not be imported.");
      await refresh();
      if (result.document?.id) setReviewIds([result.document.id]);
      setState({ loading: false, message: result.message ?? "New version imported." });
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
    <header className="admin-page__header"><div><div className="admin-page__eyebrow">Controlled course knowledge</div><h1>FAQ &amp; Theory</h1><p>Import course HTML, review detected modules, and release only what has been covered.</p></div></header>
    <div className="knowledge-admin-grid">
      <section className="admin-card knowledge-upload">
        <div className="admin-card__title"><FileUp /><div><h2>Import HTML repository</h2><p>Quick Navigation or sidebar links define modules. Heading detection is used only as a fallback.</p></div></div>
        <form onSubmit={submit}>
          <label>HTML files<input name="files" type="file" accept="text/html,.html,.htm" multiple required /><span>Up to 2 MB each. Every upload is appended.</span></label>
          <div><label>Content type<select name="kind"><option value="faq">FAQ</option><option value="theory">Theory</option></select></label><label>Module <span>optional</span><input name="module_topic" /></label></div>
          <label>Display title <span>one-file uploads only</span><input name="title" placeholder="Uses the HTML title if empty" /></label>
          {state.error && <p className="form-alert">{state.error}</p>}{state.message && <p className="answer-composer__success">{state.message}</p>}
          <Button type="submit" disabled={state.loading}><Plus /> {state.loading ? "Detecting navigation…" : "Import & identify modules"}</Button>
        </form>
      </section>
      <section className="admin-card knowledge-gaps"><div className="admin-card__title"><BookOpen /><div><h2>Knowledge gaps</h2><p>Unanswered questions with no visible FAQ or Theory match.</p></div></div><strong>{gaps.length} items to consider</strong><div>{gaps.slice(0, 12).map((gap) => <article key={gap.id}><span>{gap.module_topic ?? "No module"}</span><p>{gap.question_text}</p></article>)}</div></section>
    </div>

    <section className="knowledge-documents">
      <header className="knowledge-documents__heading"><div><h2>Choose public modules</h2><p>Move a module right to make it eligible for public display and similarity matching. Publish the document when ready.</p></div><Button variant="secondary" onClick={() => void refresh()}><RefreshCw /> Refresh list</Button></header>
      {documents.filter((document) => document.is_current).length === 0 ? <div className="admin-card board-empty"><BookOpen /><h2>No knowledge imported</h2><p>Upload one or more HTML files to begin.</p></div> : documents.filter((document) => document.is_current).map((document) => {
        const available = document.knowledge_entries.filter((entry) => !entry.is_visible).sort((left, right) => left.sequence_number - right.sequence_number);
        const selected = document.knowledge_entries.filter((entry) => entry.is_visible).sort((left, right) => left.sequence_number - right.sequence_number);
        const history = documents.filter((version) => !version.is_current && version.document_key === document.document_key).sort((left, right) => right.version_number - left.version_number);
        return <article className={`admin-card knowledge-document ${reviewIds.includes(document.id) ? "is-reviewing" : ""}`} key={document.id}>
          <header><div>{reviewIds.includes(document.id) && <span className="review-badge"><Files /> New import — review now</span>}<span>{document.kind} · version {document.version_number}</span><h3>{document.title}</h3><small>{document.knowledge_entries.length} modules · {document.source_filename ?? "Manual entry"}</small></div><div className="knowledge-document__actions"><label className="knowledge-version-upload"><Upload /><span>Upload new version</span><input hidden type="file" accept="text/html,.html,.htm" disabled={state.loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceVersion(document, file); event.target.value = ""; }} /></label><Button variant="secondary" disabled={!document.is_visible && selected.length === 0} onClick={() => void toggle("document", document.id, !document.is_visible)}>{document.is_visible ? <EyeOff /> : <Eye />} {document.is_visible ? "Unpublish" : "Publish selected"}</Button><button className="icon-danger" onClick={() => void remove(document.id)} aria-label="Delete current document"><Trash2 /></button></div></header>
          <div className="knowledge-document__management">
            <nav aria-label="Document management"><button className={openPanel === `${document.id}:edit` ? "is-active" : ""} onClick={() => setOpenPanel((current) => current === `${document.id}:edit` ? null : `${document.id}:edit`)}><Pencil /> Modify details</button><button className={openPanel === `${document.id}:history` ? "is-active" : ""} onClick={() => setOpenPanel((current) => current === `${document.id}:history` ? null : `${document.id}:history`)}><Clock3 /> Version history <b>{history.length}</b></button></nav>
            {openPanel === `${document.id}:edit` && <div className="knowledge-management-panel"><form onSubmit={(event) => void modifyDocument(event, document)}><label>Document title<input name="title" defaultValue={document.title} required /></label><label>Module label<input name="module_topic" defaultValue={document.module_topic ?? ""} placeholder="Optional" /></label><Button type="submit">Save changes</Button></form></div>}
            {openPanel === `${document.id}:history` && <div className="knowledge-management-panel">{history.length ? <div className="knowledge-version-history">{history.map((version) => <div key={version.id}><span><strong>Version {version.version_number}</strong><small>{new Date(version.created_at).toLocaleString()} · {version.knowledge_entries.length} modules</small></span><button onClick={() => void remove(version.id)}><Trash2 /> Delete version</button></div>)}</div> : <p className="knowledge-management-empty">No previous versions.</p>}</div>}
          </div>
          <div className="knowledge-document__bulk"><button onClick={() => void setAll(document, true)}><CheckSquare2 /> Move all right</button><button onClick={() => void setAll(document, false)}><EyeOff /> Hide all</button></div>
          <div className="knowledge-dual-list">
            <section><header><div><strong>Available modules</strong><span>Hidden</span></div><b>{available.length}</b></header><div>{available.length ? available.map((entry) => <button key={entry.id} onClick={() => void toggle("entry", entry.id, true)}><span>{entry.title}</span><ArrowRight /></button>) : <p>All modules are selected.</p>}</div></section>
            <section className="knowledge-dual-list__selected"><header><div><strong>Public modules</strong><span>Visible after publishing</span></div><b>{selected.length}</b></header><div>{selected.length ? selected.map((entry) => <button key={entry.id} onClick={() => void toggle("entry", entry.id, false)}><ArrowLeft /><span>{entry.title}</span></button>) : <p>Move modules here to publish them.</p>}</div></section>
          </div>
        </article>;
      })}
    </section>
  </>;
}
