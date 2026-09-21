import { describe, expect, it } from "vitest";
import { resolveCharityImageUrl } from "@/lib/charityImagePath";

const ORIGIN = "https://abc.supabase.co";

describe("resolveCharityImageUrl", () => {
  it("serves seed files from /public", () => {
    expect(resolveCharityImageUrl("seed/neer-jal/cover.webp", ORIGIN, "charity-media")).toBe(
      "/seed/neer-jal/cover.webp",
    );
  });

  it("serves uploads from the public bucket", () => {
    expect(resolveCharityImageUrl("c1/cover.webp", ORIGIN, "charity-media")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/charity-media/c1/cover.webp",
    );
  });

  it("is null for no image", () => {
    expect(resolveCharityImageUrl(null, ORIGIN, "charity-media")).toBeNull();
    expect(resolveCharityImageUrl("", ORIGIN, "charity-media")).toBeNull();
  });
});
