/**
 * The `?next=` parameter tells login where to send someone afterwards. Only same-site paths are
 * honoured; anything that could leave the site (absolute URLs, protocol-relative, javascript:)
 * is dropped. Classic open-redirect guard.
 */
export const DEFAULT_AFTER_LOGIN = "/app";

export function safeNextPath(
  raw: string | null | undefined,
  fallback = DEFAULT_AFTER_LOGIN,
): string {
  if (!raw) return fallback;
  const isRelativePath = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\");
  return isRelativePath ? raw : fallback;
}
