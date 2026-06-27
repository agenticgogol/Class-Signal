import { LockKeyhole, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="brand" href="/questions" aria-label="ClassSignal public board">
          <span className="brand__mark" aria-hidden="true">
            <MessageCircleQuestion size={22} strokeWidth={2.2} />
          </span>
          <span>ClassSignal</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation"><Link href="/questions">Public Board</Link></nav>
        <Link className="site-header__admin" href="/admin/login?reauth=1">
          <LockKeyhole size={15} aria-hidden="true" />
          <span>Admin Login</span>
        </Link>
      </div>
    </header>
  );
}
