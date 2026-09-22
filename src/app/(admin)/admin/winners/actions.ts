"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { runAction, type ActionResult } from "@/lib/errors/action-result";
import { createWinnerService } from "@/lib/winners";
import { REVIEW_NOTE_MAX } from "@/services/WinnerService";

const reviewSchema = z.object({
  verificationId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z
    .string()
    .max(REVIEW_NOTE_MAX, `Keep the note under ${REVIEW_NOTE_MAX} characters.`)
    .default(""),
});

const payoutSchema = z.object({
  verificationId: z.uuid(),
  reference: z
    .string()
    .max(REVIEW_NOTE_MAX, `Keep the reference under ${REVIEW_NOTE_MAX} characters.`),
});

function revalidateWinners() {
  revalidatePath("/admin/winners", "layout");
  revalidatePath("/admin");
  revalidatePath("/app", "layout");
}

/** §11.04 escape hatch: record a payout settled outside Stripe (winners normally claim their own). */
export async function recordManualPayout(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { verificationId, reference } = payoutSchema.parse(Object.fromEntries(formData));
    await (await createWinnerService()).recordPayout(verificationId, reference);
    revalidateWinners();
  });
}

/** Admin decisions (PRD §11.04). The RPC re-checks every transition; the service adds the note rule. */
export async function reviewClaim(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { verificationId, decision, note } = reviewSchema.parse(Object.fromEntries(formData));
    await (await createWinnerService()).review(verificationId, decision === "approve", note);
    revalidateWinners();
  });
}
