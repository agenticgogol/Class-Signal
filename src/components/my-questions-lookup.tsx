"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays, Clock3, Layers3, Link2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { MarkdownPreview } from "@/components/markdown-preview";
import { KnowledgeHtml } from "@/components/knowledge-html";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type {
  StudentQuestion,
  StudentQuestionFeedback,
  StudentQuestionsResponse,
} from "@/lib/questions/mine-types";
import { questionLimits } from "@/lib/questions/validation";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; questions: StudentQuestion[] };

export function MyQuestionsLookup({ accessCode }: { accessCode: string }) {
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [lookupEmail, setLookupEmail] = useState("");
  const lookupInFlight = useRef(false);

  const lookup = useCallback(async (studentEmail: FormDataEntryValue | string, silent = false) => {
    if (lookupInFlight.current) return;
    lookupInFlight.current = true;
    if (!silent) setState({ status: "loading" });
    try {
      const response = await fetch("/api/questions/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_email: studentEmail, access_code: accessCode }),
      });
      const result = (await response.json()) as Partial<StudentQuestionsResponse> & { message?: string };
      if (!response.ok) { if (!silent) setState({ status: "error", message: result.message ?? "Unable to find your questions." }); return; }
      setState({ status: "success", questions: result.questions ?? [] });
    } catch { if (!silent) setState({ status: "error", message: "Check your connection and try again." }); }
    finally { lookupInFlight.current = false; }
  }, [accessCode]);

  useEffect(() => {
    if (!lookupEmail || state.status !== "success") return;
    const interval = window.setInterval(() => void lookup(lookupEmail, true), 30_000);
    return () => window.clearInterval(interval);
  }, [lookup, lookupEmail, state.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const studentEmail = new FormData(event.currentTarget).get("student_email");
    setLookupEmail(typeof studentEmail === "string" ? studentEmail : "");
    if (studentEmail) await lookup(studentEmail);
  }

  return (
    <div className="mine-lookup">
      <form className="mine-search" onSubmit={handleSubmit} noValidate aria-busy={state.status === "loading"}>
        <label htmlFor="my-questions-email">Email used when asking</label>
        <div className="mine-search__controls">
          <input
            id="my-questions-email"
            name="student_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={questionLimits.student_email}
            placeholder="you@example.com"
            required
            disabled={state.status === "loading"}
          />
          <Button type="submit" disabled={state.status === "loading"}>
            <Search size={17} aria-hidden="true" />
            {state.status === "loading" ? "Searching…" : "Find my questions"}
          </Button>
        </div>
        <p>Your email is used only to match the questions you submitted.</p>
      </form>

      {state.status === "error" && (
        <div className="mine-alert" role="alert">
          <p>{state.message}</p>
          <button className="text-button" type="button" onClick={() => setState({ status: "idle" })}>
            Try again
          </button>
        </div>
      )}
      {state.status === "idle" && (
        <div className="mine-placeholder">
          <Search size={24} aria-hidden="true" />
          <p>Enter the exact email address you used to submit your questions.</p>
        </div>
      )}
      {state.status === "loading" && <QuestionResultsSkeleton />}
      {state.status === "success" && <QuestionResults questions={state.questions} accessCode={accessCode} email={lookupEmail} />}
    </div>
  );
}

