import { generateTeachingBrief, getBriefWorkspace } from "@/lib/briefs/teaching";

export async function GET() {
  try { return Response.json(await getBriefWorkspace(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ message: "Teaching briefs could not be loaded." }, { status: 500 }); }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Submit valid JSON." }, { status: 400 }); }
  if (typeof body !== "object" || body === null) return Response.json({ message: "Select a class session." }, { status: 422 });
  const values = body as Record<string, unknown>;
  const courseName = typeof values.course_name === "string" ? values.course_name.trim() : "";
  const classDate = typeof values.class_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(values.class_date) ? values.class_date : "";
  const classNumber = typeof values.class_number === "string" ? values.class_number.trim() || null : null;
  if (!courseName || !classDate) return Response.json({ message: "Course and class date are required." }, { status: 422 });
  try {
    const brief = await generateTeachingBrief({ course_name: courseName, class_date: classDate, class_number: classNumber });
    return Response.json({ brief, message: `Brief version ${brief.version_number} generated.` }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ message: code === "SESSION_EMPTY" ? "No questions exist for that class session." : code === "BRIEF_SAVE_FAILED" ? "Apply the Phase 6 migration before generating briefs." : "Teaching brief generation failed." }, { status: code === "SESSION_EMPTY" ? 422 : 500 });
  }
}
