import { describe, expect, it } from "vitest";
import { ValidationError } from "@/engine/errors";
import { validateScore } from "@/engine/scores/validateScore";

describe("validateScore", () => {
  it("accepts the boundaries", () => {
    expect(validateScore(1)).toBe(1);
    expect(validateScore(45)).toBe(45);
  });

  it("accepts numeric strings from form inputs", () => {
    expect(validateScore("33")).toBe(33);
  });

  it.each([0, 46, 1.5, -3, "abc", "", null, undefined, Number.NaN, true])("rejects %s", (input) => {
    expect(() => validateScore(input)).toThrow(ValidationError);
  });
});