function QuestionResults({ questions, accessCode, email }: { questions: StudentQuestion[]; accessCode: string; email: string }) {
  if (questions.length === 0) {
    return (
      <div className="mine-placeholder">
        <Search size={24} aria-hidden="true" />
        <h2>No questions found</h2>
        <p>No submissions exactly match that email address.</p>
      </div>
    );
  }

  return (
    <section className="mine-results" aria-live="polite">
      <div className="mine-results__count">
        <strong>{questions.length}</strong> {questions.length === 1 ? "question" : "questions"} found
      </div>
      <div className="mine-list">
        {questions.map((question) => (
          <article className="mine-question" key={question.id}>
            <div className="mine-question__header">
              <StatusBadge status={question.status} />
              <span>{question.course_name}</span>
            </div>
            <h2>{question.question_text}</h2>
            {question.canonical_question_id && <div className="mine-canonical-notice"><Link2 size={14} /><span><strong>Consolidated with an existing question</strong>{question.canonical_question_text && <small>{question.canonical_question_text}</small>}</span></div>}
            <div className="question-meta">
              <span><Clock3 size={14} /> {format(parseISO(question.created_at), "MMM d, yyyy · h:mm a")}</span>
              {question.class_date && (
                <span><CalendarDays size={14} /> Class date {format(parseISO(question.class_date), "MMM d, yyyy")}</span>
              )}
              {question.class_number && <span>Class {question.class_number}</span>}
              {question.module_topic && <span><Layers3 size={14} /> {question.module_topic}</span>}
            </div>
            <div className="answer-panel">
              <div className="answer-panel__label">Instructor answer</div>
              {question.answer_markdown || question.answer_html ? (
                <>
                  {question.answer_html ? <KnowledgeHtml html={question.answer_html} /> : <MarkdownPreview>{question.answer_markdown ?? ""}</MarkdownPreview>}
                  <AnswerFeedback
                    questionId={question.id}
                    email={email}
                    accessCode={accessCode}
                    initialFeedback={question.feedback}
                  />
                </>
              ) : (
                <p className="answer-pending">No written answer yet. Check back after class.</p>
              )}
              {question.reference_links && (
                <div className="reference-panel">
                  <div className="answer-panel__label">References</div>
                  <MarkdownPreview>{question.reference_links}</MarkdownPreview>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AnswerFeedback({
  questionId,
  email,
  accessCode,
  initialFeedback,
}: {
  questionId: string;
  email: string;
  accessCode: string;
  initialFeedback: StudentQuestionFeedback | null;
}) {
  const [feedback, setFeedback] = useState<StudentQuestionFeedback | null>(initialFeedback);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState(initialFeedback?.reason ?? "");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function send(satisfactionStatus: "satisfied" | "not_satisfied", submittedReason = "") {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/questions/feedback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: questionId,
          participant_email: email,
          satisfaction_status: satisfactionStatus,
          reason: submittedReason,
          access_code: accessCode,
        }),
      });
      const result = (await response.json()) as { feedback?: StudentQuestionFeedback; message?: string };
      if (!response.ok || !result.feedback) {
        setMessage({ type: "error", text: result.message ?? "Unable to save feedback." });
        return;
      }
      setFeedback(result.feedback);
      setReason(result.feedback.reason ?? "");
      setShowReason(false);
      setMessage({ type: "success", text: result.message ?? "Feedback saved." });
    } catch {
      setMessage({ type: "error", text: "Unable to save feedback." });
    } finally {
      setSaving(false);
    }
  }

  const currentStatus = feedback?.satisfaction_status ?? "satisfied";

  return (
    <div className="answer-feedback">
      <div className="answer-feedback__heading">
        <span>Are you satisfied with this answer?</span>
        <small>Current: {currentStatus === "satisfied" ? "Satisfied" : "Not satisfied"}{!feedback ? " (default)" : ""}</small>
      </div>
      <div className="answer-feedback__controls">
        <button
          className={currentStatus === "satisfied" ? "is-selected" : ""}
          type="button"
          disabled={saving}
          onClick={() => void send("satisfied")}
        >Satisfied</button>
        <button
          className={currentStatus === "not_satisfied" ? "is-selected is-negative" : ""}
          type="button"
          disabled={saving}
          onClick={() => setShowReason(true)}
        >Not satisfied</button>
      </div>
      {showReason && (
        <form className="answer-feedback__reason" onSubmit={(event) => { event.preventDefault(); void send("not_satisfied", reason); }}>
          <label htmlFor={`feedback-reason-${questionId}`}>What is still unclear or why are you not satisfied?</label>
          <textarea id={`feedback-reason-${questionId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} rows={3} required autoFocus />
          <div><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save feedback"}</button><button type="button" onClick={() => setShowReason(false)}>Cancel</button></div>
        </form>
      )}
      {feedback?.reason && !showReason && <p className="answer-feedback__saved-reason"><strong>Your reason:</strong> {feedback.reason}</p>}
      {feedback && <small className="answer-feedback__updated">Updated {format(parseISO(feedback.updated_at), "MMM d, yyyy · h:mm a")}</small>}
      {message && <p className={`answer-feedback__message answer-feedback__message--${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
    </div>
  );
}

function QuestionResultsSkeleton() {
  return (
    <div className="mine-list" aria-label="Loading your questions" aria-busy="true">
      <div className="skeleton mine-skeleton" />
      <div className="skeleton mine-skeleton" />
    </div>
  );
}
