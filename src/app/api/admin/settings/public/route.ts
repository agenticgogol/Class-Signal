import {
  getPublicSettings,
  savePublicSettings,
  validatePublicSettings,
} from "@/lib/public-settings/admin";

function settingsError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return Response.json(
    { message: code === "AUTH_REQUIRED" ? "Authentication required." : "Public board settings are unavailable." },
    { status: code === "AUTH_REQUIRED" ? 401 : 503 },
  );
}

export async function GET() {
  try {
    return Response.json({ settings: await getPublicSettings() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return settingsError(error);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Submit a valid JSON request." }, { status: 400 });
  }
  const validation = validatePublicSettings(body);
  if (!validation.success) return Response.json({ message: validation.message }, { status: 422 });
  try {
    const settings = await savePublicSettings(validation.data);
    return Response.json({ settings, message: "Public board settings saved." });
  } catch (error) {
    return settingsError(error);
  }
}
