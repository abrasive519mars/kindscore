import { SCORE } from "@/config/constants";
import { ValidationError } from "@/engine/errors";

/** A Stableford score is a whole number from SCORE.MIN to SCORE.MAX. */
export function validateScore(input: unknown): number {
  const value = typeof input === "string" && input.trim() !== "" ? Number(input) : input;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ValidationError("Score must be a whole number", "score");
  }
  if (value < SCORE.MIN || value > SCORE.MAX) {
    throw new ValidationError(`Score must be between ${SCORE.MIN} and ${SCORE.MAX}`, "score");
  }
  return value;
}
