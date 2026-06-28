"use client";

import { useEffect, useRef } from "react";

export function KnowledgeHtml({ html }: { html: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    async function renderDiagrams() {
      const nodes = root.current ? Array.from(root.current.querySelectorAll<HTMLElement>(".mermaid")) : [];
      if (!nodes.length) return;
      try {
        const mermaid = (await import("mermaid")).default;
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: document.documentElement.dataset.theme === "dark" ? "dark" : "neutral" });
        await mermaid.run({ nodes, suppressErrors: true });
      } catch { nodes.forEach((node) => node.classList.add("mermaid--fallback")); }
    }
    void renderDiagrams();
    return () => { cancelled = true; };
  }, [html]);
  return <div ref={root} className="knowledge-html" dangerouslySetInnerHTML={{ __html: html }} />;
}
