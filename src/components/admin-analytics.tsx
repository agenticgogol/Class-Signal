import { BarChart3, Clock3, MessageCircle, MessagesSquare, Smile, TrendingUp, Users } from "lucide-react";

import type { AdminAnalytics as Analytics } from "@/lib/questions/admin-analytics";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function answerTime(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function AdminAnalytics({ analytics }: { analytics: Analytics }) {
  const primary = [
    { label: "Total questions", value: analytics.totalQuestions, note: `${analytics.last30Days} in the last 30 days`, icon: <MessagesSquare size={19} />, tone: "green" },
    { label: "Answered", value: analytics.answered, note: `${percent(analytics.answerRate)} answer rate`, icon: <TrendingUp size={19} />, tone: "blue" },
    { label: "Answer backlog", value: analytics.unanswered, note: analytics.unanswered ? "Questions still awaiting an answer" : "Everything is answered", icon: <Clock3 size={19} />, tone: "amber" },
    { label: "Unique students", value: analytics.uniqueStudents, note: `${analytics.uniqueModules} active modules`, icon: <Users size={19} />, tone: "violet" },
    { label: "Satisfaction", value: percent(analytics.satisfactionRate), note: `${analytics.satisfied + analytics.notSatisfied} recorded responses`, icon: <Smile size={19} />, tone: "teal" },
  ] as const;

  const groups = [
    {
      title: "Engagement",
      icon: <BarChart3 size={16} />,
      stats: [["Total upvotes", analytics.totalUpvotes], ["Average upvotes", analytics.averageUpvotes.toFixed(1)], ["Unique modules", analytics.uniqueModules]],
    },
    {
      title: "Question outcomes",
      icon: <MessageCircle size={16} />,
      stats: [["Explained verbally", analytics.explainedVerbally], ["Discuss later", analytics.discussLater], ["Out of scope", analytics.outOfScope]],
    },
    {
      title: "Satisfaction",
      icon: <Smile size={16} />,
      stats: [["Satisfied", analytics.satisfied], ["Not satisfied", analytics.notSatisfied], ["Needs follow-up", analytics.notSatisfiedFollowUp]],
    },
    {
      title: "Response velocity",
      icon: <Clock3 size={16} />,
      stats: [["Average answer time", answerTime(analytics.averageAnswerHours)], ["Asked in 7 days", analytics.last7Days], ["Asked in 30 days", analytics.last30Days]],
    },
  ] as const;

  return (
    <>
      <section className="analytics-overview" aria-label="Question analytics overview">
        {primary.map((metric) => (
          <article className={`analytics-kpi analytics-kpi--${metric.tone}`} key={metric.label}>
            <div><span>{metric.icon}</span><small>{metric.label}</small></div>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="analytics-detail-grid" aria-label="Detailed analytics">
        {groups.map((group) => (
          <article className="analytics-detail-card" key={group.title}>
            <h3><span>{group.icon}</span>{group.title}</h3>
            <dl>{group.stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </article>
        ))}
      </section>

      <section className="analytics-story" aria-labelledby="efficiency-story-title">
        <div className="analytics-section-heading"><span>Operations story</span><h2 id="efficiency-story-title">What needs attention now</h2></div>
        <div className="analytics-story-grid">
          <article><span>Most active module</span><strong>{analytics.mostActiveModule?.name ?? "No module data"}</strong><p>{analytics.mostActiveModule ? `${analytics.mostActiveModule.count} questions` : "No questions yet"}</p></article>
          <article><span>Top voted unresolved</span><strong>{analytics.topVotedUnresolved?.question ?? "No unresolved questions"}</strong><p>{analytics.topVotedUnresolved ? `${analytics.topVotedUnresolved.upvotes} upvotes` : "Backlog is clear"}</p></article>
          <article><span>Needs follow-up</span><strong>{analytics.questionsNeedingFollowUp}</strong><p>Follow-up status or dissatisfied feedback</p></article>
          <article><span>Student satisfaction signal</span><strong>{percent(analytics.satisfactionRate)}</strong><p>{analytics.satisfied + analytics.notSatisfied} recorded responses</p></article>
        </div>
      </section>

      <section className="analytics-breakdowns" aria-label="Analytics breakdowns">
        <Breakdown title="By status" values={analytics.statusBreakdown} />
        <Breakdown title="Top modules" values={analytics.moduleBreakdown} />
        <Breakdown title="Questions by day · last 7 days" values={analytics.dateBreakdown} />
      </section>
    </>
  );
}

function Breakdown({ title, values }: { title: string; values: Array<{ label: string; count: number }> }) {
  const maximum = Math.max(...values.map((value) => value.count), 1);
  return (
    <article className="analytics-breakdown">
      <h3>{title}</h3>
      {values.length === 0 ? <p>No data available.</p> : (
        <ul>{values.map((value) => <li key={value.label}><div><span>{value.label}</span><strong>{value.count}</strong></div><i style={{ width: `${(value.count / maximum) * 100}%` }} /></li>)}</ul>
      )}
    </article>
  );
}
