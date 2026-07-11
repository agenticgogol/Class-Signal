"use client";

import { BookOpen, CheckCircle2, ExternalLink, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { KnowledgeHtml } from "@/components/knowledge-html";
import { questionLimits } from "@/lib/questions/validation";
import type { KnowledgeSuggestion } from "@/lib/knowledge/types";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string; errors: Record<string, string> }
  | { status: "success"; questionId: string; email: string; suggestion: KnowledgeSuggestion | null; response?: string; responding?: boolean };

export function QuestionSubmitForm({ accessCode, publicSessionId, onSubmitted }: { accessCode: string; publicSessionId?: string | null; onSubmitted?: () => void }) {
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [isAnonymous, setIsAnonymous] = useState(false);
  const errors = state.status === "error" ? state.errors : {};

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const form = event.currentTarget;
    const payload: Record<string, FormDataEntryValue | string | boolean> = { ...Object.fromEntries(new FormData(form).entries()), access_code: accessCode, is_anonymous: isAnonymous };
    if (isAnonymous) { delete payload.student_name; delete payload.student_email; }
    if (publicSessionId) payload.public_session_id = publicSessionId;

    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        id?: string;
        suggestion?: KnowledgeSuggestion | null;
        message?: string;
        errors?: Record<string, string>;
      };

      if (!response.ok) {
        setState({
          status: "error",
          message: result.message ?? "We could not submit your question.",
          errors: result.errors ?? {},
        });
        return;
      }

      const email = String(payload.student_email ?? "").trim();
      form.reset();
      setState({ status: "success", questionId: result.id ?? "", email, suggestion: result.suggestion ?? null });
    } catch {
      setState({
        status: "error",
        message: "Unable to reach the server. Check your connection and try again.",
        errors: {},
      });
    }
  }

  if (state.status === "success") {
    const submitted = state;
    async function respondToSuggestion(decision: "accepted" | "rejected") {
      if (!submitted.suggestion) return;
      setState({ ...submitted, responding: true });
      try {
        const response = await fetch("/api/questions/suggestion-feedback", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question_id: submitted.questionId, suggestion_id: submitted.suggestion.id, participant_email: submitted.email, decision, access_code: accessCode }),
        });
        const result = await response.json() as { message?: string };
        if (!response.ok) { setState({ ...submitted, responding: false, response: result.message ?? "Your response could not be saved." }); return; }
        setState({ ...submitted, responding: false, suggestion: null, response: result.message });
      } catch { setState({ ...submitted, responding: false, response: "Your response could not be saved." }); }
    }
    return (
      <div className="success-panel" role="status">
        <span className="success-panel__icon" aria-hidden="true">
          <CheckCircle2 size={30} />
        </span>
        <h2>Your question is in the queue.</h2>
        <p>The instructor can review it without interrupting the lesson.</p>
        {state.suggestion && <section className="knowledge-suggestion">
          <div className="knowledge-suggestion__label"><BookOpen size={16} /> Pulled from {state.suggestion.kind === "faq" ? "FAQ" : state.suggestion.kind === "theory" ? "Theory" : "Code"}<span className={`knowledge-confidence knowledge-confidence--${state.suggestion.confidence_band}`}>{state.suggestion.confidence_band} confidence</span></div>
          <h3>{state.suggestion.title}</h3>
          <div className="knowledge-citation"><span><strong>Source</strong>{state.suggestion.document_title}{state.suggestion.provenance_label ? ` · ${state.suggestion.provenance_label}` : ""}{state.suggestion.module_topic ? ` · ${state.suggestion.module_topic}` : ""}</span><a href={`/questions?section=knowledge&kind=${state.suggestion.kind}#knowledge-entry-${state.suggestion.entry_id}`}><ExternalLink size={14} /> Open cited section</a></div>
          <KnowledgeHtml html={state.suggestion.content_html} />
          {state.email && <>
            <p>Does this answer your question?</p>
            <div><Button disabled={state.responding} onClick={() => void respondToSuggestion("accepted")}><ThumbsUp size={15} /> Yes, this answers it</Button><Button disabled={state.responding} variant="secondary" onClick={() => void respondToSuggestion("rejected")}><ThumbsDown size={15} /> I still need the instructor</Button></div>
          </>}
        </section>}
        {state.response && <p className="form-alert" role="status">{state.response}</p>}
        <div className="success-panel__actions">
          {onSubmitted && <Button onClick={onSubmitted}>Return to board</Button>}
          <Button variant="secondary" onClick={() => setState({ status: "idle" })}>
            Ask another question
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="question-form" onSubmit={handleSubmit} noValidate aria-busy={state.status === "submitting"}>
      <div className="form-section">
        <div className="form-section__heading">
          <span>01</span>
          <div>
            <h2>About you</h2>
            <p>Your details are visible only to the instructor.</p>
          </div>
        </div>
        <label className="anonymous-toggle">
          <input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />
          Post anonymously (skip name and email)
        </label>
        {!isAnonymous && <p className="form-hint">Enter your name, email, or both.</p>}
        <div className="form-grid">
          {!isAnonymous && <FormField
            id="student_name"
            name="student_name"
            label="Your name"
            autoComplete="name"
            maxLength={questionLimits.student_name}
            placeholder="e.g. Maya Chen"
            error={errors.student_name}
          />}
          {!isAnonymous && <FormField
            id="student_email"
            name="student_email"
            label="Email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={questionLimits.student_email}
            placeholder="maya@example.com"
            error={errors.student_email}
          />}
          <FormField
            id="module_topic"
            name="module_topic"
            label="Module name"
            maxLength={questionLimits.module_topic}
            placeholder="RAG and vector search"
            required
            error={errors.module_topic}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">
          <span>02</span>
          <div>
            <h2>Your question</h2>
            <p>Include the specific concept, code, or error you want explained.</p>
          </div>
        </div>
        <div className="form-grid">
          <FormField
            id="question_text"
            name="question_text"
            label="Question"
            multiline
            rows={6}
            maxLength={questionLimits.question_text}
            placeholder="What would you like the instructor to clarify?"
            hint={`Up to ${questionLimits.question_text.toLocaleString()} characters.`}
            required
            error={errors.question_text}
          />
        </div>
      </div>

      {state.status === "error" && (
        <p className="form-alert" role="alert">{state.message}</p>
      )}

      <div className="form-actions">
        <p>By submitting, you agree that your question may appear publicly without your name or email.</p>
        <Button type="submit" disabled={state.status === "submitting"}>
          {state.status === "submitting" ? "Submitting…" : "Submit question"}
          {state.status !== "submitting" && <Send size={17} aria-hidden="true" />}
        </Button>
      </div>
    </form>
  );
}
