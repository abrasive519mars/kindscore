import { ValidationError } from "@/engine/errors";
import { createReportsService } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { toResponse } from "@/lib/errors/http";
import { REPORT_KINDS, type ReportKind } from "@/services/ReportsService";

function isReportKind(value: string | null): value is ReportKind {
  return REPORT_KINDS.includes(value as ReportKind);
}

/** PRD §11.05 CSV export. A route handler because the response is a file, not a page. */
export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin();
    const kind = new URL(request.url).searchParams.get("report");
    if (!isReportKind(kind)) throw new ValidationError("Unknown report");
    const csv = await (await createReportsService()).csv(kind);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="kindscore-${kind}-${stamp}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return toResponse(error);
  }
}
