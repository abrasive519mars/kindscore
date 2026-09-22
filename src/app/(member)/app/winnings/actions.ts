"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ValidationError } from "@/engine/errors";
import { PROOF_FILE_MESSAGE } from "@/engine/verification/proofFile";
import { requireUser } from "@/lib/auth/guards";
import { runAction, type ActionResult } from "@/lib/errors/action-result";
import { createClaimPayoutService } from "@/lib/payouts";
import { createWinnerService } from "@/lib/winners";

const idSchema = z.object({ verificationId: z.uuid() });

/**
 * A winner uploads their screenshot. requireUser, not requireActiveSubscriber: a member whose
 * subscription lapsed after winning is still owed the prize (GAME.md §8 decision).
 */
export async function submitProof(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId } = await requireUser();
    const { verificationId } = idSchema.parse({ verificationId: formData.get("verificationId") });
    const file = formData.get("proof");
    if (!(file instanceof File) || file.size === 0)
      throw new ValidationError(PROOF_FILE_MESSAGE, "proof");
    await (await createWinnerService()).submitProof(userId, verificationId, file);
    revalidatePath("/app", "layout");
    revalidatePath("/admin/winners", "layout");
  });
}

/** The winner claims an approved prize: credited to their Stripe customer, recorded as paid. */
export async function claimPayout(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId } = await requireUser();
    const { verificationId } = idSchema.parse({ verificationId: formData.get("verificationId") });
    await (await createClaimPayoutService()).claim(userId, verificationId);
    revalidatePath("/app", "layout");
    revalidatePath("/admin/winners", "layout");
    revalidatePath("/admin");
  });
}
