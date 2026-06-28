"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { message?: string };

export async function login(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !password || email.length > 254 || password.length > 1024) {
    return { message: "Enter a valid email address and password." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { message: "Invalid email address or password." };
    }
  } catch (error) {
    console.error("Admin login failed", error);
    return { message: "Authentication is temporarily unavailable." };
  }

  redirect("/admin/questions");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/admin/login");
}
