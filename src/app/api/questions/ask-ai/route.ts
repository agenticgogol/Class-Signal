import { AiProviderError } from "@/lib/ai/types";
import { askLlmDirectly, type DirectAskProvider } from "@/lib/ai/direct-ask";
import { studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";

const providers = new Set<DirectAskProvider>(["openai", "anthropic", "gemini"]);
const MAX_QUESTION_LENGTH = 4000;
const MAX_MODEL_LENGTH = 200;
const MAX_KEY_LENGTH = 4096;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ message: "Submit valid JSON." }, { status: 400 });
  }

  const provider = typeof body.provider === "string" ? body.provider : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!providers.has(provider as DirectAskProvider)) {
    return Response.json({ message: "Select a supported provider (OpenAI, Anthropic, or Gemini)." }, { status: 422 });
  }
  if (!model || model.length > MAX_MODEL_LENGTH) {
    return Response.json({ message: "Enter a valid model name." }, { status: 422 });
  }
  if (!apiKey || apiKey.length > MAX_KEY_LENGTH) {
    return Response.json({ message: "Enter a valid API key." }, { status: 422 });
  }
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ message: `Enter a question up to ${MAX_QUESTION_LENGTH.toLocaleString()} characters.` }, { status: 422 });
  }

  try {
    // Gated the same way as the rest of the public board — a valid class
    // access code is required, but nothing about this call is persisted:
    // the API key and question only ever live in this request's memory.
    await validateStudentAccess(body.access_code, "board");

    const answer = await askLlmDirectly({ provider: provider as DirectAskProvider, model, apiKey, question });
    return Response.json({ answer });
  } catch (error) {
    if (error instanceof Error && error.name === "StudentAccessError") return studentAccessErrorResponse(error);
    if (error instanceof AiProviderError) return Response.json({ message: error.publicMessage }, { status: error.status });
    console.error("Direct AI ask failed", error);
    return Response.json({ message: "That AI request could not be completed. Try again shortly." }, { status: 500 });
  }
}
