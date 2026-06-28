import "server-only";

import { parseKnowledgeHtml, type ParsedKnowledgeEntry } from "@/lib/knowledge/parser";
import { normalizeQuestionText } from "@/lib/questions/similarity";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function entry(title: string, html: string, text: string, sequence_number: number, section_key: string, provenance?: Pick<ParsedKnowledgeEntry, "provenance_type" | "provenance_label" | "provenance_start" | "provenance_end">): ParsedKnowledgeEntry | null {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (cleanText.length < 10) return null;
  return {
    title: title.trim().slice(0, 500),
    section_key,
    content_html: html.slice(0, 100_000),
    content_text: cleanText.slice(0, 100_000),
    normalized_text: normalizeQuestionText(`${title} ${cleanText}`),
    sequence_number,
    ...provenance,
  };
}

function sourceValue(source: unknown) {
  return Array.isArray(source) ? source.filter((line): line is string => typeof line === "string").join("") : typeof source === "string" ? source : "";
}

function pythonTitle(source: string, fallback: string) {
  const symbol = source.match(/^\s*(?:async\s+)?(class|def)\s+([A-Za-z_]\w*)/m);
  return symbol ? `${symbol[1] === "class" ? "Class" : "Function"}: ${symbol[2]}` : fallback;
}

function parsePython(filename: string, source: string) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const starts = lines.flatMap((line, index) => /^(?:async\s+)?(?:class|def)\s+[A-Za-z_]\w*/.test(line) ? [index] : []);
  const boundaries = starts.length ? [...new Set([0, ...starts, lines.length])] : [0, lines.length];
  const entries: ParsedKnowledgeEntry[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const chunk = lines.slice(boundaries[index], boundaries[index + 1]).join("\n").trim();
    if (!chunk) continue;
    const title = boundaries[index] === 0 && starts[0] !== 0 ? `${filename} — module overview` : pythonTitle(chunk, `${filename} — code ${index + 1}`);
    const start = boundaries[index] + 1; const end = boundaries[index + 1];
    const parsed = entry(title, `<pre><code class="language-python">${escapeHtml(chunk)}</code></pre>`, chunk, entries.length, `code-${entries.length + 1}`, { provenance_type: "line", provenance_label: `Lines ${start}–${end}`, provenance_start: start, provenance_end: end });
    if (parsed) entries.push(parsed);
  }
  return { title: filename.replace(/\.py$/i, ""), entries };
}

function markdownHtml(source: string) {
  return source.split(/\n{2,}/).map((block) => {
    const heading = block.match(/^#{1,6}\s+([^\n]+)/);
    if (heading) {
      const remainder = block.slice(heading[0].length).trim();
      return `<h3>${escapeHtml(heading[1].trim())}</h3>${remainder ? `<p>${escapeHtml(remainder).replaceAll("\n", "<br>")}</p>` : ""}`;
    }
    return `<p>${escapeHtml(block.trim()).replaceAll("\n", "<br>")}</p>`;
  }).join("");
}

function parseNotebook(filename: string, source: string) {
  let notebook: { cells?: Array<{ cell_type?: unknown; source?: unknown }>; metadata?: { kernelspec?: { display_name?: unknown } } };
  try { notebook = JSON.parse(source) as typeof notebook; } catch { throw new Error("The notebook is not valid JSON."); }
  if (!Array.isArray(notebook.cells)) throw new Error("The notebook does not contain a cells array.");
  const entries: ParsedKnowledgeEntry[] = [];
  notebook.cells.forEach((cell, cellIndex) => {
    const value = sourceValue(cell.source).trim();
    if (!value) return;
    const isCode = cell.cell_type === "code";
    const firstHeading = value.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim();
    const title = isCode ? pythonTitle(value, `Code cell ${cellIndex + 1}`) : firstHeading ?? `Notebook note ${cellIndex + 1}`;
    const html = isCode ? `<pre><code class="language-python">${escapeHtml(value)}</code></pre>` : markdownHtml(value);
    const parsed = entry(title, html, value, entries.length, `cell-${cellIndex + 1}`, { provenance_type: "cell", provenance_label: `Cell ${cellIndex + 1}`, provenance_start: cellIndex + 1, provenance_end: cellIndex + 1 });
    if (parsed) entries.push(parsed);
  });
  const notebookName = filename.replace(/\.ipynb$/i, "");
  return { title: notebookName, entries };
}

function parseText(filename: string, source: string) {
  const parts = source.split(/(?=^#{1,3}\s+)/m).filter((part) => part.trim());
  const entries = parts.flatMap((part, index) => {
    const title = part.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim() ?? `${filename} — section ${index + 1}`;
    const parsed = entry(title, markdownHtml(part), part, index, `section-${index + 1}`, { provenance_type: "section", provenance_label: `Section ${index + 1}`, provenance_start: index + 1, provenance_end: index + 1 });
    return parsed ? [parsed] : [];
  });
  return { title: filename.replace(/\.(?:md|txt)$/i, ""), entries };
}

export const supportedKnowledgeExtensions = [".html", ".htm", ".py", ".ipynb", ".md", ".txt"] as const;

export function parseKnowledgeFile(filename: string, source: string) {
  const lower = filename.toLocaleLowerCase("en-US");
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return parseKnowledgeHtml(source);
  if (lower.endsWith(".py")) return parsePython(filename, source);
  if (lower.endsWith(".ipynb")) return parseNotebook(filename, source);
  if (lower.endsWith(".md") || lower.endsWith(".txt")) return parseText(filename, source);
  throw new Error("Unsupported file type. Upload HTML, Python, Jupyter Notebook, Markdown or text.");
}

export function isCodeKnowledgeFile(filename: string) {
  const lower = filename.toLocaleLowerCase("en-US");
  return lower.endsWith(".py") || lower.endsWith(".ipynb");
}
