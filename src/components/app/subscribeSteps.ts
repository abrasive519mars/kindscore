import type { Step } from "@/components/ui/Stepper";

/**
 * Subscribing is two steps — account + charity, then plan + Stripe (GAME.md §1). Both pages draw
 * the same line so the second step reads as a continuation, not a new task.
 */
export function subscribeSteps(current: 1 | 2): readonly Step[] {
  return [
    { label: "Account & charity", state: current === 1 ? "current" : "done" },
    { label: "Plan & payment", state: current === 2 ? "current" : "future" },
  ];
}
