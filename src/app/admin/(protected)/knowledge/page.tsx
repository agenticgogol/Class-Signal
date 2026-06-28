import type { Metadata } from "next";

import { AdminKnowledgeManager } from "@/components/admin-knowledge-manager";
import { getKnowledgeDocuments } from "@/lib/knowledge/admin";
import { getStoredKnowledgeGaps } from "@/lib/knowledge/gaps";

export const metadata: Metadata = { title: "Course Library" };

export default async function KnowledgePage() {
  const [documents, gapResult] = await Promise.all([
    getKnowledgeDocuments(), getStoredKnowledgeGaps(),
  ]);
  return <section className="admin-page"><AdminKnowledgeManager initialDocuments={documents} initialGaps={gapResult.gaps} migrationRequired={gapResult.migrationRequired} /></section>;
}
