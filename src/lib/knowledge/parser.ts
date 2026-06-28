import "server-only";

import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

import { normalizeQuestionText } from "@/lib/questions/similarity";

export type ParsedKnowledgeEntry = {
  section_key: string | null;
  title: string;
  content_html: string;
  content_text: string;
  normalized_text: string;
  sequence_number: number;
  provenance_type?: "section" | "page" | "slide" | "cell" | "line";
  provenance_label?: string;
  provenance_start?: number;
  provenance_end?: number;
};

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ["p", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "strong", "em", "code", "pre", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "a", "br", "div", "span", "details", "summary", "img", "svg", "g", "defs", "linearGradient", "stop", "line", "polygon", "polyline", "circle", "ellipse", "rect", "path", "text"],
  allowedAttributes: {
    "*": ["class", "id", "width", "height", "viewBox", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "font-family", "font-size", "font-weight", "text-anchor", "transform", "offset", "stop-color", "stop-opacity", "role", "aria-label"],
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    details: ["open", "class"],
  },
  allowedSchemes: ["http", "https", "mailto", "data", "asset"],
  allowedSchemesByTag: { img: ["http", "https", "data", "asset"] },
  parser: { lowerCaseAttributeNames: false, lowerCaseTags: false },
  transformTags: {
    a: (_tagName, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
    img: (_tagName, attribs) => ({ tagName: "img", attribs: { ...attribs, loading: "lazy" } }),
  },
};

function cleanTitle(value: string) {
  return value
    .replace(/^\s*§\s*[A-Z0-9.]+\s*(?:[·:—-]\s*)?/i, "")
    .replace(/^\s*(?:\d+(?:\.\d+)?|[A-Z])\s*[·:—-]\s*/i, "")
    .replace(/\s+/g, " ").trim().slice(0, 500);
}

function makeEntry(title: string, html: string, sectionKey: string | null): ParsedKnowledgeEntry | null {
  const contentHtml = sanitizeHtml(html, sanitizeOptions).trim().slice(0, 100_000);
  const text = cheerio.load(`<div>${contentHtml}</div>`)("div").text().replace(/\s+/g, " ").trim().slice(0, 100_000);
  const cleanedTitle = cleanTitle(title);
  if (!cleanedTitle || text.length < 20) return null;
  return {
    section_key: sectionKey,
    title: cleanedTitle,
    content_html: contentHtml,
    content_text: text,
    normalized_text: normalizeQuestionText(`${cleanedTitle} ${text}`),
    sequence_number: 0,
  };
}

export function parseKnowledgeHtml(source: string) {
  const $ = cheerio.load(source);
  const documentTitle = cleanTitle($("title").text() || $("h1").first().text() || "Uploaded knowledge");
  $("script, style, iframe, object, embed, form, #ai-copyright-block").remove();
  const entries: ParsedKnowledgeEntry[] = [];

  const navigation = $(".qnav a[href^='#']").length ? $(".qnav a[href^='#']") : $(".sb a[href^='#'], aside a[href^='#']");
  const usedTargets = new Set<string>();
  navigation.each((_index, link) => {
    const targetId = ($(link).attr("href") ?? "").slice(1).trim();
    if (!targetId || usedTargets.has(targetId) || !/^[A-Za-z][\w:.-]*$/.test(targetId)) return;
    const target = $(`[id="${targetId}"]`).first();
    if (!target.length) return;
    const body = target.find(".body").first();
    const content = body.length ? body.html() : target.html();
    const entry = makeEntry($(link).text(), content ?? "", targetId);
    if (entry) { entries.push(entry); usedTargets.add(targetId); }
  });

  if (entries.length === 0) $(".sec > details, main > details, body > details").each((index, element) => {
    const details = $(element);
    const sectionTitle = cleanTitle(details.find("summary .sum-title").first().text() || details.find("summary").first().text() || `Section ${index + 1}`);
    const sectionKey = details.closest("[id]").attr("id") ?? `section-${index + 1}`;
    const body = details.find(".body").first();
    if (!body.length) return;

    const glossaryItems = body.find(".gitem");
    if (glossaryItems.length) {
      glossaryItems.each((_itemIndex, item) => {
        const title = $(item).find(".gterm").first().text();
        const definition = $(item).find(".gdef").first().html() ?? "";
        const entry = makeEntry(title, `<p>${definition}</p>`, sectionKey);
        if (entry) entries.push(entry);
      });
      return;
    }

    const headings = body.children("h3");
    if (!headings.length) {
      const entry = makeEntry(sectionTitle, body.html() ?? "", sectionKey);
      if (entry) entries.push(entry);
      return;
    }

    headings.each((_headingIndex, heading) => {
      const title = `${sectionTitle}: ${$(heading).text()}`;
      const container = $("<div></div>");
      let sibling = $(heading).next();
      while (sibling.length && sibling[0].tagName !== "h3") {
        container.append(sibling.clone());
        sibling = sibling.next();
      }
      const entry = makeEntry(title, container.html() ?? "", sectionKey);
      if (entry) entries.push(entry);
    });
  });

  if (entries.length === 0) {
    const root = $("main").first().length ? $("main").first() : $("body").first();
    const headings = root.find("h2, h3");
    headings.each((index, heading) => {
      const title = cleanTitle($(heading).text() || `Section ${index + 1}`);
      const level = Number(heading.tagName.slice(1));
      const container = $("<div></div>");
      let sibling = $(heading).next();
      while (sibling.length) {
        const siblingTag = sibling[0].tagName?.toLocaleLowerCase("en-US") ?? "";
        if (/^h[1-6]$/.test(siblingTag) && Number(siblingTag.slice(1)) <= level) break;
        container.append(sibling.clone());
        sibling = sibling.next();
      }
      const entry = makeEntry(title, container.html() ?? "", `section-${index + 1}`);
      if (entry) entries.push(entry);
    });
    if (entries.length === 0) {
      const entry = makeEntry($("h1").first().text() || $("title").text() || "Course knowledge", root.html() ?? "", "section-1");
      if (entry) entries.push(entry);
    }
  }

  return { title: documentTitle, entries: entries.slice(0, 500).map((entry, sequence_number) => ({ ...entry, sequence_number })) };
}

export function prepareManualKnowledge(title: string, value: string) {
  const safeText = sanitizeHtml(value, { allowedTags: [] });
  return makeEntry(title, `<p>${safeText}</p>`, null);
}
