import type { Metadata } from "next";

import { AdminAnalytics } from "@/components/admin-analytics";
import { AdminAnswerAssistant } from "@/components/admin-answer-assistant";
import { AdminAutoRefresh } from "@/components/admin-auto-refresh";
import { AdminFollowUpQueue } from "@/components/admin-follow-up-queue";
import { AdminBriefSummary } from "@/components/admin-brief-summary";
import { getLatestAnswerAssistantRun } from "@/lib/answer-assistant/run";
import { getBriefWorkspace } from "@/lib/briefs/teaching";
import { getAdminQuestions } from "@/lib/questions/admin";
import { calculateAdminAnalytics } from "@/lib/questions/admin-analytics";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  const [allQuestions, briefWorkspace, answerAssistantRun] = await Promise.all([
    getAdminQuestions({ sort: "newest" }),
    getBriefWorkspace(),
    getLatestAnswerAssistantRun().catch(() => null),
  ]);
  const analytics = calculateAdminAnalytics(allQuestions);

  return (
    <section className="admin-page admin-dashboard-page">
      <AdminAutoRefresh intervalMs={30_000} />
      <header className="admin-dashboard-hero">
        <div><div className="admin-page__eyebrow">Live operations</div><h1>Question dashboard</h1><p>Understand the room, clear the answer backlog, and follow up where students need more help.</p></div>
        <div className="admin-dashboard-hero__status"><span>System overview</span><strong>{analytics.totalQuestions}</strong><small>questions tracked</small></div>
      </header>

      <AdminAnalytics analytics={analytics} />
      <AdminAnswerAssistant initialRun={answerAssistantRun} />
      <AdminBriefSummary sessions={briefWorkspace.sessions} joins={briefWorkspace.joins} briefs={briefWorkspace.briefs} />
      <AdminFollowUpQueue questions={allQuestions} />

    </section>
  );
}
