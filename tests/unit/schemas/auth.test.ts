import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/schemas/auth";

const valid = {
  fullName: "Priya Sharma",
  email: "Priya@Example.com",
  password: "Kindscore!2026",
  charityId: "c0000000-0000-4000-8000-000000000007",
  charityBps: "1500",
};

describe("signupSchema", () => {
  it("accepts a valid signup and normalises the email", () => {
    const parsed = signupSchema.parse(valid);
    expect(parsed.email).toBe("priya@example.com");
    expect(parsed.charityBps).toBe(1500);
  });

  it.each([1000, 7000, 3500])("accepts charity share %s bps", (bps) => {
    expect(signupSchema.parse({ ...valid, charityBps: String(bps) }).charityBps).toBe(bps);
  });

  it.each([900, 7100, 1050, 0])("rejects charity share %s bps", (bps) => {
    expect(signupSchema.safeParse({ ...valid, charityBps: String(bps) }).success).toBe(false);
  });

  it("carries the plan picked on a pricing card, or none", () => {
    expect(signupSchema.parse(valid).plan).toBeUndefined();
    expect(signupSchema.parse({ ...valid, plan: "year" }).plan).toBe("year");
    expect(signupSchema.parse({ ...valid, plan: "month" }).plan).toBe("month");
  });

  it("rejects a plan that is not one of the two", () => {
    expect(signupSchema.safeParse({ ...valid, plan: "weekly" }).success).toBe(false);
  });

  it("rejects a short password, a short name and a bad charity id", () => {
    expect(signupSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, fullName: "P" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, charityId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(loginSchema.parse({ email: "A@B.CO", password: "x" }).email).toBe("a@b.co");
  });
});
