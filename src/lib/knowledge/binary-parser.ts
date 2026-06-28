import "server-only";

import { randomUUID } from "node:crypto";
import path from "node:path";

import JSZip from "jszip";

import { parseKnowledgeFile } from "@/lib/knowledge/file-parser";
import type { ParsedKnowledgeEntry } from "@/lib/knowledge/parser";
import { normalizeQuestionText } from "@/lib/questions/similarity";

export type ExtractedAsset = { id: string; originalPath: string; mimeType: string; data: Uint8Array };
export type ParsedKnowledgeBundle = { title: string; entries: ParsedKnowledgeEntry[]; assets: ExtractedAsset[]; warnings: string[] };

const textExtensions = [".html", ".htm", ".py", ".ipynb", ".md", ".txt"];
const supportedExtensions = [...textExtensions, ".pdf", ".pptx"];
const assetExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const mimeByExtension: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function decodeXml(value: string) { return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&apos;", "'"); }
function cleanPath(value: string) { return value.replaceAll("\\", "/").replace(/^\.\//, ""); }
function safeArchivePath(value: string) { const clean = cleanPath(value); return clean && !clean.startsWith("/") && !clean.split("/").includes("..") && !/^[A-Za-z]:/.test(clean); }

export function basicFileScan(filename: string, bytes: Uint8Array) {
  if (bytes.byteLength === 0) throw new Error("The uploaded file is empty.");
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("Files must be 25 MB or smaller.");
  const header = new TextDecoder("latin1").decode(bytes.slice(0, 256));
  if (header.startsWith("MZ") || header.startsWith("\u007fELF") || header.includes("<script language=\"VBScript\">")) throw new Error("Executable content is not allowed.");
  const sample = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 1024 * 1024)));
  if (sample.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) throw new Error("The upload failed its malware signature check.");
  const extension = path.extname(filename).toLocaleLowerCase("en-US");
  if (![...supportedExtensions, ".zip"].includes(extension)) throw new Error("Unsupported file type.");
}

async function parsePdf(filename: string, bytes: Uint8Array): Promise<ParsedKnowledgeBundle> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
  const entries: ParsedKnowledgeEntry[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber); const content = await page.getTextContent();
    const text = content.items.flatMap((item) => "str" in item ? [item.str] : []).join(" ").replace(/\s+/g, " ").trim();
    if (text.length < 10) continue;
    const title = text.split(/[.!?]/)[0].slice(0, 100) || `Page ${pageNumber}`;
    entries.push({ section_key: `page-${pageNumber}`, title, content_html: `<article><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></article>`, content_text: text, normalized_text: normalizeQuestionText(`${title} ${text}`), sequence_number: entries.length, provenance_type: "page", provenance_label: `Page ${pageNumber}`, provenance_start: pageNumber, provenance_end: pageNumber });
  }
  if (!entries.length) throw new Error("No extractable PDF text was found. Scanned PDFs require optional OCR.");
  return { title: filename.replace(/\.pdf$/i, ""), entries, assets: [], warnings: document.numPages > entries.length ? [`${document.numPages - entries.length} page(s) contained no extractable text.`] : [] };
}

