"use client";

import { BookOpenCheck, CalendarDays, Download, ExternalLink, FileText, Printer, QrCode, RefreshCw, Square, Users } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";

import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import type { JoinSession, SessionDescriptor, TeachingBrief } from "@/lib/briefs/types";

export function AdminTeachingBriefs({ sessions: initialSessions, joins: initialJoins, briefs: initialBriefs, migrationRequired }: { sessions: SessionDescriptor[]; joins: JoinSession[]; briefs: TeachingBrief[]; migrationRequired: boolean }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [joins, setJoins] = useState(initialJoins);
  const [briefs, setBriefs] = useState(initialBriefs);
  const [selectedKey, setSelectedKey] = useState(initialSessions[0]?.session_key ?? "");
  const [qrSession, setQrSession] = useState<JoinSession | null>(null);
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({ loading: false });
  const selected = sessions.find((session) => session.session_key === selectedKey) ?? null;
  const selectedBriefs = useMemo(() => briefs.filter((brief) => brief.session_key === selectedKey).sort((a, b) => b.version_number - a.version_number), [briefs, selectedKey]);
  const latest = selectedBriefs[0] ?? null;

  async function refresh() {
    const response = await fetch("/api/admin/briefs");
    const result = await response.json() as { sessions?: SessionDescriptor[]; joins?: JoinSession[]; briefs?: TeachingBrief[]; message?: string };
    if (!response.ok) { setState({ loading: false, error: result.message ?? "Workspace could not be refreshed." }); return; }
    setSessions(result.sessions ?? []); setJoins(result.joins ?? []); setBriefs(result.briefs ?? []); setState({ loading: false, message: "Workspace refreshed." });
  }

  async function generateBrief() {
    if (!selected) return;
    setState({ loading: true });
    const response = await fetch("/api/admin/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected) });
    const result = await response.json() as { brief?: TeachingBrief; message?: string };
    if (!response.ok || !result.brief) { setState({ loading: false, error: result.message ?? "Brief could not be generated." }); return; }
    setBriefs((current) => [result.brief!, ...current]); setState({ loading: false, message: result.message });
  }

  async function activateQr(session: Pick<SessionDescriptor, "course_name" | "class_date" | "class_number">) {
    setState({ loading: true });
    const response = await fetch("/api/admin/class-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(session) });
    const result = await response.json() as { session?: JoinSession; message?: string };
    if (!response.ok || !result.session) { setState({ loading: false, error: result.message ?? "QR session could not be created." }); return; }
    setQrSession(result.session); setJoins((current) => [result.session!, ...current.filter((join) => join.id !== result.session!.id)]); setState({ loading: false, message: result.message });
  }

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await activateQr({ course_name: String(values.course_name ?? ""), class_date: String(values.class_date ?? ""), class_number: String(values.class_number ?? "") || null });
    await refresh();
  }

  async function closeSession(join: JoinSession) {
    const response = await fetch(`/api/admin/class-sessions/${join.id}`, { method: "PATCH" });
    const result = await response.json() as { message?: string };
    if (!response.ok) { setState({ loading: false, error: result.message ?? "Session could not be closed." }); return; }
    setJoins((current) => current.map((item) => item.id === join.id ? { ...item, is_active: false, closed_at: new Date().toISOString() } : item));
    if (qrSession?.id === join.id) setQrSession(null); setState({ loading: false, message: result.message });
  }

  return <>
    <header className="admin-page__header teaching-brief-header"><div><div className="admin-page__eyebrow">After-class intelligence</div><h1>Teaching briefs &amp; class QR</h1><p>Run the five-minute classroom loop, then preserve a deterministic snapshot of what the instructor should do next.</p></div><Button variant="secondary" onClick={() => void refresh()}><RefreshCw /> Refresh</Button></header>
    {migrationRequired && <p className="form-alert">Apply migration 202606280010 before creating QR sessions or briefs.</p>}
    {state.error && <p className="form-alert">{state.error}</p>}{state.message && <p className="answer-composer__success">{state.message}</p>}

    <section className="brief-workspace-grid">
      <article className="admin-card session-control"><div className="admin-card__title"><QrCode /><div><h2>Student QR join</h2><p>The QR contains a random session ID, never the reusable access code.</p></div></div>
        <form onSubmit={createSession}><label>Course<input name="course_name" defaultValue={selected?.course_name ?? "Advanced Agentic AI"} required /></label><div><label>Class date<input name="class_date" type="date" defaultValue={selected?.class_date ?? new Date().toISOString().slice(0, 10)} required /></label><label>Class number<input name="class_number" defaultValue={selected?.class_number ?? ""} /></label></div><Button type="submit" disabled={migrationRequired || state.loading}><QrCode /> Activate and show QR</Button></form>
        {qrSession?.qr_data_url && <div className="qr-session-card"><Image unoptimized width={210} height={210} src={qrSession.qr_data_url} alt={`QR code to join ${qrSession.course_name}`} /><div><strong>{qrSession.course_name}</strong><span>{qrSession.class_date}{qrSession.class_number ? ` · Class ${qrSession.class_number}` : ""}</span><a href={qrSession.join_url} target="_blank" rel="noreferrer">Open student join link <ExternalLink size={13} /></a><small>Students must still enter the active class access code.</small><Button variant="secondary" onClick={() => void closeSession(qrSession)}><Square /> Close session</Button></div></div>}
        {!qrSession && joins.filter((join) => join.is_active).length > 0 && <div className="active-session-list"><strong>Active links</strong>{joins.filter((join) => join.is_active).map((join) => <button key={join.id} onClick={() => void activateQr(join)}><span>{join.course_name}<small>{join.class_date}{join.class_number ? ` · Class ${join.class_number}` : ""}</small></span><QrCode /></button>)}</div>}
      </article>

      <article className="admin-card brief-generator"><div className="admin-card__title"><BookOpenCheck /><div><h2>Post-class brief</h2><p>Each generation creates an immutable version with its source metrics preserved.</p></div></div>
        <label>Class session<select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}><option value="">Select a session</option>{sessions.map((session) => <option key={session.session_key} value={session.session_key}>{session.class_date} · {session.course_name}{session.class_number ? ` · #${session.class_number}` : ""} · {session.question_count} questions</option>)}</select></label>
        {selected && <div className="brief-session-summary"><span><CalendarDays />{selected.class_date}</span><span><Users />{selected.question_count} questions</span></div>}
        <Button disabled={!selected || migrationRequired || state.loading} onClick={() => void generateBrief()}><FileText />{latest ? "Generate new snapshot" : "Generate teaching brief"}</Button>
        <p>Generation is deterministic and creates no AI token cost. Regeneration never overwrites an earlier brief.</p>
      </article>
    </section>

    <section className="brief-output">
      <header><div><span>Immutable session snapshot</span><h2>{latest ? `Brief version ${latest.version_number}` : "No brief generated"}</h2>{latest && <p>Created {new Date(latest.created_at).toLocaleString()} · {latest.input_metrics.source_question_ids.length} source questions</p>}</div>{latest && <div><a className="button button--secondary" href={`/api/admin/briefs/${latest.id}/export`}><Download /> Export Markdown</a><Button variant="secondary" onClick={() => window.print()}><Printer /> Print / Save PDF</Button></div>}</header>
      {latest ? <article className="admin-card brief-markdown"><MarkdownPreview>{latest.content_markdown}</MarkdownPreview></article> : <div className="admin-card board-empty"><FileText /><h2>Select a class session</h2><p>Generate a brief after class to preserve unresolved questions, satisfaction, knowledge recommendations and the next agenda.</p></div>}
      {selectedBriefs.length > 1 && <details className="brief-history"><summary>Previous immutable versions ({selectedBriefs.length - 1})</summary>{selectedBriefs.slice(1).map((brief) => <article key={brief.id}><span>Version {brief.version_number} · {new Date(brief.created_at).toLocaleString()}</span><a href={`/api/admin/briefs/${brief.id}/export`}><Download /> Markdown</a></article>)}</details>}
    </section>
  </>;
}
