"use client";

import { Button } from "@/components/ui/button";

export default function QuestionsError({ reset }: { reset: () => void }) {
  return (
    <div className="shell route-error" role="alert">
      <h1>Questions could not be loaded</h1>
      <p>The question service may be temporarily unavailable.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
