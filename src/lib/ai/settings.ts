import "server-only";

import {
  aiProviderOptions,
  maskedApiKey,
  type AiProviderName,
  type AiSettingsDisplay,
} from "@/lib/ai/settings-types";
import { createClient } from "@/lib/supabase/server";
import type { AiRuntimeSettings } from "@/lib/ai/types";

type AiSettingsInput = {
  provider_name: AiProviderName;
  model_name: string;
  api_key?: string;
};

type SettingsRow = {
  id: string;
  provider_name: string;
  model_name: string | null;
  encrypted_api_key: string;
  updated_at: string;
};

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) throw new Error("AUTH_REQUIRED");
  return supabase;
}

function toDisplaySettings(row: SettingsRow | null): AiSettingsDisplay {
  return {
    provider_name: aiProviderOptions.includes(row?.provider_name as AiProviderName)
      ? (row?.provider_name as AiProviderName)
      : "openai",
    model_name: row?.model_name ?? "",
    api_key: row?.encrypted_api_key ? maskedApiKey : null,
    updated_at: row?.updated_at ?? null,
  };
}

export function validateAiSettingsInput(input: unknown):
  | { success: true; data: AiSettingsInput }
  | { success: false; message: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, message: "Submit valid AI settings." };
  }

  const record = input as Record<string, unknown>;
  const allowedFields = new Set(["provider_name", "model_name", "api_key"]);
  if (Object.keys(record).some((key) => !allowedFields.has(key))) {
    return { success: false, message: "The settings contain unsupported fields." };
  }

  const provider = record.provider_name;
  const model = typeof record.model_name === "string" ? record.model_name.trim() : "";
  const apiKey = typeof record.api_key === "string" ? record.api_key.trim() : undefined;

  if (typeof provider !== "string" || !aiProviderOptions.includes(provider as AiProviderName)) {
    return { success: false, message: "Select a valid AI provider." };
  }
  if (!model || model.length > 200) {
    return { success: false, message: "Model name is required and must be 200 characters or fewer." };
  }
  if (record.api_key !== undefined && typeof record.api_key !== "string") {
    return { success: false, message: "API key must be text." };
  }
  if (apiKey && apiKey.length > 4096) {
    return { success: false, message: "API key must be 4,096 characters or fewer." };
  }

  return {
    success: true,
    data: {
      provider_name: provider as AiProviderName,
      model_name: model,
      ...(apiKey ? { api_key: apiKey } : {}),
    },
  };
}

export async function getAiSettings(): Promise<AiSettingsDisplay> {
  const supabase = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("admin_ai_settings")
    .select("id, provider_name, model_name, encrypted_api_key, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("AI settings lookup failed", { code: error.code, message: error.message });
    throw new Error("SETTINGS_UNAVAILABLE");
  }

  return toDisplaySettings(data as SettingsRow | null);
}

export async function getActiveAiRuntimeSettings(): Promise<AiRuntimeSettings | null> {
  const supabase = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("admin_ai_settings")
    .select("provider_name, model_name, encrypted_api_key")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Active AI runtime settings lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("SETTINGS_UNAVAILABLE");
  }
  if (!data) return null;
  if (!data.model_name?.trim()) throw new Error("MODEL_REQUIRED");
  if (!data.encrypted_api_key?.trim()) throw new Error("API_KEY_REQUIRED");
  if (!data.provider_name?.trim()) throw new Error("PROVIDER_REQUIRED");

  return {
    providerName: data.provider_name,
    modelName: data.model_name,
    apiKey: data.encrypted_api_key,
  };
}

export async function saveAiSettings(input: AiSettingsInput): Promise<AiSettingsDisplay> {
  const supabase = await getAuthenticatedClient();
  const { data: existing, error: lookupError } = await supabase
    .from("admin_ai_settings")
    .select("id, provider_name, encrypted_api_key")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("AI settings save lookup failed", { code: lookupError.code, message: lookupError.message });
    throw new Error("SETTINGS_UNAVAILABLE");
  }

  const providerChanged = Boolean(existing && existing.provider_name !== input.provider_name);
  const storedKey = input.api_key ?? (providerChanged ? undefined : existing?.encrypted_api_key);
  if (!storedKey) throw new Error("API_KEY_REQUIRED");

  const values = {
    provider_name: input.provider_name,
    model_name: input.model_name,
    encrypted_api_key: storedKey,
    is_active: true,
  };

  const result = existing
    ? await supabase
        .from("admin_ai_settings")
        .update(values)
        .eq("id", existing.id)
        .select("id, provider_name, model_name, updated_at")
        .single()
    : await supabase
        .from("admin_ai_settings")
        .insert(values)
        .select("id, provider_name, model_name, updated_at")
        .single();

  if (result.error) {
    console.error("AI settings save failed", { code: result.error.code, message: result.error.message });
    throw new Error("SETTINGS_UNAVAILABLE");
  }

  const { error: deactivateError } = await supabase
    .from("admin_ai_settings")
    .update({ is_active: false })
    .neq("id", result.data.id);
  if (deactivateError) {
    console.error("Old AI settings deactivation failed", {
      code: deactivateError.code,
      message: deactivateError.message,
    });
  }

  return {
    provider_name: result.data.provider_name as AiProviderName,
    model_name: result.data.model_name ?? "",
    api_key: maskedApiKey,
    updated_at: result.data.updated_at,
  };
}
