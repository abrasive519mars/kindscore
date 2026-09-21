"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { createDrawService } from "@/lib/draws";
import { runAction, type ActionResult } from "@/lib/errors/action-result";

const simulateSchema = z.object({ drawId: z.uuid(), mode: z.enum(["random", "algorithmic"]) });
const drawIdSchema = z.object({ drawId: z.uuid() });

/** Everything the draw page can change goes through here: admin check → service → revalidate. */

function revalidateDraws() {
  revalidatePath("/admin/draws", "layout");
  revalidatePath("/admin");
  revalidatePath("/app", "layout");
  revalidatePath("/draws");
}

/** Plain form action (no useActionState on the list page): failures return to the list with the message. */
export async function openDraw(): Promise<void> {
  const result = await runAction(async () => {
    await requireAdmin();
    return (await createDrawService()).openNextDraw();
  });
  if (!result.ok) redirect(`/admin/draws?error=${encodeURIComponent(result.error.message)}`);
  revalidateDraws();
  redirect(`/admin/draws/${result.data.id}`);
}

export async function simulateDraw(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { drawId, mode } = simulateSchema.parse(Object.fromEntries(formData));
    await (await createDrawService()).simulate(drawId, mode);
    revalidateDraws();
  });
}

export async function publishDraw(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { drawId } = drawIdSchema.parse(Object.fromEntries(formData));
    await (await createDrawService()).publish(drawId);
    revalidateDraws();
  });
}
