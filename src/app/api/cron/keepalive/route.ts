import { serverEnv } from "@/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Vercel cron (vercel.json) pings this daily. A free Supabase project pauses after a week without
 * traffic; one cheap query keeps the demo alive. Bearer CRON_SECRET stops anyone else calling it.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${serverEnv().CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { count, error } = await createSupabaseAdminClient()
    .from("charities")
    .select("id", { count: "exact", head: true });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, charities: count, at: new Date().toISOString() });
}
