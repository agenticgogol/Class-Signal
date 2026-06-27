import { validatePublicQuestionFilters } from "@/lib/questions/filters";
import { getPublicQuestions } from "@/lib/questions/public";
import { accessCodeFromRequest, studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";

export async function GET(request: Request) {
  try {
    await validateStudentAccess(accessCodeFromRequest(request), "board");
  } catch (error) {
    return studentAccessErrorResponse(error);
  }
  const url = new URL(request.url);
  const validation = validatePublicQuestionFilters(Object.fromEntries(url.searchParams));

  if (!validation.success) {
    return Response.json(
      { message: "Check the supplied filters.", errors: validation.errors },
      { status: 400 },
    );
  }

  try {
    const questions = await getPublicQuestions(validation.data);
    return Response.json(
      { questions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { message: "Public questions are temporarily unavailable." },
      { status: 503 },
    );
  }
}
