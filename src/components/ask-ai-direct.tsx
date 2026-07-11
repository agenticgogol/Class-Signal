"use client";

import { Bot, Lock, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { MarkdownPreview } from "@/components/markdown-preview";

type AskState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success"; answer: string };

export function AskAiDirect({ accessCode, initialQuestion }: { accessCode: string; initialQuestion?: string }) {
  const [provider, setProvider] = useState<"openai" | "anthropic" | "gemini">("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [state, setState] = useState<AskState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });
    try {
      const response = await fetch("/api/questions/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, api_key: apiKey, question, access_code: accessCode }),
      });
      const result = (await response.json()) as { answer?: string; message?: string };
      if (!response.ok || !result.answer) {
        setState({ status: "error", message: result.message ?? "That AI request could not be completed." });
        return;
      }
      setState({ status: "success", answer: result.answer });
    } catch {
      setState({ status: "error", message: "Unable to reach the server. Check your connection and try again." });
    }
  }

  return (
    <div className="ask-ai-direct">
      <p className="ask-ai-direct__intro">
        Didn&apos;t get the specific answer you needed? You can ask any LLM directly — bring your own
        provider, model, and API key, and it will answer right here, tailored to your question.
      </p>
      <div className="ask-ai-direct__privacy">
        <Lock size={14} aria-hidden="true" />
        <span>
          Your API key is sent over an encrypted connection straight to the provider you choose. It is never
          written to a database or log — it exists only in memory for the moment this request runs, then it
          is gone.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="ask-ai-direct__form">
        <div className="form-grid">
          <label>
            Provider
            <select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </label>
          <label>
            Model name
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={provider === "anthropic" ? "claude-opus-4-8" : provider === "openai" ? "gpt-4o" : "gemini-2.5-pro"}
              maxLength={200}
              required
            />
          </label>
        </div>
        <label>
          API key
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste your API key"
            autoComplete="off"
            maxLength={4096}
            required
          />
        </label>
        <label>
          Your question
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Ask anything — the model will pick the sections most relevant to your question."
            required
          />
        </label>

        {state.status === "error" && <p className="form-alert" role="alert">{state.message}</p>}

        <div className="form-actions">
          <p>Nothing here is saved or shown to anyone else.</p>
          <Button type="submit" disabled={state.status === "submitting"}>
            {state.status === "submitting" ? "Asking…" : "Ask the LLM"}
            {state.status !== "submitting" && <Send size={17} aria-hidden="true" />}
          </Button>
        </div>
      </form>

      {state.status === "success" && (
        <div className="ask-ai-direct__answer">
          <div className="ask-ai-direct__answer-label"><Bot size={16} aria-hidden="true" /> Answer</div>
          <MarkdownPreview>{state.answer}</MarkdownPreview>
        </div>
      )}
    </div>
  );
}
