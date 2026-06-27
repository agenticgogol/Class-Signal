"use client";

import { format, parseISO } from "date-fns";
import { Check, Copy, Eye, EyeOff, Search, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import {
  questionPriorities,
  questionStatuses,
  type AdminQuestion,
  type DuplicateQuestionOption,
  type SimilarQuestion,
} from "@/lib/questions/admin-types";

type EditorProps = {
  question: AdminQuestion;
  duplicateOptions: DuplicateQuestionOption[];
  initialSimilarQuestions: SimilarQuestion[];
  onClose: () => void;
};

function displayDate(value: string | null) {
  return value ? format(parseISO(value), "MMM d, yyyy · h:mm a") : "—";
}

export function AdminQuestionEditor({
  question,
  duplicateOptions,
  initialSimilarQuestions,
  onClose,
}: EditorProps) {
  const router = useRouter();
  const closeTimeoutRef = useRef<number | null>(null);
  const [answer, setAnswer] = useState(question.answer_markdown ?? "");
  const [draft, setDraft] = useState(question.ai_draft_answer ?? "");
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState(question.status);
  const [duplicateId, setDuplicateId] = useState(question.duplicate_of_question_id ?? "");
  const [similarQuestions, setSimilarQuestions] = useState(initialSimilarQuestions);
  const [state, setState] = useState<{ saving: boolean; error?: string; success?: string }>({ saving: false });
  const [draftState, setDraftState] = useState<{
    loading: boolean;
    message?: string;
    error?: string;
  }>({ loading: false });
  const [duplicateState, setDuplicateState] = useState<{
    loading: boolean;
    markingId?: string;
    message?: string;
    error?: string;
  }>({ loading: false });

  useEffect(
    () => () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    },
    [],
  );

  async function generateDraft() {
    setDraftState({ loading: true });
    try {
      const response = await fetch(`/api/admin/questions/${question.id}/generate-draft`, {
        method: "POST",
      });
      const result = (await response.json()) as { draft?: string; message?: string };
      if (!response.ok || !result.draft) {
        setDraftState({
          loading: false,
          error: result.message ?? "Unable to generate a draft answer.",
        });
        return;
      }
      setDraft(result.draft);
      setDraftState({ loading: false, message: result.message ?? "Draft answer generated." });
      router.refresh();
    } catch {
      setDraftState({ loading: false, error: "Check your connection and try again." });
    }
  }

  function copyDraftIntoAnswer() {
    setAnswer(draft);
    setShowPreview(false);
    setDraftState({ loading: false, message: "Draft copied into the editable answer. Save changes when ready." });
  }

  async function findDuplicates() {
    setDuplicateState({ loading: true });
    try {
      const response = await fetch(`/api/admin/questions/${question.id}/find-duplicates`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        matches?: SimilarQuestion[];
        ai_reranked?: boolean;
        ai_warning?: string | null;
        message?: string;
      };
      if (!response.ok || !result.matches) {
        setDuplicateState({ loading: false, error: result.message ?? "Unable to find duplicates." });
        return;
      }
      setSimilarQuestions(result.matches);
      setDuplicateState({
        loading: false,
        message: `${result.message ?? "Duplicate search complete."}${result.ai_reranked ? " AI scored the candidates." : ""}${result.ai_warning ? ` ${result.ai_warning}` : ""}`,
      });
      router.refresh();
    } catch {
      setDuplicateState({ loading: false, error: "Check your connection and try again." });
    }
  }

  async function markAsDuplicate(match: SimilarQuestion) {
    setDuplicateState({ loading: false, markingId: match.id });
    try {
      const response = await fetch(`/api/admin/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicate_of_question_id: match.id, status: "Duplicate" }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setDuplicateState({ loading: false, error: result.message ?? "Unable to mark this duplicate." });
        return;
      }
      setDuplicateId(match.id);
      setStatus("Duplicate");
      setDuplicateState({ loading: false, message: "Question marked as a duplicate." });
      router.refresh();
    } catch {
      setDuplicateState({ loading: false, error: "Check your connection and try again." });
    }
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ saving: true });
    const form = new FormData(event.currentTarget);
    const payload = {
      status: form.get("status"),
      priority: form.get("priority"),
      answer_markdown: form.get("answer_markdown"),
      reference_links: form.get("reference_links"),
      admin_notes: form.get("admin_notes"),
      is_public: form.get("is_public") === "on",
      is_answer_public: form.get("is_answer_public") === "on",
      duplicate_of_question_id: form.get("duplicate_of_question_id") || null,
    };

    try {
      const response = await fetch(`/api/admin/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setState({ saving: false, error: result.message ?? "Unable to save question." });
        return;
      }
      router.refresh();
      setState({ saving: false, success: "Question updated." });
      closeTimeoutRef.current = window.setTimeout(onClose, 900);
    } catch {
      setState({ saving: false, error: "Check your connection and try again." });
    }
  }

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="question-editor-title">
      <button className="admin-modal__backdrop" type="button" onClick={onClose} aria-label="Close editor" />
      <div className="admin-editor">
        <div className="admin-editor__header">
          <div><span>Question editor</span><h2 id="question-editor-title">Review and answer</h2></div>
          <button type="button" onClick={onClose} aria-label="Close editor"><X size={20} /></button>
        </div>
        <div className="admin-editor__scroll">
          <section className="admin-editor__question">
            <h3>{question.question_text}</h3>
            <dl className="admin-detail-grid">
              <div><dt>Student</dt><dd>{question.student_name}</dd></div>
              <div><dt>Email</dt><dd>{question.student_email}</dd></div>
              <div><dt>Course</dt><dd>{question.course_name}</dd></div>
              <div><dt>Class</dt><dd>{question.class_date ?? "—"} · #{question.class_number ?? "—"}</dd></div>
              <div><dt>Module</dt><dd>{question.module_topic ?? "—"}</dd></div>
              <div><dt>Upvotes</dt><dd>{question.upvote_count}</dd></div>
              <div><dt>Created</dt><dd>{displayDate(question.created_at)}</dd></div>
              <div><dt>Updated</dt><dd>{displayDate(question.updated_at)}</dd></div>
              <div><dt>Answered</dt><dd>{displayDate(question.answered_at)}</dd></div>
              <div><dt>Feedback</dt><dd>{question.feedback ? (question.feedback.satisfaction_status === "satisfied" ? "Satisfied" : "Not satisfied") : "None"}</dd></div>
              <div><dt>ID</dt><dd className="admin-mono">{question.id}</dd></div>
            </dl>
            {question.feedback?.reason && <div className="admin-feedback-reason"><strong>Participant feedback reason</strong><p>{question.feedback.reason}</p><span>Updated {displayDate(question.feedback.updated_at)}</span></div>}
            <details className="admin-technical-details">
              <summary>Normalized question text</summary>
              <div><strong>Normalized question</strong><p>{question.normalized_question_text ?? "—"}</p></div>
            </details>
          </section>

          <form className="admin-editor-form" onSubmit={saveQuestion}>
            <div className="admin-editor-row">
              <label>Status<select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>{questionStatuses.map((statusOption) => <option key={statusOption}>{statusOption}</option>)}</select></label>
              <label>Priority<select name="priority" defaultValue={question.priority}>{questionPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
            </div>
            <label className="admin-check"><input name="is_public" type="checkbox" defaultChecked={question.is_public} /> {question.is_public ? <Eye size={16} /> : <EyeOff size={16} />} Publicly visible</label>
            <label className="admin-check"><input name="is_answer_public" type="checkbox" defaultChecked={question.is_answer_public} /> Publish answer to participant</label>
            <label>Duplicate of<select name="duplicate_of_question_id" value={duplicateId} onChange={(event) => setDuplicateId(event.target.value)}><option value="">Not a duplicate</option>{duplicateOptions.filter((option) => option.id !== question.id).map((option) => <option key={option.id} value={option.id}>{option.course_name} — {option.question_text.slice(0, 80)}</option>)}</select></label>
            <section className="duplicate-panel">
              <div className="duplicate-panel__header">
                <div><span>Similarity check</span><h3>Potential duplicates</h3></div>
                <Button type="button" variant="secondary" onClick={findDuplicates} disabled={duplicateState.loading || Boolean(duplicateState.markingId)}>
                  <Search size={15} /> {duplicateState.loading ? "Searching…" : "Find duplicates"}
                </Button>
              </div>
              {similarQuestions.length > 0 ? (
                <ol className="duplicate-list">
                  {similarQuestions.map((match) => (
                    <li key={match.id}>
                      <div>
                        <strong>{match.question_text}</strong>
                        <span>{match.course_name} · {Math.round(match.similarity_score * 100)}% similar · {match.method === "anthropic_ai" ? "Anthropic" : match.method === "local_similarity" ? "Local" : "AI"}</span>
                        {match.similarity_reason && <p>{match.similarity_reason}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => markAsDuplicate(match)}
                        disabled={Boolean(duplicateState.markingId)}
                      >
                        <Check size={14} /> {duplicateState.markingId === match.id ? "Marking…" : "Mark duplicate"}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="duplicate-panel__empty">No stored matches. Run the similarity check to compare this question.</p>
              )}
              {duplicateState.message && <p className="duplicate-panel__message" role="status">{duplicateState.message}</p>}
              {duplicateState.error && <p className="admin-editor-error" role="alert">{duplicateState.error}</p>}
            </section>
            <section className="ai-draft-panel">
              <div className="ai-draft-panel__header">
                <div><span>AI assistant</span><h3>Draft answer</h3></div>
                <Button type="button" variant="secondary" onClick={generateDraft} disabled={draftState.loading}>
                  <Sparkles size={15} /> {draftState.loading ? "Generating…" : "Generate draft answer"}
                </Button>
              </div>
              {draft ? (
                <>
                  <div className="ai-draft-panel__content"><MarkdownPreview>{draft}</MarkdownPreview></div>
                  <button className="ai-copy-button" type="button" onClick={copyDraftIntoAnswer}>
                    <Copy size={14} /> Copy into answer_markdown
                  </button>
                </>
              ) : (
                <p className="ai-draft-empty">No AI draft has been generated for this question.</p>
              )}
              {draftState.message && <p className="ai-draft-message" role="status">{draftState.message}</p>}
              {draftState.error && <p className="admin-editor-error" role="alert">{draftState.error}</p>}
            </section>
            <div className="admin-answer-label">
              <label htmlFor="answer_markdown">Answer (Markdown)</label>
              <button type="button" onClick={() => setShowPreview((current) => !current)}>{showPreview ? "Edit Markdown" : "Preview"}</button>
            </div>
            {showPreview ? (
              <div className="admin-markdown-preview">{answer ? <MarkdownPreview>{answer}</MarkdownPreview> : <p>Nothing to preview.</p>}</div>
            ) : (
              <textarea id="answer_markdown" name="answer_markdown" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={10} maxLength={50000} />
            )}
            {showPreview && <input type="hidden" name="answer_markdown" value={answer} />}
            <label>Reference links<textarea name="reference_links" defaultValue={question.reference_links ?? ""} rows={4} maxLength={10000} /></label>
            <label>Admin notes<textarea name="admin_notes" defaultValue={question.admin_notes ?? ""} rows={5} maxLength={20000} /></label>
            {state.success && <p className="admin-editor-success" role="status">{state.success}</p>}
            {state.error && <p className="admin-editor-error" role="alert">{state.error}</p>}
            <div className="admin-editor-actions">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={state.saving}>{state.saving ? "Saving…" : "Save changes"}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
