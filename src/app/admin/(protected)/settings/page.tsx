import type { Metadata } from "next";
import { CircleDollarSign, ShieldCheck } from "lucide-react";

import { AiSettingsForm } from "@/components/ai-settings-form";
import { PublicSettingsForm } from "@/components/public-settings-form";
import { getAiSettings } from "@/lib/ai/settings";
import { getPublicSettings } from "@/lib/public-settings/admin";

export const metadata: Metadata = { title: "Admin settings" };

export default async function AdminSettingsPage() {
  const [settings, publicSettings] = await Promise.all([getAiSettings(), getPublicSettings()]);

  return (
    <section className="admin-page admin-settings-page">
      <div className="admin-page__eyebrow">Configuration</div>
      <h1>Settings</h1>
      <p>Control student access and configure admin-only AI assistance.</p>

      <h2 className="admin-settings-heading">Public board</h2>
      <PublicSettingsForm initialSettings={publicSettings} />

      <h2 className="admin-settings-heading">AI assistance</h2>
      <div className="ai-cost-note">
        <CircleDollarSign size={20} aria-hidden="true" />
        <div><strong>Admin-only usage</strong><span>AI actions are available only to authenticated admins and may incur costs from your selected provider.</span></div>
      </div>

      <AiSettingsForm initialSettings={settings} />

      <div className="ai-security-note">
        <ShieldCheck size={17} /> API keys are accepted only by protected server routes and are masked after saving.
      </div>
    </section>
  );
}
