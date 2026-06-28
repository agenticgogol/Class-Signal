import QRCode from "qrcode";

import { sessionKey } from "@/lib/briefs/teaching";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ message: "Authentication required." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Submit valid JSON." }, { status: 400 }); }
  const values = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const courseName = typeof values.course_name === "string" ? values.course_name.trim() : "";
  const classDate = typeof values.class_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(values.class_date) ? values.class_date : "";
  const classNumber = typeof values.class_number === "string" ? values.class_number.trim() || null : null;
  if (!courseName || !classDate) return Response.json({ message: "Course and class date are required." }, { status: 422 });
  const key = sessionKey(courseName, classDate, classNumber);
  const { data: join, error } = await supabase.from("class_join_sessions").upsert({ session_key: key, course_name: courseName, class_date: classDate, class_number: classNumber, is_active: true, closed_at: null, created_by: auth.claims.sub }, { onConflict: "session_key" }).select("id, public_id, session_key, course_name, class_date, class_number, is_active, created_at, closed_at").single();
  if (error || !join) return Response.json({ message: "Apply the Phase 6 migration before creating a QR session." }, { status: 500 });
  const origin = new URL(request.url).origin;
  const joinUrl = `${origin}/questions?session=${join.public_id}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, { errorCorrectionLevel: "M", margin: 2, width: 420, color: { dark: "#153e2b", light: "#ffffff" } });
  return Response.json({ session: { ...join, join_url: joinUrl, qr_data_url: qrDataUrl }, message: "QR join session activated. Students must still pass the access gate." }, { status: 201 });
}
