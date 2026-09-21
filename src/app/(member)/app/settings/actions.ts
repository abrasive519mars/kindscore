"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { runAction, type ActionResult } from "@/lib/errors/action-result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExternalServiceError } from "@/engine/errors";

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
