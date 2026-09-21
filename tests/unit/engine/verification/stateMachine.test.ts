import { describe, expect, it } from "vitest";
import { RuleViolationError } from "@/engine/errors";
import {
  initialVerificationState,
  transition,
  type VerificationEvent,
  type VerificationState,
} from "@/engine/verification/stateMachine";

function run(events: VerificationEvent[], from: VerificationState = initialVerificationState()) {
  return events.reduce(transition, from);
}

describe("legal paths", () => {
  it("awaiting → submitted → approved → paid", () => {
    expect(run(["submit_proof", "approve", "mark_paid"])).toEqual({
      review: "approved",
      payout: "paid",
      resubmissions: 0,
    });
  });

  it("allows exactly one resubmission after rejection", () => {
    const afterResubmit = run(["submit_proof", "reject", "submit_proof"]);
    expect(afterResubmit).toEqual({ review: "submitted", payout: "pending", resubmissions: 1 });

    const rejectedAgain = transition(afterResubmit, "reject");
    expect(() => transition(rejectedAgain, "submit_proof")).toThrow(RuleViolationError);
  });

  it("can approve a resubmission and pay it", () => {
    expect(run(["submit_proof", "reject", "submit_proof", "approve", "mark_paid"]).payout).toBe(
      "paid",
    );
  });
});

describe("illegal transitions", () => {
  const cases: Array<[string, VerificationEvent[], VerificationEvent]> = [
    ["approve before any proof", [], "approve"],
    ["reject before any proof", [], "reject"],
    ["pay before approval", ["submit_proof"], "mark_paid"],
    ["pay a rejected claim", ["submit_proof", "reject"], "mark_paid"],
    ["reject after approval", ["submit_proof", "approve"], "reject"],
    ["submit again while under review", ["submit_proof"], "submit_proof"],
    ["submit after approval", ["submit_proof", "approve"], "submit_proof"],
    ["pay twice", ["submit_proof", "approve", "mark_paid"], "mark_paid"],
    ["reject after payment", ["submit_proof", "approve", "mark_paid"], "reject"],
  ];

  it.each(cases)("%s", (_label, path, event) => {
    const state = run(path);
    expect(() => transition(state, event)).toThrow(RuleViolationError);
  });

  it("explains which state blocked the move", () => {
    expect(() => transition(initialVerificationState(), "mark_paid")).toThrow(
      /Cannot mark paid while review is "awaiting_proof"/,
    );
  });
});

describe("immutability", () => {
  it("never mutates the input state", () => {
    const before = initialVerificationState();
    const snapshot = { ...before };
    transition(before, "submit_proof");
    expect(before).toEqual(snapshot);
  });
});
