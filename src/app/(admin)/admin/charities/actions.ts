"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ValidationError } from "@/engine/errors";
import { requireAdmin } from "@/lib/auth/guards";
import { createCharityService } from "@/lib/charities";
import { runAction, type ActionResult } from "@/lib/errors/action-result";

const charitySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Give the charity a name.").max(120),
  tagline: z.string().trim().max(160).default(""),
  description: z.string().trim().max(5000).default(""),
  category: z.string().trim().min(2, "Give it a cause, e.g. Education.").max(40),
  city: z.string().trim().max(80).default(""),
  outcomeLine: z.string().trim().max(120).default(""),
  websiteUrl: z.union([z.literal(""), z.url("That doesn't look like a URL.")]).default(""),
});
const idSchema = z.object({ id: z.uuid() });
const mediaSchema = z.object({
  id: z.uuid(),
  role: z.enum(["cover", "gallery"]),
  alt: z.string().trim().max(200).default(""),
});
const removeMediaSchema = z.object({ id: z.uuid(), mediaId: z.uuid() });
const eventSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid().optional(),
  title: z.string().trim().min(2, "Give the event a title.").max(120),
  description: z.string().trim().max(600).default(""),
  startsAt: z.string().min(1, "When is it?"),
  location: z.string().trim().max(160).default(""),
});
const deleteEventSchema = z.object({ id: z.uuid(), eventId: z.uuid() });

function revalidateCharities() {
  revalidatePath("/admin/charities", "layout");
  revalidatePath("/charities", "layout");
  revalidatePath("/", "layout");
}

/** PRD §11.03 — every admin change to a charity, its media and its events. */

export async function saveCharity(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireAdmin();
    const { id, websiteUrl, ...input } = charitySchema.parse(Object.fromEntries(formData));
    const saved = await (
      await createCharityService()
    ).saveCharity({ ...input, websiteUrl: websiteUrl || null }, id);
    revalidateCharities();
    return { id: saved.id, created: !id };
  });
  if (result.ok && result.data.created) redirect(`/admin/charities/${result.data.id}`);
  return result;
}

export async function setFeatured(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { id } = idSchema.parse(Object.fromEntries(formData));
    await (await createCharityService()).setFeatured(id);
    revalidateCharities();
  });
}

export async function setVisibility(
  _prev: ActionResult<{ subscribers: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ subscribers: number }>> {
  return runAction(async () => {
    await requireAdmin();
    const { id } = idSchema.parse(Object.fromEntries(formData));
    const service = await createCharityService();
    const hide = formData.get("visible") === "false";
    const subscribers = hide ? await service.deactivate(id) : (await service.reactivate(id), 0);
    revalidateCharities();
    return { subscribers };
  });
}

export async function uploadMedia(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { id, role, alt } = mediaSchema.parse(Object.fromEntries(formData));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new ValidationError("Choose an image.", "file");
    await (await createCharityService()).uploadMedia(id, role, file, alt);
    revalidateCharities();
  });
}

export async function removeMedia(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { id, mediaId } = removeMediaSchema.parse(Object.fromEntries(formData));
    await (await createCharityService()).removeMedia(id, mediaId);
    revalidateCharities();
  });
}

export async function saveEvent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { id, eventId, startsAt, ...rest } = eventSchema.parse(Object.fromEntries(formData));
    // The form gives local (IST) wall time; store the instant.
    const instant = new Date(`${startsAt}:00+05:30`);
    if (Number.isNaN(instant.getTime())) throw new ValidationError("When is it?", "startsAt");
    await (
      await createCharityService()
    ).saveEvent({ ...rest, id: eventId, charityId: id, startsAt: instant.toISOString() });
    revalidateCharities();
  });
}

export async function deleteEvent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const { eventId } = deleteEventSchema.parse(Object.fromEntries(formData));
    await (await createCharityService()).deleteEvent(eventId);
    revalidateCharities();
  });
}
