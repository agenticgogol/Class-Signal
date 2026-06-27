export const aiProviderOptions = ["openai", "anthropic", "gemini", "other"] as const;
export const maskedApiKey = "••••••••" as const;

export type AiProviderName = (typeof aiProviderOptions)[number];

export type AiSettingsDisplay = {
  provider_name: AiProviderName;
  model_name: string;
  api_key: typeof maskedApiKey | null;
  updated_at: string | null;
};
