import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("writes headers and rows with CRLF endings", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          [1, "x"],
          [2, "y"],
        ],
      ),
    ).toBe("a,b\r\n1,x\r\n2,y\r\n");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv(["name"], [['Say "hi", then\nleave']])).toBe(
      'name\r\n"Say ""hi"", then\nleave"\r\n',
    );
  });

  it("writes empty cells for null and undefined, and plain text for booleans", () => {
    expect(toCsv(["a", "b", "c"], [[null, undefined, true]])).toBe("a,b,c\r\n,,true\r\n");
  });
});
