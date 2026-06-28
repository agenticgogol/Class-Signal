import { ArrowLeft, BookOpen, GraduationCap, LayoutDashboard, LogOut, MessageSquareText, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { logout } from "@/app/admin/actions";
import { ThemeToggle } from "@/components/theme-toggle";

export function AdminShell({ children, email }: { children: React.ReactNode; email?: string }) {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar__brand"><span><GraduationCap size={20} /></span><div><strong>ClassSignal</strong><small>Instructor workspace</small></div></div>
          <div className="admin-sidebar__home">
            <Link href="/questions" className="admin-sidebar__back">
              <ArrowLeft size={15} />
              Student view
            </Link>
          </div>
          <div className="admin-sidebar__label">Workspace</div>
          <nav aria-label="Admin navigation">
            <Link href="/admin/questions"><MessageSquareText size={17} /> Answer questions</Link>
            <Link href="/admin/dashboard"><LayoutDashboard size={17} /> Dashboard</Link>
          </nav>
          <div className="admin-sidebar__label">Configuration</div>
          <nav aria-label="Admin configuration">
            <Link href="/admin/knowledge"><BookOpen size={17} /> FAQ &amp; Theory</Link>
            <Link href="/admin/settings"><Settings size={17} /> Settings</Link>
          </nav>
        </div>
        <div className="admin-account">
          <ThemeToggle />
          {email && <span title={email}><ShieldCheck size={13} /> {email}</span>}
          <form action={logout}>
            <button type="submit"><LogOut size={15} /> Sign out</button>
          </form>
        </div>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
