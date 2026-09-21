import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirects";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/app/scores")).toBe("/app/scores");
    expect(safeNextPath("/app?tab=1")).toBe("/app?tab=1");
  });

  it.each(["//evil.com", String.raw`/\evil.com`, "https://evil.com", "javascript:alert(1)", "evil", "", null, undefined])(
    "falls back for %s",
    (raw) => {
      expect(safeNextPath(raw)).toBe("/app");
    },
  );

  it("honours a custom fallback", () => {
    expect(safeNextPath(null, "/admin")).toBe("/admin");
  });
});
