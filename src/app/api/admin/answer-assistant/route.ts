import { getLatestAnswerAssistantRun, runAnswerAssistant } from "@/lib/answer-assistant/run";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTH_REQUIRED") return Response.json({ message: "Authentication required." }, { status: 401 });
  if (message === "SETTINGS_UNAVAILABLE") return Response.json({ message: "No active AI configuration was found. Save a provider, model, and API key in AI settings." }, { status: 422 });
  if (message === "QUESTIONS_UNAVAILABLE" || message === "AGENDA_UNAVAILABLE" || message === "RUN_STORE_UNAVAILABLE") {
    return Response.json({ message: "The answer assistant could not read the required data. Try again shortly." }, { status: 503 });
  }
  console.error("Answer assistant run failed", error);
  return Response.json({ message: "The answer assistant run failed unexpectedly." }, { status: 500 });
}

export async function GET() {
  try {
    const run = await getLatestAnswerAssistantRun();
    return Response.json({ run }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const run = await runAnswerAssistant();
    return Response.json({ run, message: `Considered ${run.questions_considered} question${run.questions_considered === 1 ? "" : "s"}, drafted ${run.drafts_generated}.` }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
