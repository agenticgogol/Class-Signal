import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import {
  feedbackPresenceOptions,
  questionPriorities,
  questionStatuses,
  satisfactionStatuses,
  type AdminQuestionFilters as Filters,
} from "@/lib/questions/admin-types";
import { questionLimits } from "@/lib/questions/validation";

export function AdminQuestionFilters({ filters }: { filters: Filters }) {
  const activeCount = Object.entries(filters).filter(
    ([key, value]) => key !== "sort" && Boolean(value),
  ).length;
  const advancedActive = Boolean(
    filters.asked_from || filters.asked_to || filters.course_name || filters.class_date ||
    filters.class_number || filters.module_topic || filters.student_name || filters.student_email ||
    filters.feedback_presence || filters.not_satisfied_only || filters.visibility ||
    filters.ai_draft_state || filters.duplicate_state,
  );

  return (
    <form className="admin-filters" action="/admin/dashboard" method="get">
      <div className="admin-filters__heading"><div><span><SlidersHorizontal size={15} /></span><div><h2>Filter questions</h2><p>Narrow the management queue without changing analytics.</p></div></div>{activeCount > 0 && <strong>{activeCount} active</strong>}</div>
      <div className="admin-filter-search">
        <Search size={16} aria-hidden="true" />
        <input
          name="search"
          defaultValue={filters.search}
          maxLength={200}
          placeholder="Search question, student, or email"
          aria-label="Search questions"
        />
      </div>
      <div className="admin-filter-grid admin-filter-grid--quick">
        <label>Status<select name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option>{questionStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label>Priority<select name="priority" defaultValue={filters.priority ?? ""}><option value="">All priorities</option>{questionPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        <label>Answer state<select name="answered_state" defaultValue={filters.answered_state ?? ""}><option value="">Any answer state</option><option value="answered">Answered</option><option value="unanswered">Unanswered</option></select></label>
        <label>Satisfaction<select name="satisfaction_status" defaultValue={filters.satisfaction_status ?? ""}><option value="">Any satisfaction</option>{satisfactionStatuses.map((status) => <option key={status} value={status}>{status === "satisfied" ? "Satisfied" : "Not satisfied"}</option>)}</select></label>
        <label>Sort by<select name="sort" defaultValue={filters.sort}><option value="newest">Newest</option><option value="upvotes">Most upvotes</option><option value="status">Status</option><option value="priority">Priority</option></select></label>
      </div>
      <details className="admin-advanced-filters" open={advancedActive}>
        <summary>Advanced filters <span>Dates, student, module, visibility, AI and duplicates</span></summary>
        <div className="admin-filter-grid">
        <label>Asked from<input name="asked_from" type="date" defaultValue={filters.asked_from} /></label>
        <label>Asked to<input name="asked_to" type="date" defaultValue={filters.asked_to} /></label>
        <label>Course<input name="course_name" defaultValue={filters.course_name} maxLength={questionLimits.course_name} /></label>
        <label>Class date<input name="class_date" type="date" defaultValue={filters.class_date} /></label>
        <label>Class number<input name="class_number" defaultValue={filters.class_number} maxLength={questionLimits.class_number} /></label>
        <label>Module topic<input name="module_topic" defaultValue={filters.module_topic} maxLength={questionLimits.module_topic} /></label>
        <label>Student name<input name="student_name" defaultValue={filters.student_name} maxLength={questionLimits.student_name} /></label>
        <label>Student email<input name="student_email" type="email" defaultValue={filters.student_email} maxLength={questionLimits.student_email} /></label>
        <label>Feedback<select name="feedback_presence" defaultValue={filters.feedback_presence ?? ""}><option value="">Any feedback</option>{feedbackPresenceOptions.map((option) => <option key={option} value={option}>{option === "has_feedback" ? "Has feedback" : "No feedback"}</option>)}</select></label>
        <label className="admin-filter-check"><input name="not_satisfied_only" type="checkbox" value="true" defaultChecked={filters.not_satisfied_only} /> Not satisfied only</label>
        <label>Visibility<select name="visibility" defaultValue={filters.visibility ?? ""}><option value="">Public or private</option><option value="public">Public</option><option value="private">Private</option></select></label>
        <label>AI draft<select name="ai_draft_state" defaultValue={filters.ai_draft_state ?? ""}><option value="">With or without draft</option><option value="has_ai_draft">Has AI draft</option><option value="no_ai_draft">No AI draft</option></select></label>
        <label>Duplicate<select name="duplicate_state" defaultValue={filters.duplicate_state ?? ""}><option value="">Duplicate or original</option><option value="duplicate">Duplicate</option><option value="not_duplicate">Not duplicate</option></select></label>
        </div>
      </details>
      <div className="admin-filter-actions">
        <button className="button button--primary" type="submit">Apply</button>
        <Link className="button button--secondary admin-reset-filters" href="/admin/dashboard"><RotateCcw size={14} /> Reset Filters{activeCount > 0 ? ` (${activeCount})` : ""}</Link>
      </div>
    </form>
  );
}
