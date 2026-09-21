"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminUserService } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { runAction, type ActionResult } from "@/lib/errors/action-result";
import { scoreIdSchema, scoreInputSchema } from "@/schemas/score";

const userIdSchema = z.object({ userId: z.uuid() });
const profileSchema = z.object({
  userId: z.uuid(),
  fullName: z.string().trim().min(2, "Give the member a name.").max(80),
  charityId: z.uuid(),
  charityBps: z.coerce.number().int(),
});
const grantSchema = z.object({ userId: z.uuid(), interval: z.enum(["month", "year"]) });

/** PRD §11.01 — every admin change to a member. requireAdmin first; RLS and the RPC refuse anyone else anyway. */

function revalidateMember(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/app", "layout");
}

export async function updateMemberProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId: actorId } = await requireAdmin();
    const { userId, ...edit } = profileSchema.parse(Object.fromEntries(formData));
    await (await createAdminUserService()).updateProfile(actorId, userId, edit);
    revalidateMember(userId);
  });
}

export async function addMemberScore(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId: actorId } = await requireAdmin();
    const { userId } = userIdSchema.parse({ userId: formData.get("userId") });
    const input = scoreInputSchema.parse(Object.fromEntries(formData));
    await (await createAdminUserService()).addScore(actorId, userId, input);
    revalidateMember(userId);
  });
}

export async function updateMemberScore(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId: actorId } = await requireAdmin();
    const { userId } = userIdSchema.parse({ userId: formData.get("userId") });
    const { id } = scoreIdSchema.parse({ id: formData.get("id") });
    const input = scoreInputSchema.parse(Object.fromEntries(formData));
    await (await createAdminUserService()).updateScore(actorId, userId, id, input);
    revalidateMember(userId);
  });
}

export async function deleteMemberScore(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId: actorId } = await requireAdmin();
    const { userId } = userIdSchema.parse({ userId: formData.get("userId") });
    const { id } = scoreIdSchema.parse({ id: formData.get("id") });
    await (await createAdminUserService()).removeScore(actorId, userId, id);
    revalidateMember(userId);
  });
}

export async function grantMemberSubscription(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { userId, interval } = grantSchema.parse(Object.fromEntries(formData));
    await (await createAdminUserService()).grantSubscription(userId, interval);
    revalidateMember(userId);
  });
}

export async function endMemberSubscription(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { userId } = userIdSchema.parse(Object.fromEntries(formData));
    await (await createAdminUserService()).endSubscription(userId);
    revalidateMember(userId);
  });
}
