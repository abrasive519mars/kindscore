import { z } from "zod";
import { LOCALE, SCORE } from "@/config/constants";
import { isFutureDate, isIsoDate, todayInTimezone } from "@/engine/time/dates";

/** Shared by the score form and its server actions (PRD §05; GAME.md §2). */
export const scoreInputSchema = z.object({
  score: z.coerce
    .number({ error: "Score must be a whole number" })
    .int("Score must be a whole number")
    .min(SCORE.MIN, `Score must be between ${SCORE.MIN} and ${SCORE.MAX}`)
    .max(SCORE.MAX, `Score must be between ${SCORE.MIN} and ${SCORE.MAX}`),
  playedOn: z
    .string()
    .refine(isIsoDate, "Choose the date you played")
    .refine((date) => !isFutureDate(date, todayInTimezone(new Date(), LOCALE.TIMEZONE)), "That date hasn't happened yet"),
});

export const scoreIdSchema = z.object({ id: z.uuid() });

export type ScoreInput = z.infer<typeof scoreInputSchema>;
