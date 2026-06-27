"use client";

import { KeyRound, MessageCircleQuestion, PenLine, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { MyQuestionsLookup } from "@/components/my-questions-lookup";
import { PublicQuestionBoard } from "@/components/public-question-board";
import { QuestionSubmitForm } from "@/components/question-submit-form";
import { Button } from "@/components/ui/button";
import type { PublicAccessInfo } from "@/lib/public-settings/types";
import type { PublicQuestion, PublicQuestionsResponse } from "@/lib/questions/public-types";

const storageKey = "live-course-qa-access-code";
type PublicTab = "all" | "ask" | "mine";

export function QuestionsModule() {
  const [accessCode, setAccessCode] = useState("");
  const [access, setAccess] = useState<PublicAccessInfo | null>(null);
  const [accessState, setAccessState] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [boardState, setBoardState] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [activeTab, setActiveTab] = useState<PublicTab>("all");
  const [moduleFilter, setModuleFilter] = useState("");

  const loadQuestions = useCallback(async (code: string) => {
    setBoardState({ loading: true });
    try {
      const response = await fetch("/api/questions/public", { headers: { "x-class-access-code": code } });
      const result = (await response.json()) as Partial<PublicQuestionsResponse> & { message?: string };
      if (!response.ok) {
        setBoardState({ loading: false, error: result.message ?? "Unable to load questions." });
        return;
      }
      setQuestions(result.questions ?? []);
      setBoardState({ loading: false });
    } catch {
      setBoardState({ loading: false, error: "Unable to reach the question board." });
    }
  }, []);

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

  function changeAccessCode() {
    localStorage.removeItem(storageKey);
    setAccessCode("");
    setAccess(null);
    setQuestions([]);
    setActiveTab("all");
    setAccessState({ loading: false });
  }

  const filteredQuestions = useMemo(() => {
    const query = moduleFilter.trim().toLocaleLowerCase("en-US");
    return query ? questions.filter((question) => question.module_topic?.toLocaleLowerCase("en-US").includes(query)) : questions;
  }, [moduleFilter, questions]);

  if (!access) {
    return (
      <section className="access-gate shell">
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
        <div><div className="eyebrow"><span /> ClassSignal live board</div><h1>Every question, clearly tracked.</h1><p>Ask, upvote, and follow instructor answers for {access.default_course_name}. Showing the last three months.</p></div>
        <div className="board-access-actions"><span><ShieldCheck size={14} /> Access verified</span><button className="change-access-code" type="button" onClick={changeAccessCode}><KeyRound size={14} /> Change access code</button></div>
      </section>
      <nav className="public-tabs shell" aria-label="Public board sections" role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === "all"} className={activeTab === "all" ? "is-active" : ""} onClick={() => setActiveTab("all")}><MessageCircleQuestion size={16} /> All Questions</button>
        <button type="button" role="tab" aria-selected={activeTab === "ask"} className={activeTab === "ask" ? "is-active" : ""} disabled={!access.submissions_enabled} onClick={() => setActiveTab("ask")}><PenLine size={16} /> Ask a Question</button>
        <button type="button" role="tab" aria-selected={activeTab === "mine"} className={activeTab === "mine" ? "is-active" : ""} onClick={() => setActiveTab("mine")}><Search size={16} /> My Questions</button>
      </nav>

      {activeTab === "all" && <>
        <section className="shell board-tools">
          <label>Filter by module<input value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} placeholder="Search module name" /></label>
          <button type="button" onClick={() => { setModuleFilter(""); void loadQuestions(accessCode); }}><RotateCcw size={14} /> Reset to last 3 months</button>
        </section>
        <section className="shell board-content" role="tabpanel" aria-label="All Questions">
          <div className="board-content__heading"><div><strong>{filteredQuestions.length}</strong> public {filteredQuestions.length === 1 ? "question" : "questions"}</div><span>Upvotes first, then newest</span></div>
          {boardState.error && <p className="board-notice" role="alert">{boardState.error}</p>}
          {boardState.loading ? <div className="skeleton board-list-skeleton" /> : <PublicQuestionBoard questions={filteredQuestions} accessCode={accessCode} votingEnabled={access.voting_enabled} />}
        </section>
      </>}

      {activeTab === "ask" && <section className="shell public-tab-panel" role="tabpanel" aria-label="Ask a Question">
        <div className="public-tab-panel__heading"><div className="eyebrow"><span /> Submit to the instructor</div><h2>Ask a Question</h2><p>Your identity stays private on the public board.</p></div>
        <QuestionSubmitForm accessCode={accessCode} onSubmitted={() => { setActiveTab("all"); void loadQuestions(accessCode); }} />
      </section>}

      {activeTab === "mine" && <section className="shell public-tab-panel public-tab-panel--mine" role="tabpanel" aria-label="My Questions">
        <div className="public-tab-panel__heading"><div className="eyebrow"><span /> Your submissions</div><h2>My Questions</h2><p>Use the exact email address entered with your question.</p></div>
        <MyQuestionsLookup accessCode={accessCode} />
      </section>}
    </div>
  );
}
