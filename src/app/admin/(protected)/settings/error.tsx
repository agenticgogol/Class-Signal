"use client";

import { Button } from "@/components/ui/button";

export default function SettingsError({ reset }: { reset: () => void }) {
  return (
    <div className="admin-page route-error" role="alert">
      <h1>Settings could not be loaded</h1>
      <p>Check the database connection and try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
