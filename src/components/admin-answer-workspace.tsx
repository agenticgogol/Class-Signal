"use client";

import { Bot, BookOpen, CheckCircle2, ClipboardCopy, Edit3, Eye, EyeOff, GitCompareArrows, Globe2, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminQuestionEditor } from "@/components/admin-question-editor";
import { ExportCsvButton } from "@/components/export-csv-button";
import { useLlmCallWarning } from "@/components/llm-call-warning";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  questionStatuses,
  questionStatusLabel,
  type AdminQuestion,
  type DuplicateQuestionOption,
  type SimilarQuestionsBySource,
  type SimilarQuestion,
} from "@/lib/questions/admin-types";

type QueueView = "needs_answer" | "all" | "follow_up";
type GroundingMode = "course_only" | "course_and_web";
type DraftSource = { citationId: string; entryId: string; kind: string; documentTitle: string; sectionTitle: string; similarityScore: number; provenanceLabel?: string | null };
type ExternalCitation = { title: string; url: string };

function hasAnswer(question: AdminQuestion) {
  return Boolean(question.answer_markdown?.trim()) || question.status === "Answered";
}

export function AdminAnswerWorkspace({
  initialQuestions,
  duplicateOptions,
  similarities,
}: {
  initialQuestions: AdminQuestion[];
  duplicateOptions: DuplicateQuestionOption[];
  similarities: SimilarQuestionsBySource;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [selectedId, setSelectedId] = useState(initialQuestions.find((question) => !hasAnswer(question))?.id ?? initialQuestions[0]?.id ?? null);
  const [queueView, setQueueView] = useState<QueueView>("needs_answer");
  const [search, setSearch] = useState("");
  const [fullEditorQuestion, setFullEditorQuestion] = useState<AdminQuestion | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuestions(initialQuestions), 0);
    return () => window.clearTimeout(timeout);
  }, [initialQuestions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-US");
    return questions
      .filter((question) => {
        if (queueView === "needs_answer" && hasAnswer(question)) return false;
        if (queueView === "follow_up" && question.status !== "Needs follow-up" && question.feedback?.satisfaction_status !== "not_satisfied") return false;
        return !query || [question.question_text, question.student_name, question.student_email, question.module_topic ?? ""].some((value) => value.toLocaleLowerCase("en-US").includes(query));
      })
      .sort((left, right) => {
        if (queueView === "needs_answer") return right.upvote_count - left.upvote_count || Date.parse(left.created_at) - Date.parse(right.created_at);
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      });
  }, [queueView, questions, search]);

  const selected = filtered.find((question) => question.id === selectedId) ?? filtered[0] ?? null;
  const unansweredCount = questions.filter((question) => !hasAnswer(question)).length;
  const followUpCount = questions.filter((question) => question.status === "Needs follow-up" || question.feedback?.satisfaction_status === "not_satisfied").length;

  function updateQuestion(updated: AdminQuestion) {
    setQuestions((current) => current.map((question) => question.id === updated.id ? updated : question));
  }

  return (
    <>
      <header className="answer-workspace-header">
        <div><div className="admin-page__eyebrow">Instructor workflow</div><h1>Answer questions</h1><p>Pick a question, write or generate a draft, then publish the answer in one focused workflow.</p></div>
        <ExportCsvButton />
      </header>

      <div className="answer-workspace">
        <aside className="answer-queue">
          <div className="answer-queue__summary"><div><strong>{unansweredCount}</strong><span>Awaiting answers</span></div><div><strong>{followUpCount}</strong><span>Need follow-up</span></div></div>
          <div className="answer-queue__tabs">
            <button className={queueView === "needs_answer" ? "is-active" : ""} type="button" onClick={() => setQueueView("needs_answer")}>Needs answer</button>
            <button className={queueView === "follow_up" ? "is-active" : ""} type="button" onClick={() => setQueueView("follow_up")}>Follow-up</button>
            <button className={queueView === "all" ? "is-active" : ""} type="button" onClick={() => setQueueView("all")}>All</button>
          </div>
          <label className="answer-queue__search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions or students" /></label>
          <div className="answer-queue__list">
            {filtered.length === 0 ? <div className="answer-queue__empty"><CheckCircle2 size={22} /><strong>Queue is clear</strong><span>No questions match this view.</span></div> : filtered.map((question) => (
              <button className={selected?.id === question.id ? "is-selected" : ""} type="button" key={question.id} onClick={() => setSelectedId(question.id)}>
                <div><StatusBadge status={question.status} /><span>{question.upvote_count} votes</span></div>
                <strong>{question.question_text}</strong>
                <small>{question.module_topic ?? "No module"} · {question.student_name}</small>
                {question.feedback?.satisfaction_status === "not_satisfied" && <em>Participant not satisfied</em>}
              </button>
            ))}
          </div>
        </aside>

        <main className="answer-compose">
          {selected ? (
            <AnswerComposer
              key={selected.id}
              question={selected}
              onUpdated={updateQuestion}
              onFullReview={() => setFullEditorQuestion(selected)}
            />
          ) : (
            <div className="answer-compose__empty"><CheckCircle2 size={28} /><h2>Nothing to answer</h2><p>Select another queue or wait for new questions.</p></div>
          )}
        </main>
      </div>

      {fullEditorQuestion && <AdminQuestionEditor
        question={fullEditorQuestion}
        duplicateOptions={duplicateOptions}
        initialSimilarQuestions={similarities[fullEditorQuestion.id] ?? []}
        onClose={() => setFullEditorQuestion(null)}
      />}
    </>
  );
}

