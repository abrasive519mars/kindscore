"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { runAction, type ActionResult } from "@/lib/errors/action-result";
import { createCheckoutService } from "@/lib/stripe/billing";

const intervalSchema = z.object({ interval: z.enum(["month", "year"]) });

/**
 * Each action: who is asking → the CheckoutService (scoped to that user) → either a redirect to
 * Stripe or a revalidated page. Failures come back as ActionResult so the form can show them;
 * redirects are re-thrown by runAction.
 */

export async function startCheckout(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const { userId } = await requireUser();
    const { interval } = intervalSchema.parse(Object.fromEntries(formData));
    return createCheckoutService().startCheckout(userId, interval);
  });
  if (!result.ok) return result;
  redirect(result.data.url);
}

export async function openBillingPortal(): Promise<ActionResult> {
  const result = await runAction(async () => {
    const { userId } = await requireUser();
    return createCheckoutService().openBillingPortal(userId);
  });
  if (!result.ok) return result;
  redirect(result.data.url);
}

export async function cancelSubscription(): Promise<ActionResult> {
  return setCancel(true);
}

export async function resumeSubscription(): Promise<ActionResult> {
  return setCancel(false);
}

async function setCancel(cancel: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const { userId } = await requireUser();
    await createCheckoutService().setCancelAtPeriodEnd(userId, cancel);
    revalidatePath("/app", "layout");
  });
}
