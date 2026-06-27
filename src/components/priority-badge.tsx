const priorityClassNames: Record<string, string> = {
  Low: "priority-badge--low",
  Medium: "priority-badge--medium",
  High: "priority-badge--high",
  "Discuss live": "priority-badge--live",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`priority-badge ${priorityClassNames[priority] ?? ""}`}>{priority}</span>;
}
