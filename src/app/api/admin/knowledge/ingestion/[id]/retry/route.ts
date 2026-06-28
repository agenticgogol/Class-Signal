import { after } from "next/server";

import { processIngestionJob } from "@/lib/knowledge/ingestion";
import { isQuestionId } from "@/lib/questions/admin-validation";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  const { id } = await params; if (!isQuestionId(id)) return Response.json({ message: "Invalid job identifier." }, { status: 400 });
  const { data: job } = await supabase.from("ingestion_jobs").select("id, status").eq("id", id).maybeSingle();
  if (!job) return Response.json({ message: "Ingestion job not found." }, { status: 404 });
  if (job.status === "completed") return Response.json({ message: "This ingestion job is already complete." }, { status: 409 });
  if (["scanning", "extracting", "storing"].includes(job.status)) return Response.json({ message: "This ingestion job is still running." }, { status: 409 });
  await supabase.from("ingestion_jobs").update({ status: "queued", progress: 0, stage_message: "Queued for retry", error_message: null, started_at: null, completed_at: null }).eq("id", id);
  after(() => processIngestionJob(id));
  return Response.json({ message: "Ingestion retry started." }, { status: 202 });
}
