import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ConflictError, NotFoundError, ValidationError } from "@/engine/errors";
import { runAction, toActionError } from "@/lib/errors/action-result";

describe("toActionError", () => {
  it("keeps code, message and field from an AppError", () => {
    expect(toActionError(new ValidationError("Bad score", "score"))).toEqual({
      code: "VALIDATION",
      message: "Bad score",
      field: "score",
    });
    expect(toActionError(new ConflictError("Taken"))).toEqual({
      code: "CONFLICT",
      message: "Taken",
      field: undefined,
    });
  });

  it("maps the first Zod issue to a field error", () => {
    const result = z.object({ email: z.email("Enter a valid email") }).safeParse({ email: "nope" });
    if (result.success) throw new Error("expected failure");
    expect(toActionError(result.error)).toEqual({
      code: "VALIDATION",
      message: "Enter a valid email",
      field: "email",
    });
  });

  it("never leaks an unknown error's message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mapped = toActionError(new Error("connection string postgres://secret"));
    expect(mapped.code).toBe("UNKNOWN");
    expect(mapped.message).not.toMatch(/postgres/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("runAction", () => {
  it("wraps a successful body", async () => {
    expect(await runAction(async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it("wraps a thrown AppError", async () => {
    const result = await runAction(async () => {
      throw new NotFoundError("Gone");
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Gone", field: undefined },
    });
  });

  it("lets Next redirects pass through untouched", async () => {
    const redirectLike = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/app;307;",
    });
    await expect(
      runAction(async () => {
        throw redirectLike;
      }),
    ).rejects.toBe(redirectLike);
  });
});
