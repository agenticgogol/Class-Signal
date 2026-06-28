"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export type LlmOperation = "generate-draft" | "find-duplicates";

const OPERATION_LABELS: Record<LlmOperation, string> = {
  "generate-draft": "Generate AI draft answer",
  "find-duplicates": "AI duplicate re-ranking",
};

// Approximate token budgets per operation: [inputTokens, outputTokens]
const OPERATION_TOKENS: Record<LlmOperation, [number, number]> = {
  "generate-draft": [3000, 1000],
  "find-duplicates": [1500, 800],
};

type ModelCost = { inputPerM: number; outputPerM: number };

function lookupCost(provider: string, model: string): ModelCost | null {
  const m = model.toLowerCase();
  if (provider === "anthropic") {
    if (m.includes("opus")) return { inputPerM: 15, outputPerM: 75 };
    if (m.includes("sonnet")) return { inputPerM: 3, outputPerM: 15 };
    if (m.includes("haiku") && m.includes("4")) return { inputPerM: 0.8, outputPerM: 4 };
    if (m.includes("haiku")) return { inputPerM: 0.25, outputPerM: 1.25 };
  }
  if (provider === "openai") {
    if (m.includes("gpt-4o-mini")) return { inputPerM: 0.15, outputPerM: 0.6 };
    if (m.includes("gpt-4o")) return { inputPerM: 2.5, outputPerM: 10 };
    if (m.includes("gpt-4-turbo")) return { inputPerM: 10, outputPerM: 30 };
    if (m.includes("gpt-4")) return { inputPerM: 30, outputPerM: 60 };
    if (m.includes("gpt-3.5")) return { inputPerM: 0.5, outputPerM: 1.5 };
  }
  if (provider === "gemini") {
    if (m.includes("2.5-pro")) return { inputPerM: 1.25, outputPerM: 10 };
    if (m.includes("2.0-flash") || m.includes("2-flash")) return { inputPerM: 0.1, outputPerM: 0.4 };
    if (m.includes("1.5-pro")) return { inputPerM: 3.5, outputPerM: 10.5 };
    if (m.includes("1.5-flash")) return { inputPerM: 0.35, outputPerM: 1.05 };
    if (m.includes("pro")) return { inputPerM: 0.5, outputPerM: 1.5 };
  }
  return null;
}

function formatCost(usd: number): string {
  if (usd < 0.001) return "<$0.001";
  if (usd < 0.01) return `~$${usd.toFixed(3)}`;
  return `~$${usd.toFixed(2)}`;
}

function estimateCostRange(provider: string, model: string, operation: LlmOperation): string | null {
  const cost = lookupCost(provider, model);
  if (!cost) return null;
  const [inputTok, outputTok] = OPERATION_TOKENS[operation];
  const base = (cost.inputPerM * inputTok + cost.outputPerM * outputTok) / 1_000_000;
  return `${formatCost(base * 0.5)} – ${formatCost(base * 1.8)} per call`;
}

type AiSettings = { provider: string; model: string } | null;
type PendingCall = { operation: LlmOperation; callback: () => void | Promise<void> };

export function useLlmCallWarning() {
  const settingsRef = useRef<AiSettings>(null);
  const [pending, setPending] = useState<PendingCall | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/ai")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { settings?: { provider_name: string; model_name: string } } | null) => {
        if (data?.settings) {
          settingsRef.current = {
            provider: data.settings.provider_name,
            model: data.settings.model_name,
          };
        }
      })
      .catch(() => undefined);
  }, []);

  function withWarning(operation: LlmOperation, callback: () => void | Promise<void>) {
    if (!settingsRef.current) {
      void callback();
      return;
    }
    setPending({ operation, callback });
  }

  function onConfirm() {
    const cb = pending?.callback;
    setPending(null);
    if (cb) void cb();
  }

  function onCancel() {
    setPending(null);
  }

  const settings = settingsRef.current;
  const warningDialog = pending ? (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="llm-warn-title">
      <button className="admin-modal__backdrop" type="button" aria-label="Cancel" onClick={onCancel} />
      <div className="llm-warn-dialog">
        <div className="llm-warn-dialog__header">
          <div className="llm-warn-dialog__icon"><AlertTriangle size={18} /></div>
          <h2 id="llm-warn-title">Confirm AI API call</h2>
          <button type="button" aria-label="Close" onClick={onCancel}><X size={16} /></button>
        </div>
        <p className="llm-warn-dialog__intro">
          This will send a request to an external LLM API and charge your account.
        </p>
        <dl className="llm-warn-dialog__details">
          <div>
            <dt>Operation</dt>
            <dd>{OPERATION_LABELS[pending.operation]}</dd>
          </div>
          {settings && (
            <>
              <div>
                <dt>Provider</dt>
                <dd className="llm-warn-dialog__provider">{settings.provider}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd className="llm-warn-dialog__model">{settings.model || <em>not set</em>}</dd>
              </div>
              {settings.model && (
                <div>
                  <dt>Est. cost</dt>
                  <dd>
                    {estimateCostRange(settings.provider, settings.model, pending.operation) ?? (
                      <em>Unknown model — check provider pricing</em>
                    )}
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
        <p className="llm-warn-dialog__note">
          Cost estimates are approximate. Actual charges depend on context length and your provider plan.
        </p>
        <div className="llm-warn-dialog__actions">
          <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={onConfirm}>Proceed with call</Button>
        </div>
      </div>
    </div>
  ) : null;

  return { withWarning, warningDialog };
}
