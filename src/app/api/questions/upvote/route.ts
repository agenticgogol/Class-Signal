import { validateUpvoteSubmission } from "@/lib/questions/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { studentAccessErrorResponse, validateStudentAccess } from "@/lib/public-settings/access";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Submit a valid JSON request." }, { status: 400 });
  }

  const validation = validateUpvoteSubmission(body);
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
    await validateStudentAccess(accessCode, "voting");
    const supabase = createAdminClient();
    const { question_id, voter_email } = validation.data;
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("id")
      .eq("id", question_id)
      .eq("is_public", true)
      .maybeSingle();

    if (questionError) {
      console.error("Public question lookup failed", {
        code: questionError.code,
        message: questionError.message,
      });
      return Response.json({ message: "We could not record this upvote." }, { status: 500 });
    }
    if (!question) {
      return Response.json({ message: "That public question was not found." }, { status: 404 });
    }

    const { error } = await supabase.from("question_votes").insert({
      question_id,
      voter_email: voter_email.toLocaleLowerCase("en-US"),
    });

    if (error?.code === "23505") {
      return Response.json(
        { message: "This email has already upvoted this question." },
        { status: 409 },
      );
    }
    if (error) {
      console.error("Question upvote failed", { code: error.code, message: error.message });
      return Response.json({ message: "We could not record this upvote." }, { status: 500 });
    }

    return Response.json({ message: "Upvote recorded." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "StudentAccessError") {
      return studentAccessErrorResponse(error);
    }
    console.error("Question upvote request failed", error);
    return Response.json({ message: "Upvoting is temporarily unavailable." }, { status: 503 });
  }
}
