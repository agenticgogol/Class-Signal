import type { AdminQuestion } from "@/lib/questions/admin-types";

export type AdminAnalytics = {
  totalQuestions: number;
  answered: number;
  unanswered: number;
  answerRate: number;
  explainedVerbally: number;
  discussLater: number;
  outOfScope: number;
  totalUpvotes: number;
  averageUpvotes: number;
  uniqueStudents: number;
  uniqueModules: number;
  satisfied: number;
  notSatisfied: number;
  satisfactionRate: number;
  notSatisfiedFollowUp: number;
  averageAnswerHours: number | null;
  last7Days: number;
  last30Days: number;
  mostActiveModule: { name: string; count: number } | null;
  topVotedUnresolved: { question: string; upvotes: number } | null;
  questionsNeedingFollowUp: number;
  statusBreakdown: Array<{ label: string; count: number }>;
  moduleBreakdown: Array<{ label: string; count: number }>;
  dateBreakdown: Array<{ label: string; count: number }>;
};

function isAnswered(question: AdminQuestion) {
  return Boolean(question.answer_markdown?.trim()) || question.status === "Answered";
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function calculateAdminAnalytics(questions: AdminQuestion[], now = new Date()): AdminAnalytics {
  const answeredQuestions = questions.filter(isAnswered);
  const unansweredQuestions = questions.filter((question) => !isAnswered(question));
  const satisfied = questions.filter((question) => question.feedback?.satisfaction_status === "satisfied").length;
  const notSatisfied = questions.filter((question) => question.feedback?.satisfaction_status === "not_satisfied").length;
  const feedbackCount = satisfied + notSatisfied;
  const cutoff7 = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const cutoff30 = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const answerDurations = questions.flatMap((question) => {
    if (!question.answered_at) return [];
    const duration = Date.parse(question.answered_at) - Date.parse(question.created_at);
    return duration >= 0 ? [duration / 3_600_000] : [];
  });
  const moduleBreakdown = countBy(questions.map((question) => question.module_topic?.trim() || "No module"));
  const unresolvedByVotes = [...unansweredQuestions].sort((left, right) => right.upvote_count - left.upvote_count)[0];

  const dateCounts = new Map<string, number>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    dateCounts.set(date.toISOString().slice(0, 10), 0);
  }
  for (const question of questions) {
    const date = question.created_at.slice(0, 10);
    if (dateCounts.has(date)) dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
  }

  return {
    totalQuestions: questions.length,
    answered: answeredQuestions.length,
    unanswered: unansweredQuestions.length,
    answerRate: questions.length ? answeredQuestions.length / questions.length : 0,
    explainedVerbally: questions.filter((question) => question.status === "Explained verbally").length,
    discussLater: questions.filter((question) => question.status === "Will discuss later").length,
    outOfScope: questions.filter((question) => question.status === "Out of scope").length,
    totalUpvotes: questions.reduce((sum, question) => sum + question.upvote_count, 0),
    averageUpvotes: questions.length ? questions.reduce((sum, question) => sum + question.upvote_count, 0) / questions.length : 0,
    uniqueStudents: new Set(questions.map((question) => question.student_email.trim().toLocaleLowerCase("en-US"))).size,
    uniqueModules: new Set(questions.map((question) => question.module_topic?.trim().toLocaleLowerCase("en-US")).filter(Boolean)).size,
    satisfied,
    notSatisfied,
    satisfactionRate: feedbackCount ? satisfied / feedbackCount : 0,
    notSatisfiedFollowUp: notSatisfied,
    averageAnswerHours: answerDurations.length ? answerDurations.reduce((sum, hours) => sum + hours, 0) / answerDurations.length : null,
    last7Days: questions.filter((question) => Date.parse(question.created_at) >= cutoff7).length,
    last30Days: questions.filter((question) => Date.parse(question.created_at) >= cutoff30).length,
    mostActiveModule: moduleBreakdown[0] ? { name: moduleBreakdown[0].label, count: moduleBreakdown[0].count } : null,
    topVotedUnresolved: unresolvedByVotes ? { question: unresolvedByVotes.question_text, upvotes: unresolvedByVotes.upvote_count } : null,
    questionsNeedingFollowUp: questions.filter((question) => question.status === "Needs follow-up" || question.feedback?.satisfaction_status === "not_satisfied").length,
    statusBreakdown: countBy(questions.map((question) => question.status)),
    moduleBreakdown: moduleBreakdown.slice(0, 6),
    dateBreakdown: [...dateCounts.entries()].map(([label, count]) => ({ label: label.slice(5), count })),
  };
}
