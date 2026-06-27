import { getAiSettings, saveAiSettings, validateAiSettingsInput } from "@/lib/ai/settings";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const settings = await getAiSettings();
    return Response.json({ settings }, { headers: noStoreHeaders });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 503;
    return Response.json(
      { message: status === 401 ? "Authentication required." : "AI settings are temporarily unavailable." },
      { status, headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Submit a valid JSON request." }, { status: 400 });
  }

  const validation = validateAiSettingsInput(body);
  if (!validation.success) {
    return Response.json({ message: validation.message }, { status: 422 });
  }

  try {
    const settings = await saveAiSettings(validation.data);
    return Response.json({ settings, message: "AI settings saved." }, { headers: noStoreHeaders });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "API_KEY_REQUIRED" ? 422 : 503;
    const message =
      code === "AUTH_REQUIRED"
        ? "Authentication required."
        : code === "API_KEY_REQUIRED"
          ? "An API key is required when creating AI settings."
          : "AI settings could not be saved.";
    return Response.json({ message }, { status, headers: noStoreHeaders });
  }
}
