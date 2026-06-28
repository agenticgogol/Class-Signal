import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";

import type { JoinSession, SessionDescriptor, TeachingBrief } from "@/lib/briefs/types";

export function AdminBriefSummary({ sessions, joins, briefs }: { sessions: SessionDescriptor[]; joins: JoinSession[]; briefs: TeachingBrief[] }) {
  const briefed = new Set(briefs.map((brief) => brief.session_key));
  const closedKeys = new Set(joins.filter((join) => !join.is_active).map((join) => join.session_key));
  const ready = sessions.find((session) => closedKeys.has(session.session_key) && !briefed.has(session.session_key));
  const latest = [...briefs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  return <section className="admin-card dashboard-brief-card"><div><span><FileText size={18} /></span><div><small>Post-class teaching brief</small><h2>{ready ? "A class is ready for review" : latest ? `Latest: ${latest.class_date}` : "Turn class signals into the next agenda"}</h2><p>{ready ? `${ready.course_name} has ${ready.question_count} source questions ready for an immutable brief.` : latest ? `Version ${latest.version_number} preserves ${latest.input_metrics.source_question_ids.length} source questions and the recommended follow-up.` : "Close a QR class session, then generate a deterministic brief with no AI token cost."}</p></div></div><Link href="/admin/briefs">{ready ? "Generate brief" : "Open teaching briefs"}<ArrowRight size={15} /></Link></section>;
}
