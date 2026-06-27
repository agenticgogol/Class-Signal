const statusClassNames: Record<string, string> = {
  Answered: "status-badge--answered",
  Duplicate: "status-badge--muted",
  "Explained verbally": "status-badge--answered",
  "Out of scope": "status-badge--muted",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge ${statusClassNames[status] ?? "status-badge--new"}`}>
      {status}
    </span>
  );
}
