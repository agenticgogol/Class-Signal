export default function DashboardLoading() {
  return (
    <div className="admin-page admin-dashboard-page" aria-label="Loading dashboard" aria-busy="true">
      <div className="skeleton admin-dashboard-heading-skeleton" />
      <div className="admin-dashboard-table-skeleton skeleton" />
    </div>
  );
}
