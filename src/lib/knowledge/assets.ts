import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function resolveKnowledgeAssetUrls(html: string) {
  const ids = [...new Set([...html.matchAll(/asset:\/\/([0-9a-f-]{36})/gi)].map((match) => match[1]))];
  if (!ids.length) return html;
  const supabase = createAdminClient(); const { data } = await supabase.from("knowledge_assets").select("id, storage_path").in("id", ids);
  let resolved = html;
  for (const asset of data ?? []) {
    const { data: signed } = await supabase.storage.from("knowledge-assets").createSignedUrl(asset.storage_path, 3600);
    if (signed?.signedUrl) resolved = resolved.replaceAll(`asset://${asset.id}`, signed.signedUrl);
  }
  return resolved;
}
