"use client";

import { KeyRound, Save, Settings2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { PublicSettings } from "@/lib/public-settings/types";

export function PublicSettingsForm({ initialSettings }: { initialSettings: PublicSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [state, setState] = useState<{ saving: boolean; message?: string; error?: string }>({ saving: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ saving: true });
    const form = new FormData(event.currentTarget);
    const payload = {
      active_access_code: form.get("active_access_code"),
      public_board_enabled: form.get("public_board_enabled") === "on",
      submissions_enabled: form.get("submissions_enabled") === "on",
      voting_enabled: form.get("voting_enabled") === "on",
      default_course_name: form.get("default_course_name"),
      timezone: form.get("timezone"),
    };
    try {
      const response = await fetch("/api/admin/settings/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { settings?: PublicSettings; message?: string };
      if (!response.ok || !result.settings) {
        setState({ saving: false, error: result.message ?? "Unable to save public board settings." });
        return;
      }
      setSettings(result.settings);
      setState({ saving: false, message: result.message });
    } catch {
      setState({ saving: false, error: "Check your connection and try again." });
    }
  }

  return (
    <form className="ai-settings-form public-settings-form" onSubmit={submit}>
      <div className="ai-settings-section">
        <div className="ai-settings-section__title">
          <span><KeyRound size={18} /></span>
          <div><h2>Class access</h2><p>Students must enter this exact code before any board action.</p></div>
        </div>
        <div className="public-settings-fields">
          <label>Active access code<input name="active_access_code" defaultValue={settings.active_access_code ?? ""} maxLength={200} autoComplete="off" placeholder="Set a class code" /></label>
          <label>Default course name<input name="default_course_name" defaultValue={settings.default_course_name} maxLength={160} required /></label>
          <label>Timezone<input name="timezone" defaultValue={settings.timezone} maxLength={100} required /></label>
        </div>
      </div>
      <div className="ai-settings-section">
        <div className="ai-settings-section__title">
          <span><Settings2 size={18} /></span>
          <div><h2>Student capabilities</h2><p>Disable individual public actions without changing the access code.</p></div>
        </div>
        <div className="public-settings-toggles">
          <label><input type="checkbox" name="public_board_enabled" defaultChecked={settings.public_board_enabled} /> Public board enabled</label>
          <label><input type="checkbox" name="submissions_enabled" defaultChecked={settings.submissions_enabled} /> Submissions enabled</label>
          <label><input type="checkbox" name="voting_enabled" defaultChecked={settings.voting_enabled} /> Voting enabled</label>
        </div>
      </div>
      <div className="ai-settings-footer">
        <div>
          {state.message && <p className="ai-settings-success" role="status">{state.message}</p>}
          {state.error && <p className="admin-editor-error" role="alert">{state.error}</p>}
        </div>
        <Button type="submit" disabled={state.saving}><Save size={16} /> {state.saving ? "Saving…" : "Save public settings"}</Button>
      </div>
    </form>
  );
}
