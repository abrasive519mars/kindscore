import { ZodError } from "zod";
import { isAppError, type ErrorCode } from "@/engine/errors";

/**
 * The one shape every server action returns. Nothing throws across the client boundary;
 * forms read `ok` and either render `data` or show `error.message` beside `error.field`.
 */
export interface ActionError {
  readonly code: ErrorCode | "UNKNOWN";
  readonly message: string;
  readonly field?: string;
}

export type ActionResult<T = void> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: ActionError): ActionResult<never> {
  return { ok: false, error };
}

const GENERIC_MESSAGE = "Something went wrong on our side. Please try again.";

/** Maps any thrown value to an ActionError. Unknown errors are logged, never shown. */
export function toActionError(error: unknown): ActionError {
  if (isAppError(error)) {
    const field = "field" in error && typeof error.field === "string" ? error.field : undefined;
    return { code: error.code, message: error.userMessage, field };
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return { code: "VALIDATION", message: issue.message, field: issue.path.map(String).join(".") || undefined };
  }
  console.error("[action] unexpected error", error);
  return { code: "UNKNOWN", message: GENERIC_MESSAGE };
}

/**
 * Wraps a server action body. Next's redirect() works by throwing a special error that must
 * pass through untouched, which is why it is re-thrown before any mapping happens.
 */
export async function runAction<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await body());
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(toActionError(error));
  }
}

function isNextControlFlow(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as Error & { digest?: string }).digest ?? "";
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest === "NEXT_HTTP_ERROR_FALLBACK;403";
}
