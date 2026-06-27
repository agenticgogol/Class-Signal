const stopWords = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "but", "by", "can", "could",
  "do", "does", "for", "from", "had", "has", "have", "how", "i", "if", "in", "into",
  "is", "it", "its", "may", "my", "of", "on", "or", "our", "should", "so", "that",
  "the", "their", "then", "there", "these", "they", "this", "to", "was", "we", "were",
  "what", "when", "where", "which", "who", "why", "will", "with", "would", "you", "your",
]);

export function normalizeQuestionText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function questionTokens(value: string) {
  const normalized = normalizeQuestionText(value);
  if (!normalized) return new Set<string>();
  return new Set(normalized.split(/\s+/).filter((token) => token.length > 1 && !stopWords.has(token)));
}

export function jaccardSimilarity(left: string, right: string) {
  const leftTokens = questionTokens(left);
  const rightTokens = questionTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / (leftTokens.size + rightTokens.size - intersection);
}