async function parsePptx(filename: string, bytes: Uint8Array): Promise<ParsedKnowledgeBundle> {
  const zip = await JSZip.loadAsync(bytes); const entries: ParsedKnowledgeEntry[] = []; const assets: ExtractedAsset[] = [];
  for (const name of Object.keys(zip.files).filter((value) => value.startsWith("ppt/media/") && !zip.files[value].dir)) {
    const extension = path.extname(name).toLocaleLowerCase("en-US"); if (!assetExtensions.has(extension)) continue;
    assets.push({ id: randomUUID(), originalPath: name, mimeType: mimeByExtension[extension], data: await zip.file(name)!.async("uint8array") });
  }
  const assetByPath = new Map(assets.map((asset) => [asset.originalPath, asset]));
  const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  for (const [index, slideName] of slideNames.entries()) {
    const xml = await zip.file(slideName)!.async("string");
    const values = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((match) => decodeXml(match[1]).trim()).filter(Boolean);
    const notesName = `ppt/notesSlides/notesSlide${index + 1}.xml`; const notesFile = zip.file(notesName);
    const notesXml = notesFile ? await notesFile.async("string") : "";
    const notes = [...notesXml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((match) => decodeXml(match[1]).trim()).filter(Boolean).join(" ");
    const title = values[0] || `Slide ${index + 1}`; const text = [...values, notes ? `Speaker notes: ${notes}` : ""].filter(Boolean).join("\n");
    const relsFile = zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`); const relsXml = relsFile ? await relsFile.async("string") : "";
    const targets = new Map([...relsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g)].map((match) => [match[1], path.posix.normalize(path.posix.join("ppt/slides", match[2]))]));
    const slideAssets = [...xml.matchAll(/r:embed="([^"]+)"/g)].flatMap((match) => { const target = targets.get(match[1]); const asset = target ? assetByPath.get(target) : null; return asset ? [asset] : []; });
    const images = [...new Map(slideAssets.map((asset) => [asset.id, asset])).values()].map((asset) => `<figure><img src="asset://${asset.id}" alt="Image from slide ${index + 1}"></figure>`).join("");
    if (text.length >= 10) entries.push({ section_key: `slide-${index + 1}`, title, content_html: `<article><h3>${escapeHtml(title)}</h3>${values.slice(1).map((value) => `<p>${escapeHtml(value)}</p>`).join("")}${images}${notes ? `<aside><strong>Speaker notes</strong><p>${escapeHtml(notes)}</p></aside>` : ""}</article>`, content_text: text, normalized_text: normalizeQuestionText(`${title} ${text}`), sequence_number: entries.length, provenance_type: "slide", provenance_label: `Slide ${index + 1}`, provenance_start: index + 1, provenance_end: index + 1 });
  }
  if (!entries.length) throw new Error("No slide text was found in this PowerPoint file.");
  return { title: filename.replace(/\.pptx$/i, ""), entries, assets, warnings: assets.length ? [`Extracted ${assets.length} safe slide image asset(s).`] : [] };
}

function rewriteHtmlAssets(source: string, filePath: string, assetByPath: Map<string, ExtractedAsset>) {
  const directory = path.posix.dirname(cleanPath(filePath));
  return source.replace(/(src|href)=(['"])([^'"#]+)\2/gi, (full, attribute: string, quote: string, reference: string) => {
    if (/^(?:https?:|data:|mailto:)/i.test(reference)) return full;
    const resolved = path.posix.normalize(path.posix.join(directory, reference)); const asset = assetByPath.get(resolved);
    return asset ? `${attribute}=${quote}asset://${asset.id}${quote}` : full;
  });
}

async function parseZip(filename: string, bytes: Uint8Array): Promise<ParsedKnowledgeBundle> {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true }); const names = Object.keys(zip.files);
  if (names.length > 250) throw new Error("ZIP bundle contains too many entries (maximum 250).");
  if (names.some((name) => !safeArchivePath(name))) throw new Error("ZIP bundle contains an unsafe path.");
  if (names.some((name) => /\.(?:zip|rar|7z|exe|dll|sh|bat|cmd|msi)$/i.test(name))) throw new Error("Nested archives and executable files are not allowed.");
  let expanded = 0; const extracted = new Map<string, Uint8Array>();
  for (const name of names) {
    const file = zip.file(name); if (!file || zip.files[name].dir) continue;
    const data = await file.async("uint8array"); expanded += data.byteLength;
    if (expanded > 60 * 1024 * 1024) throw new Error("ZIP expanded size exceeds 60 MB.");
    extracted.set(cleanPath(name), data);
  }
  const assets: ExtractedAsset[] = [];
  for (const [name, data] of extracted) { const extension = path.extname(name).toLocaleLowerCase("en-US"); if (assetExtensions.has(extension)) assets.push({ id: randomUUID(), originalPath: name, mimeType: mimeByExtension[extension], data }); }
  const assetByPath = new Map(assets.map((asset) => [asset.originalPath, asset])); const entries: ParsedKnowledgeEntry[] = []; const warnings: string[] = [];
  for (const [name, data] of extracted) {
    const extension = path.extname(name).toLocaleLowerCase("en-US"); if (!supportedExtensions.includes(extension)) continue;
    let parsed: ParsedKnowledgeBundle;
    if (extension === ".pdf") parsed = await parsePdf(name, data);
    else if (extension === ".pptx") parsed = await parsePptx(name, data);
    else {
      let source = new TextDecoder().decode(data); if (extension === ".html" || extension === ".htm") source = rewriteHtmlAssets(source, name, assetByPath);
      const result = parseKnowledgeFile(name, source); parsed = { ...result, assets: [], warnings: [] };
    }
    parsed.entries.forEach((item) => entries.push({ ...item, title: `${parsed.title} — ${item.title}`, sequence_number: entries.length })); warnings.push(...parsed.warnings);
  }
  if (!entries.length) throw new Error("ZIP bundle contains no supported teaching-material files.");
  return { title: filename.replace(/\.zip$/i, ""), entries, assets, warnings };
}

export async function parseKnowledgeBuffer(filename: string, bytes: Uint8Array): Promise<ParsedKnowledgeBundle> {
  basicFileScan(filename, bytes); const extension = path.extname(filename).toLocaleLowerCase("en-US");
  if (extension === ".pdf") return parsePdf(filename, bytes);
  if (extension === ".pptx") return parsePptx(filename, bytes);
  if (extension === ".zip") return parseZip(filename, bytes);
  const parsed = parseKnowledgeFile(filename, new TextDecoder().decode(bytes));
  return { ...parsed, assets: [], warnings: [] };
}

export const supportedUploadExtensions = [...supportedExtensions, ".zip"] as const;
