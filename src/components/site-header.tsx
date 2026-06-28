import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

function ClassSignalMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="hdr-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2b9565" />
          <stop offset="100%" stopColor="#11583a" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="30" rx="9" fill="url(#hdr-grad)" />
      <rect x="8" y="21" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="16" y="15" width="5" height="11" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="24" y="9" width="5" height="17" rx="1.5" fill="white" fillOpacity="0.95" />
      <path d="M7 31 L4 38 L15 31Z" fill="url(#hdr-grad)" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="brand" href="/" aria-label="ClassSignal home">
          <ClassSignalMark />
          <span>ClassSignal</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <Link href="/questions">Class Board</Link>
        </nav>
        <div className="site-header__actions">
          <ThemeToggle />
          <Link className="site-header__admin" href="/admin/questions">
            <LockKeyhole size={15} aria-hidden="true" />
            <span>Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
