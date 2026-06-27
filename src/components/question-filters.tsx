import { Filter, RotateCcw } from "lucide-react";
import Link from "next/link";

import { questionLimits } from "@/lib/questions/validation";
import type { PublicQuestionFilters } from "@/lib/questions/public-types";

export function QuestionFilters({ filters }: { filters: PublicQuestionFilters }) {
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <form className="filter-panel" action="/questions" method="get">
      <div className="filter-panel__title">
        <span><Filter size={16} aria-hidden="true" /> Filters</span>
        {activeCount > 0 && <span className="filter-count">{activeCount} active</span>}
      </div>
      <div className="filter-grid">
        <label>
          Course name
          <input name="course_name" defaultValue={filters.course_name} maxLength={questionLimits.course_name} placeholder="Exact course name" />
        </label>
        <label>
          Class date
          <input name="class_date" type="date" defaultValue={filters.class_date} />
        </label>
        <label>
          Class number
          <input name="class_number" defaultValue={filters.class_number} maxLength={questionLimits.class_number} placeholder="e.g. 04" />
        </label>
        <label>
          Module or topic
          <input name="module_topic" defaultValue={filters.module_topic} maxLength={questionLimits.module_topic} placeholder="Exact topic" />
        </label>
      </div>
      <div className="filter-actions">
        <button className="button button--primary" type="submit">Apply filters</button>
        {activeCount > 0 && (
          <Link className="filter-reset" href="/questions"><RotateCcw size={14} /> Clear all</Link>
        )}
      </div>
    </form>
  );
}
