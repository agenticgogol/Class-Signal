import { AlertCircle, ArrowRight, CheckCircle2, MessageSquareWarning, ThumbsUp } from "lucide-react";
import Link from "next/link";

import type { AdminQuestion } from "@/lib/questions/admin-types";

function isAnswered(question: AdminQuestion) {
  return Boolean(question.answer_markdown?.trim()) || question.status === "Answered";
}

export function AdminFollowUpQueue({ questions }: { questions: AdminQuestion[] }) {
  const dissatisfied = questions
    .filter((question) => question.feedback?.satisfaction_status === "not_satisfied")
    .sort((left, right) => Date.parse(right.feedback?.updated_at ?? right.updated_at) - Date.parse(left.feedback?.updated_at ?? left.updated_at));
  const unresolved = questions
    .filter((question) => !isAnswered(question))
    .sort((left, right) => right.upvote_count - left.upvote_count || Date.parse(left.created_at) - Date.parse(right.created_at));

  return (
    <section className="follow-up-queue" aria-labelledby="follow-up-queue-title">
      <div className="follow-up-queue__heading">
        <div><span>Instructor attention</span><h2 id="follow-up-queue-title">Follow-up queue</h2></div>
        <p>Prioritized from participant dissatisfaction and unresolved demand.</p>
      </div>
      <div className="follow-up-queue__grid">
        <QueueLane
          title="Dissatisfied participants"
          count={dissatisfied.length}
          icon={<MessageSquareWarning size={17} />}
          empty="No dissatisfied feedback."
          href="/admin/questions"
          items={dissatisfied.slice(0, 5).map((question) => ({
            id: question.id,
            question: question.question_text,
            meta: `${question.student_name} · ${question.student_email}`,
            detail: question.feedback?.reason ?? "No reason provided.",
            tone: "urgent" as const,
          }))}
        />
        <QueueLane
          title="Top-voted unresolved"
          count={unresolved.length}
          icon={<ThumbsUp size={17} />}
          empty="The answer backlog is clear."
          href="/admin/questions"
          items={unresolved.slice(0, 5).map((question) => ({
            id: question.id,
            question: question.question_text,
            meta: `${question.module_topic ?? "No module"} · ${question.status}`,
            detail: `${question.upvote_count} upvote${question.upvote_count === 1 ? "" : "s"}`,
            tone: "demand" as const,
          }))}
        />
      </div>
    </section>
  );
}

type QueueItem = {
  id: string;
  question: string;
  meta: string;
  detail: string;
  tone: "urgent" | "demand";
};

function QueueLane({
  title,
  count,
  icon,
  empty,
  href,
  items,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  empty: string;
  href: string;
  items: QueueItem[];
}) {
  return (
    <article className="follow-up-lane">
      <div className="follow-up-lane__header">
        <div><span>{icon}</span><h3>{title}</h3><strong>{count}</strong></div>
        <Link href={href}>View all <ArrowRight size={13} /></Link>
      </div>
      {items.length === 0 ? (
        <div className="follow-up-lane__empty"><CheckCircle2 size={18} /><span>{empty}</span></div>
      ) : (
        <ol className="follow-up-list">
          {items.map((item) => (
            <li key={item.id}>
              <AlertCircle className={`follow-up-list__icon follow-up-list__icon--${item.tone}`} size={15} />
              <div><strong>{item.question}</strong><span>{item.meta}</span><p>{item.detail}</p></div>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
