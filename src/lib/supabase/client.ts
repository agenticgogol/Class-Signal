import { createBrowserClient } from "@supabase/ssr";

/** Creates the Supabase client used by interactive browser components. */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Public Supabase environment variables are not configured.");
  }

  return createBrowserClient(url, anonKey);
}
