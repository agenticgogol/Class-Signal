import { format, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, ChevronDown, Clock3, Layers3 } from "lucide-react";

import { MarkdownPreview } from "@/components/markdown-preview";
import { StatusBadge } from "@/components/status-badge";
import { UpvoteButton } from "@/components/upvote-button";
import type { PublicQuestion } from "@/lib/questions/public-types";

export function PublicQuestionBoard({
  questions,
  accessCode,
  votingEnabled,
}: {
  questions: PublicQuestion[];
  accessCode: string;
  votingEnabled: boolean;
}) {
  if (questions.length === 0) {
    return (
      <div className="board-empty">
        <span aria-hidden="true">?</span>
        <h2>No questions found</h2>
        <p>Try clearing a filter, or submit the first question for this class.</p>
      </div>
    );
  }

  return (
    <div className="question-list">
      {questions.map((question, index) => (
        <article className="public-question" key={question.id}>
          <div className="public-question__rank" aria-label={`Rank ${index + 1}`}>
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="public-question__body">
            <div className="public-question__topline">
              <span className="public-question__status-label">Status</span>
              <StatusBadge status={question.status} />
              <span className="course-label">{question.course_name}</span>
            </div>
            <h2>{question.question_text}</h2>
            <div className="question-meta">
              {question.class_date && (
                <span>
                  <CalendarDays size={14} aria-hidden="true" />
                  <time dateTime={question.class_date}>{format(parseISO(question.class_date), "MMM d, yyyy")}</time>
                </span>
              )}
              {question.class_number && <span>Class {question.class_number}</span>}
              {question.module_topic && (
                <span><Layers3 size={14} aria-hidden="true" /> {question.module_topic}</span>
              )}
            </div>
            <div className="public-question__vote">
              {votingEnabled
                ? <UpvoteButton questionId={question.id} initialCount={question.upvote_count} accessCode={accessCode} />
                : <span className="voting-disabled">Voting is disabled</span>}
            </div>
            {question.answer_markdown ? (
              <details className="public-answer">
                <summary><span><CheckCircle2 size={15} /> {question.answer_source === "knowledge" ? "Pulled from course FAQ / Theory" : "Instructor answer"}</span><span>View answer <ChevronDown size={15} /></span></summary>
                <div className="public-answer__content"><MarkdownPreview>{question.answer_markdown}</MarkdownPreview>
                  {question.reference_links && <div className="public-answer__references"><strong>References</strong><MarkdownPreview>{question.reference_links}</MarkdownPreview></div>}
                </div>
              </details>
            ) : (
              <div className="public-answer-pending"><Clock3 size={14} /><span>{question.status === "Answered" ? "The instructor has answered this question, but the written answer is not public." : "Awaiting an instructor answer."}</span></div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
