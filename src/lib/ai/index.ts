import "server-only";

import { anthropicProvider } from "@/lib/ai/anthropic";
import { geminiProvider } from "@/lib/ai/gemini";
import { openAiProvider } from "@/lib/ai/openai";
import { AiProviderError, type AiProvider } from "@/lib/ai/types";

export function getAiProvider(providerName: string): AiProvider {
  if (providerName === "openai") return openAiProvider;
  if (providerName === "anthropic") return anthropicProvider;
  if (providerName === "gemini") return geminiProvider;
  throw new AiProviderError(
    `The “${providerName}” provider does not support draft generation yet. Select OpenAI or Anthropic in AI settings.`,
    422,
  );
}
