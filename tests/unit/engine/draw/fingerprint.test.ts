import { describe, expect, it } from "vitest";
import { canonicalEntries, entriesFingerprint } from "@/engine/draw/fingerprint";

const priya = { userId: "b-priya", scores: [28, 33, 31, 36, 29] };
const raj = { userId: "a-raj", scores: [30, 30, 41, 22, 35] };

describe("entriesFingerprint", () => {
  it("is stable for the same entries in any order", () => {
    expect(entriesFingerprint([priya, raj])).toBe(entriesFingerprint([raj, priya]));
  });

  it("is a 16-hex-digit string", () => {
    expect(entriesFingerprint([priya])).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes when one score changes", () => {
    const edited = { ...priya, scores: [28, 33, 31, 36, 30] };
    expect(entriesFingerprint([priya, raj])).not.toBe(entriesFingerprint([edited, raj]));
  });

  it("changes when a member joins or leaves", () => {
    expect(entriesFingerprint([priya])).not.toBe(entriesFingerprint([priya, raj]));
    expect(entriesFingerprint([])).not.toBe(entriesFingerprint([priya]));
  });

  it("depends on score order within an entry (newest-first is part of the ticket)", () => {
    const reordered = { ...priya, scores: [29, 36, 31, 33, 28] };
    expect(entriesFingerprint([priya])).not.toBe(entriesFingerprint([reordered]));
  });

  it("changes when the funding base changes, even with identical entries", () => {
    const base = { activeSubscriberCount: 10, poolPaise: 149_700 };
    expect(entriesFingerprint([priya], base)).not.toBe(entriesFingerprint([priya]));
    expect(entriesFingerprint([priya], base)).not.toBe(
      entriesFingerprint([priya], { ...base, activeSubscriberCount: 11 }),
    );
    expect(entriesFingerprint([priya], base)).toBe(entriesFingerprint([priya], { ...base }));
  });

  it("canonical form sorts by user id", () => {
    expect(canonicalEntries([priya, raj])).toBe("a-raj:30,30,41,22,35|b-priya:28,33,31,36,29");
  });
});
