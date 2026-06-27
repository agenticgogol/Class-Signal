import { Download } from "lucide-react";

export function ExportCsvButton() {
  return (
    // A native navigation lets Content-Disposition trigger the file download.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a className="button button--secondary admin-export-button" href="/api/admin/questions/export">
      <Download size={15} aria-hidden="true" /> Export CSV
    </a>
  );
}
