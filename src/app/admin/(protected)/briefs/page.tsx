import type { Metadata } from "next";

import { AdminTeachingBriefs } from "@/components/admin-teaching-briefs";
import { getBriefWorkspace } from "@/lib/briefs/teaching";

export const metadata: Metadata = { title: "Teaching briefs" };

export default async function TeachingBriefsPage() {
  const workspace = await getBriefWorkspace();
  return <section className="admin-page"><AdminTeachingBriefs {...workspace} /></section>;
}
