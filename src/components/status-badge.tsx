const statusClassNames: Record<string, string> = {
  Answered: "status-badge--answered",
  Duplicate: "status-badge--muted",
  "Explained verbally": "status-badge--answered",
  "Out of scope": "status-badge--muted",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status === "Will discuss later" ? "Will be discussed later" : status === "Out of scope" ? "Out of course scope" : status;
  return (
    <span className={`status-badge ${statusClassNames[status] ?? "status-badge--new"}`}>
      {label}
    </span>
  );
}
