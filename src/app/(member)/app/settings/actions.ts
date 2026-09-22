"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { runAction, type ActionResult } from "@/lib/errors/action-result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthenticationError, ExternalServiceError } from "@/engine/errors";
import { passwordChangeSchema } from "@/schemas/auth";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Tell us your name").max(80, "That name is a bit long"),
});

export async function updateProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId } = await requireUser();
    const input = profileSchema.parse(Object.fromEntries(formData));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: input.fullName })
      .eq("id", userId);
    if (error) throw new ExternalServiceError("Profile update", error);
    revalidatePath("/app", "layout");
  });
}

/** PRD §03.2 "manage profile & settings": the signed-in member sets a new password. */
export async function changePassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const input = passwordChangeSchema.parse(Object.fromEntries(formData));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw new AuthenticationError(error.message);
  });
}
