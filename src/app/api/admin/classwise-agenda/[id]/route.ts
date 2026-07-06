import { deleteAgendaEntry, updateAgendaEntry, validateAgendaSubmission } from "@/lib/classwise-agenda/admin";
import { isQuestionId } from "@/lib/questions/admin-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isQuestionId(id)) return Response.json({ message: "Invalid agenda entry identifier." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Submit a valid agenda entry." }, { status: 400 }); }
  const validation = validateAgendaSubmission(body);
  if (!validation.success) return Response.json({ message: "Check the highlighted fields.", errors: validation.errors }, { status: 422 });
  try {
    const entry = await updateAgendaEntry(id, validation.data);
    return Response.json({ entry, message: "Agenda entry updated." });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ message: "Authentication required." }, { status: 401 });
    }
    const code = (error as { code?: string })?.code;
    if (code === "23505") return Response.json({ message: "That class number already has an agenda entry for this course." }, { status: 409 });
    console.error("Classwise agenda update failed", error);
    return Response.json({ message: "Agenda entry could not be saved." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isQuestionId(id)) return Response.json({ message: "Invalid agenda entry identifier." }, { status: 400 });
  try {
    await deleteAgendaEntry(id);
    return Response.json({ message: "Agenda entry deleted." });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ message: "Authentication required." }, { status: 401 });
    }
    console.error("Classwise agenda delete failed", error);
    return Response.json({ message: "Agenda entry could not be deleted." }, { status: 500 });
  }
}
