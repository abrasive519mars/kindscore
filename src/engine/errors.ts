/**
 * Application error hierarchy.
 *
 * Every error the engine raises carries three things the layers above need:
 *  - `code`        stable machine-readable identifier (logged, matched in tests)
 *  - `status`      the HTTP status a route handler should answer with
 *  - `userMessage` safe to show to a person; never contains internals
 *
 * The engine throws these; server actions and route handlers catch and map them.
 * Anything that is not an AppError is a bug and becomes a generic 500.
 */

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "SUBSCRIPTION_REQUIRED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RULE_VIOLATION"
  | "EXTERNAL_SERVICE";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly userMessage: string;

  constructor(code: ErrorCode, status: number, userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.userMessage = userMessage;
  }
}

/** Input failed shape/format validation (bad type, out of range, missing field). */
export class ValidationError extends AppError {
  readonly field?: string;
  constructor(userMessage: string, field?: string) {
    super("VALIDATION", 400, userMessage);
    this.field = field;
  }
}

export class AuthenticationError extends AppError {
  constructor(userMessage = "Please log in to continue.") {
    super("UNAUTHENTICATED", 401, userMessage);
  }
}

export class ForbiddenError extends AppError {
  constructor(userMessage = "You don't have access to that.") {
    super("FORBIDDEN", 403, userMessage);
  }
}

export class SubscriptionRequiredError extends AppError {
  constructor(userMessage = "An active subscription is needed for that.") {
    super("SUBSCRIPTION_REQUIRED", 403, userMessage);
  }
}

export class NotFoundError extends AppError {
  constructor(userMessage = "We couldn't find that.") {
    super("NOT_FOUND", 404, userMessage);
  }
}

/** The request is well-formed but collides with existing state (duplicate date, already published). */
export class ConflictError extends AppError {
  constructor(userMessage: string) {
    super("CONFLICT", 409, userMessage);
  }
}

/** Input is well-formed but breaks a game rule (illegal state transition, ineligible entry). */
export class RuleViolationError extends AppError {
  constructor(userMessage: string) {
    super("RULE_VIOLATION", 422, userMessage);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, cause?: unknown) {
    super("EXTERNAL_SERVICE", 502, `${service} is temporarily unavailable. Please try again.`, {
      cause,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
