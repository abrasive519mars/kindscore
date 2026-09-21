"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rupeesToPaise } from "@/engine/charity/donation";
import { requireUser } from "@/lib/auth/guards";
import { createMemberCharityService } from "@/lib/charities";
import { createDonationService } from "@/lib/donations";
import { runAction, type ActionResult } from "@/lib/errors/action-result";

const donationSchema = z.object({
  charityId: z.uuid(),
  rupees: z.string(),
  returnTo: z.string().regex(/^\/[a-z0-9/-]*$/, "Bad return path"),
});
const chooseSchema = z.object({ charityId: z.uuid() });

/** Donate once (PRD §08.1). Signed-in members only — the ledger needs to know who gave. */
export async function startDonation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const access = await requireUser();
    const input = donationSchema.parse(Object.fromEntries(formData));
    return (await createDonationService()).start({
      userId: access.userId,
      email: access.profile.email,
      charityId: input.charityId,
      amountPaise: rupeesToPaise(input.rupees),
      returnPath: `${input.returnTo}?session_id={CHECKOUT_SESSION_ID}`,
    });
  });
  if (!result.ok) return result;
  redirect(result.data.url);
}

/** "Choose this charity" from a profile page: keeps the member's current percentage. */
export async function chooseCharity(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const access = await requireUser();
    const { charityId } = chooseSchema.parse(Object.fromEntries(formData));
    await (
      await createMemberCharityService()
    ).updateChoice(access.userId, charityId, access.profile.charity_bps);
    revalidatePath("/app", "layout");
    revalidatePath("/charities", "layout");
  });
}
