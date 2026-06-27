"use client";

import { ArrowBigUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

type UpvoteButtonProps = {
  questionId: string;
  initialCount: number;
  accessCode: string;
};

type UpvoteState =
  | { status: "idle" }
  | { status: "editing" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function UpvoteButton({ questionId, initialCount, accessCode }: UpvoteButtonProps) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [state, setState] = useState<UpvoteState>({ status: "idle" });

  async function submitUpvote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });
    const voterEmail = new FormData(event.currentTarget).get("voter_email");

    try {
      const response = await fetch("/api/questions/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, voter_email: voterEmail, access_code: accessCode }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setState({ status: "error", message: result.message ?? "Unable to record upvote." });
        return;
      }

      setCount((current) => current + 1);
      setState({ status: "success", message: "Upvote recorded." });
      router.refresh();
    } catch {
      setState({ status: "error", message: "Check your connection and try again." });
    }
  }

  if (state.status === "idle") {
    return (
      <button className="vote-trigger" type="button" onClick={() => setState({ status: "editing" })}>
        <ArrowBigUp size={18} aria-hidden="true" />
        <span>{count}</span>
        <span className="vote-trigger__label">Upvote</span>
      </button>
    );
  }

  return (
    <div className="upvote-panel" aria-live="polite">
      {state.status === "success" ? (
        <div className="upvote-success">
          <p className="upvote-message upvote-message--success" role="status">
            <ArrowBigUp size={17} aria-hidden="true" /> {count} · {state.message}
          </p>
          <button className="text-button" type="button" onClick={() => setState({ status: "idle" })}>
            Upvote another question
          </button>
        </div>
      ) : (
        <form className="upvote-form" onSubmit={submitUpvote} noValidate>
          <label htmlFor={`voter-email-${questionId}`}>Email to upvote</label>
          <div className="upvote-form__controls">
            <input
              id={`voter-email-${questionId}`}
              name="voter_email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              placeholder="you@example.com"
              required
              disabled={state.status === "submitting"}
            />
            <Button type="submit" disabled={state.status === "submitting"}>
              {state.status === "submitting" ? "Saving…" : "Upvote"}
            </Button>
            <button className="text-button" type="button" onClick={() => setState({ status: "idle" })}>
              Cancel
            </button>
          </div>
          {state.status === "error" && <p className="upvote-message" role="alert">{state.message}</p>}
        </form>
      )}
    </div>
  );
}
