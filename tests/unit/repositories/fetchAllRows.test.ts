import { describe, expect, it } from "vitest";
import { fetchAllRows } from "@/repositories/supabase/db";

const PAGE = 1000;

/** A table of `total` rows served through PostgREST-style inclusive ranges. */
function tableOf(total: number) {
  const calls: [number, number][] = [];
  const page = (from: number, to: number) => {
    calls.push([from, to]);
    const data = Array.from(
      { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
      (_, i) => from + i,
    );
    return Promise.resolve({ data, error: null });
  };
  return { page, calls };
}

describe("fetchAllRows", () => {
  it("returns a short first page in one round trip", async () => {
    const table = tableOf(3);
    expect(await fetchAllRows(table.page)).toEqual([0, 1, 2]);
    expect(table.calls).toEqual([[0, PAGE - 1]]);
  });

  it("keeps paging past the 1000-row cap until a short page comes back", async () => {
    const table = tableOf(2 * PAGE + 26);
    const rows = await fetchAllRows(table.page);
    expect(rows).toHaveLength(2 * PAGE + 26);
    expect(rows[PAGE]).toBe(PAGE);
    expect(table.calls).toEqual([
      [0, PAGE - 1],
      [PAGE, 2 * PAGE - 1],
      [2 * PAGE, 3 * PAGE - 1],
    ]);
  });

  it("makes one extra empty request when the table ends exactly on a page boundary", async () => {
    const table = tableOf(PAGE);
    expect(await fetchAllRows(table.page)).toHaveLength(PAGE);
    expect(table.calls).toHaveLength(2);
  });

  it("throws the PostgREST error instead of returning a partial list", async () => {
    const error = { message: "boom", details: "", hint: "", code: "42P01", name: "PostgrestError" };
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error }))).rejects.toBe(error);
  });
});
