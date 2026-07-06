"use client";

import { AlertCircle, BookOpen, Globe2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { AnswerAssistantRun } from "@/lib/answer-assistant/run";

export function AdminAnswerAssistant({ initialRun }: { initialRun: AnswerAssistantRun | null }) {
  const [run, setRun] = useState(initialRun);
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: false });

  async function trigger() {
    setState({ loading: true });
    try {
      const response = await fetch("/api/admin/answer-assistant", { method: "POST" });
      const result = await response.json() as { run?: AnswerAssistantRun; message?: string };
      if (!response.ok || !result.run) {
        setState({ loading: false, error: result.message ?? "The answer assistant could not run." });
        return;
      }
      setRun(result.run);
      setState({ loading: false });
    } catch {
      setState({ loading: false, error: "The answer assistant could not run." });
    }
  }

  const courseCount = run?.results.filter((result) => result.mode === "course").length ?? 0;
  const externalCount = run?.results.filter((result) => result.mode === "external").length ?? 0;
  const errorCount = run?.results.filter((result) => result.error).length ?? 0;

  return (
    <section className="answer-assistant" aria-labelledby="answer-assistant-title">
      <div className="answer-assistant__heading">
        <div><span>Agentic drafting</span><h2 id="answer-assistant-title">Answer Assistant</h2></div>
        <p>Classifies every New / Needs-follow-up question against the Classwise Agenda and Course Library, then drafts an answer for your review. Nothing is published automatically.</p>
      </div>
      <Button onClick={() => void trigger()} disabled={state.loading}><Sparkles size={15} /> {state.loading ? "Running…" : "Run Answer Assistant"}</Button>
      {state.error && <p className="form-alert" role="alert">{state.error}</p>}
      {run && (
        <div className="answer-assistant__summary">
          <div><strong>{run.questions_considered}</strong><span>considered</span></div>
          <div><BookOpen size={14} /><strong>{courseCount}</strong><span>course-grounded drafts</span></div>
          <div><Globe2 size={14} /><strong>{externalCount}</strong><span>external-knowledge drafts</span></div>
          {errorCount > 0 && <div><AlertCircle size={14} /><strong>{errorCount}</strong><span>errors</span></div>}
          <Link href="/admin/questions?ai_draft_state=has_ai_draft">Review drafts →</Link>
        </div>
      )}
    </section>
  );
}
