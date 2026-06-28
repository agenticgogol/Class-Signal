import "server-only";

export async function createKnowledgeEmbeddings(texts: string[]) {
  if (!texts.length) return [];
  const apiKey = process.env.OPENAI_EMBEDDING_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small", input: texts, dimensions: 1536 }), signal: AbortSignal.timeout(60_000) });
  if (!response.ok) return null;
  const payload = await response.json() as { data?: Array<{ index: number; embedding: number[] }> };
  if (!payload.data || payload.data.length !== texts.length) return null;
  return [...payload.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
}
