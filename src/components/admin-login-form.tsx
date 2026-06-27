"use client";

import { LockKeyhole, LogIn } from "lucide-react";
import { useActionState } from "react";

import { login, type LoginState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const initialState: LoginState = {};

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form className="admin-login-form" action={formAction}>
      <div className="admin-login-form__icon" aria-hidden="true"><LockKeyhole size={22} /></div>
      <div className="admin-login-form__heading">
        <h1>Welcome to ClassSignal</h1>
        <p>Sign in with your instructor account to manage questions, answers, and classroom signals.</p>
      </div>
      <label htmlFor="admin-email">Email address</label>
      <input
        id="admin-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        placeholder="instructor@example.com"
        required
        disabled={pending}
      />
      <label htmlFor="admin-password">Password</label>
      <input
        id="admin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={1024}
        required
        disabled={pending}
      />
      {state.message && <p className="admin-login-error" role="alert">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        <LogIn size={17} aria-hidden="true" /> {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
