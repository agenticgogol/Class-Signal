import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ClassSignal", template: "%s | ClassSignal" },
  description: "ClassSignal turns live classroom questions into visible, prioritized, trackable answers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem('classsignal-theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}` }} /></head>
      <body>
        <SiteHeader />
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <div className="shell site-footer__inner">
            <div>
              <div className="site-footer__eyebrow">ClassSignal</div>
              <p>Every classroom question heard, tracked, and answered live.</p>
            </div>
            <div className="site-footer__links" aria-label="Footer navigation">
              <Link href="/">Home</Link>
              <Link href="/questions">Class Board</Link>
              <Link href="/admin/questions">Instructor Login</Link>
            </div>
            <Card className="site-footer__card">
              <div className="site-footer__eyebrow">For instructors</div>
              <p>AI-assisted answers, duplicate detection, and a full Q&A audit trail — all in one place.</p>
              <Link href="/admin/questions">Instructor Login</Link>
            </Card>
          </div>
          <div className="shell site-footer__copyright">
            © {new Date().getFullYear()} Utsab Chakraborty. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
