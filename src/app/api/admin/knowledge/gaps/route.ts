import { refreshKnowledgeGaps } from "@/lib/knowledge/gaps";

export async function POST() {
  try {
    const result = await refreshKnowledgeGaps();
    return Response.json({ ...result, message: `${result.gaps.length} knowledge gap${result.gaps.length === 1 ? "" : "s"} analyzed.` }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ message: code === "AUTH_REQUIRED" ? "Authentication required." : "Knowledge gaps could not be refreshed." }, { status: code === "AUTH_REQUIRED" ? 401 : 500 });
  }
}
