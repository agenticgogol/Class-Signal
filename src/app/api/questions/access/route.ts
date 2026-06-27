import {
  studentAccessErrorResponse,
  toPublicAccessInfo,
  validateStudentAccess,
} from "@/lib/public-settings/access";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Submit a valid JSON request." }, { status: 400 });
  }
  const accessCode = typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>).access_code
    : undefined;
  try {
    const settings = await validateStudentAccess(accessCode, "board");
    return Response.json(
      { access: toPublicAccessInfo(settings) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return studentAccessErrorResponse(error);
  }
}
