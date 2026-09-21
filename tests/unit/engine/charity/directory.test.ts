import { describe, expect, it } from "vitest";
import { distinctValues, filterCharities, slugify } from "@/engine/charity/directory";

const charities = [
  {
    name: "Sahaj Shiksha Foundation",
    tagline: "Keeping girls in school",
    category: "Education",
    city: "Nalgonda",
  },
  {
    name: "Neer Jal Trust",
    tagline: "Clean water within a ten-minute walk",
    category: "Water",
    city: "Anantapur",
  },
  { name: "Roshni Netra Care", tagline: "Sight restored", category: "Health", city: "Warangal" },
  {
    name: "Sanjeevani Rural Health Mission",
    tagline: "A doctor who comes to the village",
    category: "Health",
    city: "Adilabad",
  },
];

describe("filterCharities", () => {
  it("returns everything with an empty filter", () => {
    expect(filterCharities(charities, {})).toHaveLength(4);
    expect(filterCharities(charities, { query: "  ", category: "", city: "" })).toHaveLength(4);
  });

  it("matches the query against name, tagline, category and city, ignoring case", () => {
    expect(filterCharities(charities, { query: "WATER" }).map((c) => c.name)).toEqual([
      "Neer Jal Trust",
    ]);
    expect(filterCharities(charities, { query: "doctor" }).map((c) => c.name)).toEqual([
      "Sanjeevani Rural Health Mission",
    ]);
    expect(filterCharities(charities, { query: "warangal" }).map((c) => c.name)).toEqual([
      "Roshni Netra Care",
    ]);
    expect(filterCharities(charities, { query: "health" })).toHaveLength(2);
  });

  it("ANDs the chips with the query", () => {
    expect(filterCharities(charities, { category: "Health" })).toHaveLength(2);
    expect(filterCharities(charities, { category: "Health", city: "Adilabad" })).toHaveLength(1);
    expect(
      filterCharities(charities, { category: "Health", query: "sight" }).map((c) => c.city),
    ).toEqual(["Warangal"]);
    expect(filterCharities(charities, { category: "Water", city: "Warangal" })).toEqual([]);
  });

  it("lists distinct chip values in order", () => {
    expect(distinctValues(charities, (c) => c.category)).toEqual(["Education", "Health", "Water"]);
  });
});

describe("slugify", () => {
  it("makes a URL-safe slug", () => {
    expect(slugify("Udaan Girls' Sports Collective")).toBe("udaan-girls-sports-collective");
    expect(slugify("  Neer Jal Trust ")).toBe("neer-jal-trust");
    expect(slugify("Roshni & Co. — Netra!")).toBe("roshni-co-netra");
  });
});
