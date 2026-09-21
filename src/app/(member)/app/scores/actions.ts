"use server";

import { revalidatePath } from "next/cache";
import type { ScoreEntry } from "@/engine/scores/latestFive";
import { requireActiveSubscriber } from "@/lib/auth/guards";
import { runAction, type ActionResult } from "@/lib/errors/action-result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseScoreRepository } from "@/repositories/supabase/SupabaseScoreRepository";
import { scoreIdSchema, scoreInputSchema } from "@/schemas/score";
import { ScoreService, type AddScoreResult } from "@/services/ScoreService";

/** Composition root for this feature: the one place the service meets its real repository. */
async function scoreService(): Promise<ScoreService> {
  const db = await createSupabaseServerClient();
  return new ScoreService(new SupabaseScoreRepository(db));
}

function revalidateScores() {
  revalidatePath("/app");
  revalidatePath("/app/scores");
}

export async function addScore(
  _prev: ActionResult<AddScoreResult> | null,
  formData: FormData,
): Promise<ActionResult<AddScoreResult>> {
  return runAction(async () => {
    const { userId } = await requireActiveSubscriber();
    const input = scoreInputSchema.parse(Object.fromEntries(formData));
    const result = await (await scoreService()).add(userId, input);
    revalidateScores();
    return result;
  });
}

export async function updateScore(
  _prev: ActionResult<ScoreEntry> | null,
  formData: FormData,
): Promise<ActionResult<ScoreEntry>> {
  return runAction(async () => {
    const { userId } = await requireActiveSubscriber();
    const { id } = scoreIdSchema.parse({ id: formData.get("id") });
    const input = scoreInputSchema.parse(Object.fromEntries(formData));
    const entry = await (await scoreService()).update(userId, id, input);
    revalidateScores();
    return entry;
  });
}

export async function deleteScore(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { userId } = await requireActiveSubscriber();
    const { id } = scoreIdSchema.parse({ id: formData.get("id") });
    await (await scoreService()).remove(userId, id);
    revalidateScores();
  });
}
