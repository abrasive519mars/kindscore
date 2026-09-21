import { isAppError } from "@/engine/errors";
import { toActionError } from "@/lib/errors/action-result";

/** Route-handler twin of runAction: any error → a JSON response with the right status. */
export function toResponse(error: unknown): Response {
  const status = isAppError(error) ? error.status : 500;
  const body = toActionError(error);
  return Response.json({ error: body }, { status });
}
