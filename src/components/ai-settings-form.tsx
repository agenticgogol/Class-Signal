"use client";

import { format, parseISO } from "date-fns";
import { Bot, CheckCircle2, KeyRound, Save } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  aiProviderOptions,
  type AiSettingsDisplay,
} from "@/lib/ai/settings-types";

export function AiSettingsForm({ initialSettings }: { initialSettings: AiSettingsDisplay }) {
  const [settings, setSettings] = useState(initialSettings);
  const [selectedProvider, setSelectedProvider] = useState(initialSettings.provider_name);
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "saving" }
    | { status: "success"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const apiKeyRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "saving" });
    const form = new FormData(event.currentTarget);
    const apiKey = form.get("api_key");
    const payload = {
      provider_name: form.get("provider_name"),
      model_name: form.get("model_name"),
      ...(typeof apiKey === "string" && apiKey.trim() ? { api_key: apiKey } : {}),
    };

    try {
      const response = await fetch("/api/admin/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        settings?: AiSettingsDisplay;
        message?: string;
      };

      if (!response.ok || !result.settings) {
        setState({ status: "error", message: result.message ?? "Unable to save AI settings." });
        return;
      }

      setSettings(result.settings);
      if (apiKeyRef.current) apiKeyRef.current.value = "";
      setState({ status: "success", message: result.message ?? "AI settings saved." });
    } catch {
      setState({ status: "error", message: "Check your connection and try again." });
    }
  }

  return (
    <form className="ai-settings-form" onSubmit={handleSubmit} noValidate>
      <div className="ai-settings-section">
        <div className="ai-settings-section__title">
          <span><Bot size={18} /></span>
          <div><h2>Provider configuration</h2><p>Choose the service and model used for admin-triggered AI actions. Course + web drafting is available with OpenAI and Anthropic. Hybrid Course Library search is enabled separately with the server-only OPENAI_EMBEDDING_API_KEY environment variable, so student submissions never create hidden token cost unless you opt in.</p></div>
        </div>
        <div className="ai-settings-fields">
          <label>
            Provider
            <select name="provider_name" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value as AiSettingsDisplay["provider_name"])} required>
              {aiProviderOptions.map((provider) => (
                <option key={provider} value={provider}>{provider[0].toUpperCase() + provider.slice(1)}</option>
              ))}
            </select>
          </label>
          <label>
            Model name
            <input
              name="model_name"
              defaultValue={settings.model_name}
              maxLength={200}
              placeholder={selectedProvider === "anthropic" ? "e.g. claude-3-5-sonnet-latest" : selectedProvider === "openai" ? "e.g. gpt-4.1-mini" : selectedProvider === "gemini" ? "e.g. gemini-2.5-flash" : "Enter provider model name"}
              required
            />
          </label>
        </div>
      </div>

      <div className="ai-settings-section">
        <div className="ai-settings-section__title">
          <span><KeyRound size={18} /></span>
          <div><h2>API key</h2><p>The saved credential is never returned to the browser.</p></div>
        </div>
        <div className="ai-key-field">
          <label htmlFor="ai-api-key">Provider API key</label>
          {settings.api_key && (
            <div className="ai-key-status">
              <CheckCircle2 size={15} /> Saved key: <strong>{settings.api_key}</strong>
            </div>
          )}
          <input
            ref={apiKeyRef}
            id="ai-api-key"
            name="api_key"
            type="password"
            autoComplete="new-password"
            maxLength={4096}
            placeholder={settings.api_key && selectedProvider === settings.provider_name ? "Leave blank to keep the saved key" : `Enter ${selectedProvider} API key`}
            required={!settings.api_key || selectedProvider !== settings.provider_name}
          />
          <p>Enter a new value only when you want to replace the saved key.</p>
        </div>
      </div>

      <div className="ai-settings-footer">
        <div>
          {settings.updated_at && <span>Last saved {format(parseISO(settings.updated_at), "MMM d, yyyy · h:mm a")}</span>}
          {state.status === "success" && <p className="ai-settings-success" role="status">{state.message}</p>}
          {state.status === "error" && <p className="admin-editor-error" role="alert">{state.message}</p>}
        </div>
        <Button type="submit" disabled={state.status === "saving"}>
          <Save size={16} /> {state.status === "saving" ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
