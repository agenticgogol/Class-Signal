import "server-only";

import type { GroundingMode } from "@/lib/ai/types";

const plainLanguageInstruction = "Write in plain, non-technical language, as if explaining to someone outside the field (a \"does my mom understand this\" test) while keeping technical terms that are necessary, briefly defined.";

const externalKnowledgeInstruction = `This question was not matched to any covered class agenda or published course material, so you must answer from general/external knowledge instead of course sources.
Clearly mark the answer as drawn from general knowledge, not the course material, in an opening line.
Structure the answer with these headings, in this order: "## Summary", "## Explanation", "## Reference(s)", "## Point of view".
Under "## Reference(s)", list general, well-known sources or concepts the answer draws on (use web search results if available; otherwise name the underlying concept/standard).
Under "## Point of view", add a short, clearly-labeled opinion or practical recommendation, distinct from the factual explanation above.`;

export function answerModeInstruction(groundingMode: GroundingMode) {
  const parts = [plainLanguageInstruction];
  if (groundingMode === "course_and_web") parts.push(externalKnowledgeInstruction);
  return parts.join("\n");
}
