import { getQuestionsByStudentEmail } from "@/lib/questions/mine";
import { validateEmailLookup } from "@/lib/questions/validation";
import { studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Submit a valid JSON request." }, { status: 400 });
  }

  const validation = validateEmailLookup(body);
  if (!validation.success) {
    return Response.json(
      { message: "Enter a valid email address.", errors: validation.errors },
      { status: 422 },
    );
  }

  try {
    const accessCode = typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).access_code
      : undefined;
    await validateStudentAccess(accessCode, "board");
    const questions = await getQuestionsByStudentEmail(validation.data.student_email);
    return Response.json(
      { questions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "StudentAccessError") {
      return studentAccessErrorResponse(error);
    }
    return Response.json(
      { message: "Your questions are temporarily unavailable." },
      { status: 503 },
    );
  }
}
