import { DRAW } from "@/config/constants";
import type { DrawMode } from "@/engine/draw/generateNumbers";

/** "Random" or "Weighted by scores · 60%" — the strength only when it is not the full default. */
export function describeMode(mode: DrawMode, weightStrengthBps: number): string {
  if (mode === "random") return "Random";
  if (weightStrengthBps === DRAW.WEIGHT_STRENGTH_MAX_BPS) return "Weighted by scores";
  return `Weighted by scores · ${weightStrengthBps / 100}%`;
}
