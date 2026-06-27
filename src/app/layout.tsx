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
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <div className="shell site-footer__inner">
            <div>
              <div className="site-footer__eyebrow">ClassSignal</div>
              <p>Every question heard. Every answer tracked. Every class more useful.</p>
            </div>
            <div className="site-footer__links" aria-label="Footer navigation">
              <Link href="/questions">Public Board</Link>
              <Link href="/admin/login?reauth=1">Admin Login</Link>
            </div>
            <Card className="site-footer__card">
              <div className="site-footer__eyebrow">For instructors</div>
              <p>Turn classroom questions into clear answers, visible progress, and actionable teaching signals.</p>
              <Link href="/admin/login?reauth=1">Admin Login</Link>
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
