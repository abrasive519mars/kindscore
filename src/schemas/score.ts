import { z } from "zod";
import { LOCALE } from "@/config/constants";
import { isAppError } from "@/engine/errors";
import { validateScore } from "@/engine/scores/validateScore";
import { isFutureDate, isIsoDate, todayInTimezone } from "@/engine/time/dates";

/** Shared by the score form and its server actions (PRD §05; GAME.md §2). The range rule is the engine's. */
export const scoreInputSchema = z.object({
  score: z.unknown().transform((value, ctx) => {
    try {
      return validateScore(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: isAppError(error) ? error.userMessage : "Score must be a whole number",
      });
      return z.NEVER;
    }
  }),
  playedOn: z
    .string()
    .refine(isIsoDate, "Choose the date you played")
    .refine(
      (date) => !isFutureDate(date, todayInTimezone(new Date(), LOCALE.TIMEZONE)),
      "That date hasn't happened yet",
    ),
});

export const scoreIdSchema = z.object({ id: z.uuid() });

export type ScoreInput = z.infer<typeof scoreInputSchema>;
