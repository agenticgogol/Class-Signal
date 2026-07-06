import { createAgendaEntry, getAgendaEntries, validateAgendaSubmission } from "@/lib/classwise-agenda/admin";

export async function GET() {
  try {
    const result = await getAgendaEntries();
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ message: "Authentication required." }, { status: 401 });
    }
    return Response.json({ message: "Classwise agenda could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Submit a valid agenda entry." }, { status: 400 }); }
  const validation = validateAgendaSubmission(body);
  if (!validation.success) return Response.json({ message: "Check the highlighted fields.", errors: validation.errors }, { status: 422 });
  try {
    const entry = await createAgendaEntry(validation.data);
    return Response.json({ entry, message: "Agenda entry created." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ message: "Authentication required." }, { status: 401 });
    }
    const code = (error as { code?: string })?.code;
    if (code === "23505") return Response.json({ message: "That class number already has an agenda entry for this course." }, { status: 409 });
    console.error("Classwise agenda create failed", error);
    return Response.json({ message: "Agenda entry could not be saved." }, { status: 500 });
  }
}
