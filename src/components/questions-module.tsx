"use client";

import { BookOpen, CalendarDays, KeyRound, MessageCircleQuestion, PenLine, RotateCcw, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { MyQuestionsLookup } from "@/components/my-questions-lookup";
import { KnowledgeHtml } from "@/components/knowledge-html";
import { PublicQuestionBoard } from "@/components/public-question-board";
import { QuestionSubmitForm } from "@/components/question-submit-form";
import { Button } from "@/components/ui/button";
import libraryTabs from "@/components/course-library-tabs.module.css";
import type { PublicAccessInfo } from "@/lib/public-settings/types";
import type { PublicQuestion, PublicQuestionsResponse } from "@/lib/questions/public-types";
import type { KnowledgeKind, PublicKnowledgeDocument } from "@/lib/knowledge/types";

const storageKey = "live-course-qa-access-code";
type PublicTab = "all" | "ask" | "mine" | "knowledge";
type PublicSession = { course_name: string; class_date: string; class_number: string | null };

export function QuestionsModule() {
  const [accessCode, setAccessCode] = useState("");
  const [access, setAccess] = useState<PublicAccessInfo | null>(null);
  const [accessState, setAccessState] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [boardState, setBoardState] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [activeTab, setActiveTab] = useState<PublicTab>("all");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [knowledge, setKnowledge] = useState<PublicKnowledgeDocument[]>([]);
  const [knowledgeKind, setKnowledgeKind] = useState<KnowledgeKind>("faq");
  const [knowledgeState, setKnowledgeState] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [showReset, setShowReset] = useState(false);
  const [resetState, setResetState] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [publicSessionId, setPublicSessionId] = useState<string | null>(null);
  const [publicSession, setPublicSession] = useState<PublicSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [knowledgeEntryContent, setKnowledgeEntryContent] = useState<Record<string, { loading: boolean; html?: string; error?: string }>>({});
  const knowledgeEntryRequests = useRef(new Set<string>());
  const boardRequestInFlight = useRef(false);

  async function loadKnowledgeEntry(id: string) {
    if (knowledgeEntryContent[id]?.html || knowledgeEntryRequests.current.has(id)) return;
    knowledgeEntryRequests.current.add(id); setKnowledgeEntryContent((current) => ({ ...current, [id]: { loading: true } }));
    try {
      const response = await fetch(`/api/questions/knowledge/entry/${id}`, { headers: { "x-class-access-code": accessCode } }); const result = await response.json() as { entry?: { content_html: string }; message?: string };
      setKnowledgeEntryContent((current) => ({ ...current, [id]: response.ok && result.entry ? { loading: false, html: result.entry.content_html } : { loading: false, error: result.message ?? "Section unavailable." } }));
    } catch { setKnowledgeEntryContent((current) => ({ ...current, [id]: { loading: false, error: "Section unavailable." } })); }
    finally { knowledgeEntryRequests.current.delete(id); }
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("session");
    if (!id) return;
    void fetch(`/api/questions/session/${encodeURIComponent(id)}`).then(async (response) => {
      const result = await response.json() as { session?: PublicSession; message?: string };
      if (!response.ok || !result.session) { setSessionError(result.message ?? "This class link is unavailable."); setPublicSessionId(null); return; }
      setPublicSessionId(id); setPublicSession(result.session);
    }).catch(() => { setSessionError("This class link could not be verified."); setPublicSessionId(null); });
  }, []);

  useEffect(() => {
    if (activeTab !== "knowledge" || knowledge.length === 0) return;
    let cancelled = false;
    async function renderDiagrams() {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(".knowledge-library .mermaid:not([data-processed])"));
      if (!nodes.length) return;
      try {
        const mermaid = (await import("mermaid")).default;
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: document.documentElement.dataset.theme === "dark" ? "dark" : "neutral" });
        await mermaid.run({ nodes, suppressErrors: true });
      } catch { nodes.forEach((node) => node.classList.add("mermaid--fallback")); }
    }
    void renderDiagrams();
    return () => { cancelled = true; };
  }, [activeTab, knowledge, knowledgeEntryContent]);

  const loadQuestions = useCallback(async (code: string, silent = false) => {
    if (boardRequestInFlight.current) return;
    boardRequestInFlight.current = true;
    if (!silent) setBoardState({ loading: true });
    try {
      const response = await fetch("/api/questions/public", { headers: { "x-class-access-code": code } });
      const result = (await response.json()) as Partial<PublicQuestionsResponse> & { message?: string };
      if (!response.ok) {
        if (!silent) setBoardState({ loading: false, error: result.message ?? "Unable to load questions." });
        return;
      }
      setQuestions(result.questions ?? []);
      setBoardState({ loading: false });
    } catch {
      if (!silent) setBoardState({ loading: false, error: "Unable to reach the question board." });
    } finally { boardRequestInFlight.current = false; }
  }, []);

  useEffect(() => {
    if (!access || !accessCode) return;
    const interval = window.setInterval(() => void loadQuestions(accessCode, true), 30_000);
    return () => window.clearInterval(interval);
  }, [access, accessCode, loadQuestions]);

  const validateCode = useCallback(async (code: string) => {
    setAccessState({ loading: true });
    try {
      const response = await fetch("/api/questions/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_code: code }),
      });
      const result = (await response.json()) as { access?: PublicAccessInfo; message?: string };
      if (!response.ok || !result.access) {
        localStorage.removeItem(storageKey);
        setAccess(null);
        setAccessState({ loading: false, error: result.message ?? "Access code could not be validated." });
        return;
      }
      localStorage.setItem(storageKey, code);
      setAccessCode(code);
      setAccess(result.access);
      setAccessState({ loading: false });
      await loadQuestions(code);
    } catch {
      setAccessState({ loading: false, error: "Unable to validate class access." });
    }
  }, [loadQuestions]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    const timeout = window.setTimeout(() => void validateCode(saved), 0);
    return () => window.clearTimeout(timeout);
  }, [validateCode]);

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("access_code");
    if (typeof code === "string") await validateCode(code.trim());
  }

  const filteredQuestions = useMemo(() => {
    const query = moduleFilter.trim().toLocaleLowerCase("en-US");
    return questions.filter((question) => (!query || question.module_topic?.toLocaleLowerCase("en-US").includes(query)) && (!statusFilter || question.status === statusFilter));
  }, [moduleFilter, questions, statusFilter]);

  const openKnowledge = useCallback(async () => {
    setActiveTab("knowledge");
    if (knowledge.length) return;
    setKnowledgeState({ loading: true });
    try {
      const response = await fetch("/api/questions/knowledge", { headers: { "x-class-access-code": accessCode } });
      const result = await response.json() as { documents?: PublicKnowledgeDocument[]; message?: string };
      if (!response.ok) { setKnowledgeState({ loading: false, error: result.message ?? "Unable to load the course library." }); return; }
      setKnowledge(result.documents ?? []); setKnowledgeState({ loading: false });
    } catch { setKnowledgeState({ loading: false, error: "Unable to load the course library." }); }
  }, [accessCode, knowledge.length]);

  useEffect(() => {
    if (!access) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") !== "knowledge") return;
    const requestedKind = params.get("kind");
    const timeout = window.setTimeout(() => {
      if (requestedKind === "faq" || requestedKind === "theory" || requestedKind === "code") setKnowledgeKind(requestedKind);
      void openKnowledge().then(() => window.setTimeout(() => {
        const target = document.getElementById(window.location.hash.slice(1));
        const disclosure = target?.closest("details") as HTMLDetailsElement | null;
        if (disclosure) disclosure.open = true;
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [access, knowledge, openKnowledge]);

  async function resetPublicBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setResetState({ loading: true });
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/admin/questions/reset-public-board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { message?: string };
      if (!response.ok) { setResetState({ loading: false, error: result.message ?? "Public board could not be reset." }); return; }
      setShowReset(false); setResetState({ loading: false }); setModuleFilter(""); setStatusFilter(""); await loadQuestions(accessCode);
    } catch { setResetState({ loading: false, error: "Public board could not be reset." }); }
  }

  if (!access) {
    return (
      <section className="access-gate shell">
        {publicSession && <div className="session-join-banner"><CalendarDays size={16} /><span><strong>Joining {publicSession.course_name}</strong>{publicSession.class_date}{publicSession.class_number ? ` · Class ${publicSession.class_number}` : ""}</span></div>}
        {sessionError && <p className="form-alert">{sessionError}</p>}
        <div className="access-gate__icon"><KeyRound size={25} /></div>
        <div className="eyebrow"><span /> Class access</div>
        <h1>Enter the active class code</h1>
        <p>Ask your instructor for the current class access code. The same code unlocks viewing, asking, voting, and checking your questions.</p>
        <div className="access-gate__privacy"><ShieldCheck size={15} /> Provided by your instructor · saved only in this browser</div>
        <form onSubmit={submitAccess}>
          <label htmlFor="class-access-code">Access code</label>
          <div><input id="class-access-code" name="access_code" type="password" autoComplete="off" maxLength={200} required autoFocus /><Button type="submit" disabled={accessState.loading}>{accessState.loading ? "Checking…" : "Enter board"}</Button></div>
        </form>
        {accessState.error && <p className="form-alert" role="alert">{accessState.error}</p>}
      </section>
    );
  }

  return (
    <div className="board-page">
      <section className="board-hero shell">
        <div><div className="eyebrow"><span /> ClassSignal live board</div><h1>Every question, clearly tracked.</h1><p>Ask, upvote, and follow instructor answers for {publicSession?.course_name ?? access.default_course_name}. Showing the last three months.</p>{publicSession && <div className="session-join-banner"><CalendarDays size={16} /><span><strong>Active class session</strong>{publicSession.class_date}{publicSession.class_number ? ` · Class ${publicSession.class_number}` : ""}</span></div>}</div>
        <div className="board-access-actions"><span><ShieldCheck size={14} /> Access verified</span></div>
      </section>
      <nav className="public-tabs shell" aria-label="Public board sections" role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === "all"} className={activeTab === "all" ? "is-active" : ""} onClick={() => setActiveTab("all")}><MessageCircleQuestion size={16} /> All Questions</button>
        <button type="button" role="tab" aria-selected={activeTab === "ask"} className={activeTab === "ask" ? "is-active" : ""} disabled={!access.submissions_enabled} onClick={() => setActiveTab("ask")}><PenLine size={16} /> Ask a Question</button>
        <button type="button" role="tab" aria-selected={activeTab === "mine"} className={activeTab === "mine" ? "is-active" : ""} onClick={() => setActiveTab("mine")}><Search size={16} /> My Questions</button>
        <button type="button" role="tab" aria-selected={activeTab === "knowledge"} className={activeTab === "knowledge" ? "is-active" : ""} onClick={() => void openKnowledge()}><BookOpen size={16} /> Course Library</button>
      </nav>

      {activeTab === "all" && <>
        <section className="shell board-tools">
          <label>Filter by module<input value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} placeholder="Search module name" /></label>
          <label>Filter by status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option>New</option><option>Answered</option><option>Explained verbally</option><option value="Will discuss later">Will be discussed later</option><option value="Out of scope">Out of course scope</option><option>Needs follow-up</option></select></label>
          <button type="button" onClick={() => { setModuleFilter(""); setStatusFilter(""); }}><RotateCcw size={14} /> Clear filters</button>
          <button className="board-reset-button" type="button" onClick={() => setShowReset(true)}><Trash2 size={14} /> Reset public board</button>
        </section>
        <section className="shell board-content" role="tabpanel" aria-label="All Questions">
          <div className="board-content__heading"><div><strong>{filteredQuestions.length}</strong> public {filteredQuestions.length === 1 ? "question" : "questions"}</div><span>Upvotes first, then newest</span></div>
          {boardState.error && <p className="board-notice" role="alert">{boardState.error}</p>}
          {boardState.loading ? <div className="skeleton board-list-skeleton" /> : <PublicQuestionBoard questions={filteredQuestions} accessCode={accessCode} votingEnabled={access.voting_enabled} />}
        </section>
      </>}

      {activeTab === "ask" && <section className="shell public-tab-panel" role="tabpanel" aria-label="Ask a Question">
        <div className="public-tab-panel__heading"><div className="eyebrow"><span /> Submit to the instructor</div><h2>Ask a Question</h2><p>Your identity stays private on the public board.</p></div>
        <QuestionSubmitForm accessCode={accessCode} publicSessionId={publicSessionId} onSubmitted={() => { setActiveTab("all"); void loadQuestions(accessCode); }} />
      </section>}

      {activeTab === "mine" && <section className="shell public-tab-panel public-tab-panel--mine" role="tabpanel" aria-label="My Questions">
        <div className="public-tab-panel__heading"><div className="eyebrow"><span /> Your submissions</div><h2>My Questions</h2><p>Use the exact email address entered with your question.</p></div>
        <MyQuestionsLookup accessCode={accessCode} />
      </section>}

      {activeTab === "knowledge" && <section className="shell public-tab-panel knowledge-library" role="tabpanel" aria-label="Course Library">
        <div className="public-tab-panel__heading"><div className="eyebrow"><span /> Course library</div><h2>FAQ, Theory &amp; Code</h2><p>Only material released by your instructor is shown here.</p></div>
        <nav className={libraryTabs.tabs} aria-label="Knowledge type">{(["faq", "theory", "code"] as const).map((kind) => <button type="button" key={kind} className={knowledgeKind === kind ? libraryTabs.active : ""} onClick={() => setKnowledgeKind(kind)}>{kind === "faq" ? "FAQ" : kind === "theory" ? "Theory" : "Code"}<span>{knowledge.filter((document) => document.kind === kind).length}</span></button>)}</nav>
        {knowledgeState.loading && <div className="skeleton board-list-skeleton" />}
        {knowledgeState.error && <p className="form-alert">{knowledgeState.error}</p>}
        {!knowledgeState.loading && !knowledgeState.error && knowledge.length === 0 && <div className="board-empty"><BookOpen /><h2>No material released yet</h2><p>Your instructor controls when each topic becomes visible.</p></div>}
        {!knowledgeState.loading && knowledge.length > 0 && knowledge.filter((document) => document.kind === knowledgeKind).length === 0 && <div className="board-empty"><BookOpen /><h2>No published {knowledgeKind === "faq" ? "FAQ" : knowledgeKind === "theory" ? "Theory" : "Code"} yet</h2><p>Choose another library section.</p></div>}
        <div className="knowledge-library__documents">{knowledge.filter((document) => document.kind === knowledgeKind).map((document) => <article key={document.id}><header><span>{document.kind === "faq" ? "FAQ" : document.kind === "theory" ? "Theory" : "Code"}</span><h3>{document.title}</h3>{document.module_topic && <small>{document.module_topic}</small>}</header><div>{document.knowledge_entries.map((entry) => <details id={`knowledge-entry-${entry.id}`} key={entry.id} onToggle={(event) => { if (event.currentTarget.open) void loadKnowledgeEntry(entry.id); }}><summary>{entry.title}{entry.provenance_label && <small>{entry.provenance_label}</small>}</summary>{knowledgeEntryContent[entry.id]?.loading ? <p className="knowledge-entry-loading">Loading section…</p> : knowledgeEntryContent[entry.id]?.html ? <KnowledgeHtml html={knowledgeEntryContent[entry.id].html ?? ""} /> : <p className="knowledge-entry-loading">{knowledgeEntryContent[entry.id]?.error ?? "Open to load this section."}</p>}</details>)}</div></article>)}</div>
      </section>}

      {showReset && <div className="modal-backdrop" role="presentation"><section className="reset-board-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><button className="reset-board-modal__close" onClick={() => setShowReset(false)} aria-label="Close"><X /></button><div className="reset-board-modal__icon"><Trash2 /></div><h2 id="reset-title">Reset public board</h2><p>This archives every currently public question. Questions remain available to the admin and can be restored individually.</p><form onSubmit={resetPublicBoard}><label>Admin email<input name="email" type="email" autoComplete="username" required /></label><label>Admin password<input name="password" type="password" autoComplete="current-password" required /></label><label>Type <strong>RESET PUBLIC BOARD</strong><input name="confirmation" required /></label>{resetState.error && <p className="form-alert">{resetState.error}</p>}<div><Button type="button" variant="secondary" onClick={() => setShowReset(false)}>Cancel</Button><Button type="submit" disabled={resetState.loading}>{resetState.loading ? "Verifying…" : "Archive public questions"}</Button></div></form></section></div>}
    </div>
  );
}
