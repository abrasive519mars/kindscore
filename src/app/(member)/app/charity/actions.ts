"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createMemberCharityService } from "@/lib/charities";
import { runAction, type ActionResult } from "@/lib/errors/action-result";

const choiceSchema = z.object({
  charityId: z.uuid(),
  charityBps: z.coerce.number().int(),
});

/** PRD §08.1: the member raises their share or moves to another charity. Next payment onwards. */
export async function updateCharityChoice(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId } = await requireUser();
    const { charityId, charityBps } = choiceSchema.parse(Object.fromEntries(formData));
    await (await createMemberCharityService()).updateChoice(userId, charityId, charityBps);
    revalidatePath("/app", "layout");
    revalidatePath("/charities", "layout");
  });
}
