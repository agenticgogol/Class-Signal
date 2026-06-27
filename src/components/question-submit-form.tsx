"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { questionLimits } from "@/lib/questions/validation";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string; errors: Record<string, string> }
  | { status: "success" };

export function QuestionSubmitForm({ accessCode, onSubmitted }: { accessCode: string; onSubmitted?: () => void }) {
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const errors = state.status === "error" ? state.errors : {};

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const form = event.currentTarget;
    const payload = { ...Object.fromEntries(new FormData(form).entries()), access_code: accessCode };

    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        message?: string;
        errors?: Record<string, string>;
      };

      if (!response.ok) {
        setState({
          status: "error",
          message: result.message ?? "We could not submit your question.",
          errors: result.errors ?? {},
        });
        return;
      }

      form.reset();
      setState({ status: "success" });
    } catch {
      setState({
        status: "error",
        message: "Unable to reach the server. Check your connection and try again.",
        errors: {},
      });
    }
  }

  if (state.status === "success") {
    return (
      <div className="success-panel" role="status">
        <span className="success-panel__icon" aria-hidden="true">
          <CheckCircle2 size={30} />
        </span>
        <h2>Your question is in the queue.</h2>
        <p>The instructor can now review it without interrupting the lesson. You can check progress on the public board or look it up later with the same email.</p>
        <div className="success-panel__actions">
          {onSubmitted && <Button onClick={onSubmitted}>Return to board</Button>}
          <Button variant="secondary" onClick={() => setState({ status: "idle" })}>
            Ask another question
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="question-form" onSubmit={handleSubmit} noValidate aria-busy={state.status === "submitting"}>
      <div className="form-section">
        <div className="form-section__heading">
          <span>01</span>
          <div>
            <h2>About you</h2>
            <p>Your details are visible only to the instructor.</p>
          </div>
        </div>
        <div className="form-grid form-grid--three">
          <FormField
            id="student_name"
            name="student_name"
            label="Your name"
            autoComplete="name"
            maxLength={questionLimits.student_name}
            placeholder="e.g. Maya Chen"
            required
            error={errors.student_name}
          />
          <FormField
            id="student_email"
            name="student_email"
            label="Email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={questionLimits.student_email}
            placeholder="maya@example.com"
            required
            error={errors.student_email}
          />
          <FormField
            id="module_topic"
            name="module_topic"
            label="Module name"
            maxLength={questionLimits.module_topic}
            placeholder="RAG and vector search"
            required
            error={errors.module_topic}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">
          <span>02</span>
          <div>
            <h2>Your question</h2>
            <p>Include the specific concept, code, or error you want explained.</p>
          </div>
        </div>
        <div className="form-grid">
          <FormField
            id="question_text"
            name="question_text"
            label="Question"
            multiline
            rows={6}
            maxLength={questionLimits.question_text}
            placeholder="What would you like the instructor to clarify?"
            hint={`Up to ${questionLimits.question_text.toLocaleString()} characters.`}
            required
            error={errors.question_text}
          />
        </div>
      </div>

      {state.status === "error" && (
        <p className="form-alert" role="alert">{state.message}</p>
      )}

      <div className="form-actions">
        <p>By submitting, you agree that your question may appear publicly without your name or email.</p>
        <Button type="submit" disabled={state.status === "submitting"}>
          {state.status === "submitting" ? "Submitting…" : "Submit question"}
          {state.status !== "submitting" && <Send size={17} aria-hidden="true" />}
        </Button>
      </div>
    </form>
  );
}
