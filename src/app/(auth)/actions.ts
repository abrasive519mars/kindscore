"use server";

import { redirect } from "next/navigation";
import { AuthenticationError, ConflictError, ExternalServiceError } from "@/engine/errors";
import { safeNextPath } from "@/lib/auth/redirects";
import { runAction, type ActionResult } from "@/lib/errors/action-result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema } from "@/schemas/auth";

/** Server actions for signup, login and logout. Each: parse → Supabase Auth → redirect. */

export async function signUp(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const input = signupSchema.parse(Object.fromEntries(formData));
    const supabase = await createSupabaseServerClient();
    // The metadata is what handle_new_user() reads to build the profile row.
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          charity_id: input.charityId,
          charity_bps: input.charityBps,
        },
      },
    });
    if (error) throw mapSignupError(error.code, error.message);
  });
  if (!result.ok) return result;
  redirect("/app");
}

export async function logIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const result = await runAction(async () => {
    const input = loginSchema.parse(Object.fromEntries(formData));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(input);
    // Deliberately the same message for wrong password and unknown email.
    if (error) throw new AuthenticationError("Email or password is incorrect");
  });
  if (!result.ok) return result;
  redirect(next);
}

export async function logOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

function mapSignupError(code: string | undefined, message: string) {
  if (code === "user_already_exists" || /already registered/i.test(message)) {
    return new ConflictError("An account with that email already exists — try logging in");
  }
  if (code === "weak_password") return new AuthenticationError(message);
  return new ExternalServiceError("Sign-up", new Error(message));
}
