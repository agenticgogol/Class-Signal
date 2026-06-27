import "server-only";

import { AiProviderError, type AiProvider } from "@/lib/ai/types";

export const geminiProvider: AiProvider = {
  async generateDraftAnswer() {
    throw new AiProviderError(
      "Gemini draft generation is not implemented yet. Select OpenAI in AI settings.",
      422,
    );
  },
};
