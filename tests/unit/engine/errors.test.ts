import { describe, expect, it } from "vitest";
import {
  AppError,
  AuthenticationError,
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  RuleViolationError,
  SubscriptionRequiredError,
  ValidationError,
} from "@/engine/errors";

describe("AppError family", () => {
  it.each([
    [new ValidationError("bad", "field"), "VALIDATION", 400],
    [new AuthenticationError(), "UNAUTHENTICATED", 401],
    [new ForbiddenError(), "FORBIDDEN", 403],
    [new SubscriptionRequiredError(), "SUBSCRIPTION_REQUIRED", 403],
    [new NotFoundError(), "NOT_FOUND", 404],
    [new ConflictError("taken"), "CONFLICT", 409],
    [new RuleViolationError("nope"), "RULE_VIOLATION", 422],
    [new ExternalServiceError("Stripe"), "EXTERNAL_SERVICE", 502],
  ])("%s carries code %s and status %s", (error, code, status) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.userMessage).toBe(error.message);
    expect(error.name).toBe(error.constructor.name);
  });

  it("keeps the field on validation errors", () => {
    expect(new ValidationError("bad", "score").field).toBe("score");
  });

  it("names the service and keeps the cause on external errors", () => {
    const cause = new Error("socket hang up");
    const error = new ExternalServiceError("Stripe", cause);
    expect(error.userMessage).toMatch(/Stripe is temporarily unavailable/);
    expect(error.cause).toBe(cause);
  });

  it("uses sensible default messages", () => {
    expect(new AuthenticationError().userMessage).toMatch(/log in/);
    expect(new ForbiddenError().userMessage).toMatch(/access/);
    expect(new SubscriptionRequiredError().userMessage).toMatch(/subscription/);
    expect(new NotFoundError().userMessage).toMatch(/find/);
  });

  it("isAppError distinguishes our errors from everything else", () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError("string")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});
