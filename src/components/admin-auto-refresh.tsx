"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

export function AdminAutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !isPending) startTransition(() => router.refresh());
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs, isPending, router]);
  return null;
}
