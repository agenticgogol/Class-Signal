import type { Metadata } from "next";

import { AdminAnalytics } from "@/components/admin-analytics";
import { AdminFollowUpQueue } from "@/components/admin-follow-up-queue";
import { getAdminQuestions } from "@/lib/questions/admin";
import { calculateAdminAnalytics } from "@/lib/questions/admin-analytics";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  const allQuestions = await getAdminQuestions({ sort: "newest" });
  const analytics = calculateAdminAnalytics(allQuestions);

  return (
    <section className="admin-page admin-dashboard-page">
      <header className="admin-dashboard-hero">
        <div><div className="admin-page__eyebrow">Live operations</div><h1>Question dashboard</h1><p>Understand the room, clear the answer backlog, and follow up where students need more help.</p></div>
        <div className="admin-dashboard-hero__status"><span>System overview</span><strong>{analytics.totalQuestions}</strong><small>questions tracked</small></div>
      </header>

      <AdminAnalytics analytics={analytics} />
      <AdminFollowUpQueue questions={allQuestions} />

    </section>
  );
}