function AnswerComposer({
  question,
  onUpdated,
  onFullReview,
}: {
  question: AdminQuestion;
  onUpdated: (question: AdminQuestion) => void;
  onFullReview: () => void;
}) {
  const router = useRouter();
  const { withWarning, warningDialog } = useLlmCallWarning();
  const [answer, setAnswer] = useState(question.answer_markdown ?? "");
  const [references, setReferences] = useState(question.reference_links ?? "");
  const [status, setStatus] = useState(question.status);
  const [isPublic, setIsPublic] = useState(question.is_public);
  const [isAnswerPublic, setIsAnswerPublic] = useState(question.is_answer_public);
  const [aiDraft, setAiDraft] = useState(question.ai_draft_answer ?? "");
  const [groundingMode, setGroundingMode] = useState<GroundingMode>("course_only");
  const [draftSources, setDraftSources] = useState<DraftSource[]>([]);
  const [externalCitations, setExternalCitations] = useState<ExternalCitation[]>([]);
  const [draftConfidence, setDraftConfidence] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<SimilarQuestion[]>([]);
  const [findingDuplicates, setFindingDuplicates] = useState(false);
  const [state, setState] = useState<{ saving: boolean; generating: boolean; message?: string; error?: string }>({ saving: false, generating: false });

  async function save(markAnswered: boolean) {
    if (markAnswered && !answer.trim()) {
      setState({ saving: false, generating: false, error: "Write or copy an answer before marking this question answered." });
      return;
    }
    setState({ saving: true, generating: false });
    const nextStatus = markAnswered ? "Answered" : status;
    try {
      const response = await fetch(`/api/admin/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer_markdown: answer,
          reference_links: references,
          status: nextStatus,
          is_public: isPublic,
          is_answer_public: isAnswerPublic,
        }),
      });
      const result = (await response.json()) as { question?: { updated_at: string }; message?: string };
      if (!response.ok) {
        setState({ saving: false, generating: false, error: result.message ?? "Unable to save this answer." });
        return;
      }
      setStatus(nextStatus);
      onUpdated({ ...question, answer_markdown: answer.trim() || null, reference_links: references.trim() || null, status: nextStatus, is_public: isPublic, is_answer_public: isAnswerPublic, updated_at: result.question?.updated_at ?? question.updated_at });
      setState({ saving: false, generating: false, message: markAnswered ? "Answer published and question marked answered." : "Progress saved." });
      router.refresh();
    } catch {
      setState({ saving: false, generating: false, error: "Check your connection and try again." });
    }
  }

  async function generateDraft() {
    setState({ saving: false, generating: true });
    try {
      const response = await fetch(`/api/admin/questions/${question.id}/generate-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grounding_mode: groundingMode }),
      });
      const result = (await response.json()) as {
        draft?: string; message?: string; warning?: string | null; confidence?: string;
        course_sources?: DraftSource[]; external_citations?: ExternalCitation[];
      };
      if (!response.ok || !result.draft) {
        setState({ saving: false, generating: false, error: result.message ?? "Unable to generate a draft." });
        return;
      }
      setAiDraft(result.draft);
      setDraftSources(result.course_sources ?? []);
      setExternalCitations(result.external_citations ?? []);
      setDraftConfidence(result.confidence ?? null);
      setState({ saving: false, generating: false, message: result.warning ?? result.message ?? "Grounded AI draft generated. Review it before publishing." });
    } catch {
      setState({ saving: false, generating: false, error: "AI draft generation could not be reached." });
    }
  }

  async function findDuplicates() {
    setFindingDuplicates(true); setState({ saving: false, generating: false });
    try {
      const response = await fetch(`/api/admin/questions/${question.id}/find-duplicates`, { method: "POST" });
      const result = await response.json() as { matches?: SimilarQuestion[]; message?: string; ai_warning?: string };
      if (!response.ok) { setState({ saving: false, generating: false, error: result.message ?? "Duplicate search failed." }); setFindingDuplicates(false); return; }
      setDuplicates(result.matches ?? []); setFindingDuplicates(false); setState({ saving: false, generating: false, message: result.ai_warning ?? result.message });
    } catch { setFindingDuplicates(false); setState({ saving: false, generating: false, error: "Duplicate search could not be reached." }); }
  }

  async function mergeDuplicate(candidate: SimilarQuestion) {
    const affected = candidate.participant_count ?? 0;
    if (!window.confirm(`Consolidate this question into “${candidate.question_text.slice(0, 100)}”? ${affected} existing canonical voter${affected === 1 ? "" : "s"} will be included without double-counting.`)) return;
    const response = await fetch(`/api/admin/questions/${question.id}/merge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ canonical_question_id: candidate.id }) });
    const result = await response.json() as { message?: string };
    if (!response.ok) { setState({ saving: false, generating: false, error: result.message ?? "Questions could not be consolidated." }); return; }
    setStatus("Duplicate"); onUpdated({ ...question, status: "Duplicate", duplicate_of_question_id: candidate.id });
    setState({ saving: false, generating: false, message: result.message ?? "Questions consolidated." });
  }

  async function undoMerge() {
    const response = await fetch(`/api/admin/questions/${question.id}/merge`, { method: "DELETE" });
    const result = await response.json() as { message?: string; question?: { status: string; duplicate_of_question_id: string | null; updated_at: string } };
    if (!response.ok) { setState({ saving: false, generating: false, error: result.message ?? "Merge could not be undone." }); return; }
    const restoredStatus = result.question?.status ?? "New";
    setStatus(restoredStatus); onUpdated({ ...question, status: restoredStatus, duplicate_of_question_id: result.question?.duplicate_of_question_id ?? null, updated_at: result.question?.updated_at ?? question.updated_at });
    setState({ saving: false, generating: false, message: result.message ?? "Merge undone." });
  }

  return (
    <div className="answer-composer">
      {warningDialog}
      <header className="answer-composer__header">
        <div><div><StatusBadge status={status} /><PriorityBadge priority={question.priority} /></div><h2>{question.question_text}</h2><p>{question.module_topic ?? "No module"} · {question.student_name} · {question.upvote_count} upvotes</p></div>
        <button type="button" onClick={onFullReview}><Edit3 size={15} /> Full review</button>
      </header>

      {question.feedback?.satisfaction_status === "not_satisfied" && <div className="answer-composer__feedback"><strong>Participant needs clarification</strong><p>{question.feedback.reason ?? "No reason provided."}</p></div>}

      <section className="grounding-control" aria-label="AI grounding mode">
        <div><strong>AI source policy</strong><span>Choose what the copilot may use for this draft.</span></div>
        <div className="grounding-control__options">
          <button type="button" className={groundingMode === "course_only" ? "is-active" : ""} onClick={() => setGroundingMode("course_only")}><BookOpen size={15} /><span><strong>Course only</strong><small>Strictly approved library content</small></span></button>
          <button type="button" className={groundingMode === "course_and_web" ? "is-active" : ""} onClick={() => setGroundingMode("course_and_web")}><Globe2 size={15} /><span><strong>Course + web</strong><small>External search; additional API cost</small></span></button>
        </div>
      </section>

      <div className="answer-composer__toolbar">
        <Button type="button" variant="secondary" onClick={() => withWarning("generate-draft", generateDraft)} disabled={state.generating}><Sparkles size={15} /> {state.generating ? "Generating…" : "Generate AI draft"}</Button>
        <Button type="button" variant="secondary" onClick={() => withWarning("find-duplicates", findDuplicates)} disabled={findingDuplicates}><GitCompareArrows size={15} /> {findingDuplicates ? "Comparing…" : "Find duplicates"}</Button>
        {question.duplicate_of_question_id && <Button type="button" variant="secondary" onClick={() => void undoMerge()}>Undo merge</Button>}
        {aiDraft && <button type="button" onClick={() => { setAnswer(aiDraft); setState({ saving: false, generating: false, message: "AI draft copied. Review and publish when ready." }); }}><ClipboardCopy size={14} /> Copy draft into answer</button>}
      </div>
      {aiDraft && <details className="answer-composer__ai" open={draftSources.length > 0}><summary><Bot size={14} /> Review AI draft {draftConfidence && <span className={`draft-confidence draft-confidence--${draftConfidence}`}>{draftConfidence} confidence</span>}</summary><div>{aiDraft}</div>
        {(draftSources.length > 0 || externalCitations.length > 0) && <section className="draft-evidence"><strong>Evidence used</strong><div>{draftSources.map((source) => <a key={source.entryId} href={`/questions?section=knowledge&kind=${source.kind}#knowledge-entry-${source.entryId}`} target="_blank" rel="noreferrer"><BookOpen size={13} /><span><b>[{source.citationId}] {source.sectionTitle}</b><small>{source.documentTitle}{source.provenanceLabel ? ` · ${source.provenanceLabel}` : ""} · {Math.round(source.similarityScore * 100)}% retrieval match</small></span></a>)}{externalCitations.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><Globe2 size={13} /><span><b>{source.title}</b><small>{source.url}</small></span></a>)}</div></section>}
      </details>}
      {duplicates.length > 0 && <section className="duplicate-results"><header><GitCompareArrows size={16} /><strong>Possible duplicates</strong></header>{duplicates.map((candidate) => <article key={candidate.id}><div><strong>{Math.round(candidate.similarity_score * 100)}% match · {candidate.participant_count ?? 0} existing voters</strong><p>{candidate.question_text}</p>{candidate.similarity_reason && <small>{candidate.similarity_reason}</small>}</div><Button variant="secondary" onClick={() => void mergeDuplicate(candidate)}>Consolidate</Button></article>)}</section>}

      <label className="answer-composer__field">Instructor answer <span>Markdown supported</span><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={12} placeholder="Write a clear, concise answer for the student…" /></label>
      <label className="answer-composer__field">Reference links <span>Optional</span><textarea value={references} onChange={(event) => setReferences(event.target.value)} rows={3} placeholder="Add useful references or documentation links…" /></label>

      <div className="answer-composer__options">
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{questionStatuses.map((option) => <option key={option} value={option}>{questionStatusLabel(option)}</option>)}</select></label>
        <label className="answer-toggle"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /> {isPublic ? <Eye size={15} /> : <EyeOff size={15} />} Show question publicly</label>
        <label className="answer-toggle"><input type="checkbox" checked={isAnswerPublic} onChange={(event) => setIsAnswerPublic(event.target.checked)} /> {isAnswerPublic ? <Eye size={15} /> : <EyeOff size={15} />} Show answer publicly</label>
      </div>

      {state.message && <p className="answer-composer__success" role="status">{state.message}</p>}
      {state.error && <p className="admin-editor-error" role="alert">{state.error}</p>}
      <footer className="answer-composer__actions"><Button type="button" variant="secondary" onClick={() => void save(false)} disabled={state.saving}>Save progress</Button><Button type="button" onClick={() => void save(true)} disabled={state.saving}><CheckCircle2 size={16} /> {state.saving ? "Saving…" : "Publish & mark answered"}</Button></footer>
    </div>
  );
}
