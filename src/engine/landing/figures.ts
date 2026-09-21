import type { Paise } from "@/engine/money/paise";

export interface ProofFigure {
  readonly label: string;
  readonly kind: "money" | "count";
  readonly value: number;
  readonly accent: "saffron" | "pool";
}

export interface ProofInput {
  readonly charityTotalPaise: Paise;
  readonly jackpotPaise: Paise;
  readonly activeMembers: number;
}

/**
 * DESIGN.md §3 step 2 and §10: real figures only, and a counter must never render "0" — a zero is
 * left out, and the whole strip disappears when there is nothing honest to show.
 */
export function proofFigures(input: ProofInput): ProofFigure[] {
  const figures: ProofFigure[] = [];
  if (input.charityTotalPaise > 0) {
    figures.push({
      label: "given to charities",
      kind: "money",
      value: input.charityTotalPaise,
      accent: "saffron",
    });
  }
  if (input.jackpotPaise > 0) {
    figures.push({
      label: "jackpot — rolls over until won",
      kind: "money",
      value: input.jackpotPaise,
      accent: "pool",
    });
  }
  if (input.activeMembers > 0) {
    figures.push({
      label: input.activeMembers === 1 ? "golfer playing" : "golfers playing",
      kind: "count",
      value: input.activeMembers,
      accent: "saffron",
    });
  }
  return figures;
}
