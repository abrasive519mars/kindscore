import { describe, expect, it } from "vitest";
import { ConflictError, RuleViolationError } from "@/engine/errors";
import {
  findEntryOnDate,
  isBackdatedBeyondWindow,
  previewAddScore,
  selectRetainedScores,
  sortNewestFirst,
  type ScoreEntry,
} from "@/engine/scores/latestFive";

function entry(id: string, playedOn: string, score = 30, createdAt = `${playedOn}T10:00:00Z`): ScoreEntry {
  return { id, score, playedOn, createdAt };
}

const five: ScoreEntry[] = [
  entry("a", "2026-09-01"),
  entry("b", "2026-09-05"),
  entry("c", "2026-09-10"),
  entry("d", "2026-09-15"),
  entry("e", "2026-09-20"),
];

describe("sortNewestFirst", () => {
  it("orders by date played, most recent first, regardless of insertion order", () => {
    const shuffled = [five[2], five[4], five[0], five[3], five[1]];
    expect(sortNewestFirst(shuffled).map((e) => e.id)).toEqual(["e", "d", "c", "b", "a"]);
  });

  it("breaks a date tie by creation time", () => {
    const first = entry("x", "2026-09-12", 30, "2026-09-12T09:00:00Z");
    const later = entry("y", "2026-09-12", 31, "2026-09-12T11:00:00Z");
    expect(sortNewestFirst([first, later]).map((e) => e.id)).toEqual(["y", "x"]);
  });

  it("does not mutate the input", () => {
    const input = [five[1], five[0]];
    sortNewestFirst(input);
    expect(input.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("selectRetainedScores", () => {
  it("keeps everything when fewer than five", () => {
    const { retained, evicted } = selectRetainedScores(five.slice(0, 4));
    expect(retained).toHaveLength(4);
    expect(evicted).toEqual([]);
  });

  it("evicts the oldest-dated round when a sixth arrives, even if it was entered last", () => {
    const sixth = entry("f", "2026-09-25");
    const { retained, evicted } = selectRetainedScores([sixth, ...five]);
    expect(retained.map((e) => e.id)).toEqual(["f", "e", "d", "c", "b"]);
    expect(evicted.map((e) => e.id)).toEqual(["a"]);
  });
});

describe("findEntryOnDate", () => {
  it("finds an existing round and returns undefined otherwise", () => {
    expect(findEntryOnDate(five, "2026-09-10")?.id).toBe("c");
    expect(findEntryOnDate(five, "2026-09-11")).toBeUndefined();
  });
});

describe("isBackdatedBeyondWindow", () => {
  it("is false while the window is not full", () => {
    expect(isBackdatedBeyondWindow("2020-01-01", five.slice(0, 4))).toBe(false);
  });

  it("is true only when older than every kept round", () => {
    expect(isBackdatedBeyondWindow("2026-08-31", five)).toBe(true);
    expect(isBackdatedBeyondWindow("2026-09-01", five)).toBe(false); // equal to oldest, not older
    expect(isBackdatedBeyondWindow("2026-09-12", five)).toBe(false);
  });
});

describe("previewAddScore", () => {
  it("rejects a second round on the same date with the date in the message", () => {
    expect(() => previewAddScore(five, entry("z", "2026-09-10"))).toThrow(ConflictError);
    expect(() => previewAddScore(five, entry("z", "2026-09-10"))).toThrow(/10 Sept/);
  });

  it("rejects a round older than the five kept", () => {
    expect(() => previewAddScore(five, entry("z", "2026-08-20"))).toThrow(RuleViolationError);
  });

  it("accepts a backdated round inside the window and evicts the true oldest", () => {
    const { retained, evicted } = previewAddScore(five, entry("z", "2026-09-12"));
    expect(retained.map((e) => e.id)).toEqual(["e", "d", "z", "c", "b"]);
    expect(evicted.map((e) => e.id)).toEqual(["a"]);
  });

  it("evicts nothing when there is room", () => {
    const { retained, evicted } = previewAddScore(five.slice(0, 3), entry("z", "2026-09-30"));
    expect(retained).toHaveLength(4);
    expect(evicted).toEqual([]);
  });
});
