import type { Metadata } from "next";
import Link from "next/link";
import { createAdminUserService } from "@/lib/admin";
import { cn } from "@/lib/cn";
import type { MemberRow, MemberStatusFilter } from "@/repositories/interfaces/AdminUserRepository";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Users" };

const STATUS: ReadonlyArray<{ key: MemberStatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "lapsed", label: "Lapsed / ended" },
  { key: "none", label: "Never subscribed" },
];

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function subscriptionBadge(row: MemberRow) {
  const s = row.subscription;
  if (!s) return <Badge tone="neutral">None</Badge>;
  if (s.hasAccess)
    return <Badge tone="success">Active · {s.interval === "year" ? "yearly" : "monthly"}</Badge>;
  return (
    <Badge tone="warn">
      {s.status === "past_due" ? "Payment failed" : s.status === "cancelled" ? "Ended" : "Lapsed"}
    </Badge>
  );
}

/** PRD §11.01 — find any member. Search by name or email; narrow by subscription state. */
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { q = "", status: raw } = (await searchParams) as { q?: string; status?: string };
  const status = (STATUS.find((s) => s.key === raw)?.key ?? "all") as MemberStatusFilter;
  const members = await (await createAdminUserService()).list({ query: q, status });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl">Users</h1>
        <p className="text-ink-2">
          Every member, their charity, their subscription and their scores. Open one to edit.
        </p>
      </header>

      <form action="/admin/users" method="get" className="flex flex-col gap-3" role="search">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name or email"
            aria-label="Search members"
            className="h-11 w-full max-w-sm rounded-md border border-line bg-surface px-3 text-[16px] focus:border-saffron focus:outline-none"
          />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Button type="submit">Search</Button>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Subscription state">
          {STATUS.map((s) => (
            <Link
              key={s.key}
              href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(s.key !== "all" ? { status: s.key } : {}) })}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                status === s.key ? "border-ink bg-ink text-bg" : "border-line hover:bg-surface-2",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </form>

      {members.length === 0 ? (
        <EmptyState title="No users match" body="Try another name or email, or clear the filter." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.06em] text-ink-2">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Charity</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 text-right font-medium">Scores</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${m.id}`} className="font-medium hover:text-saffron">
                      {m.fullName}
                    </Link>
                    <span className="block text-xs text-ink-2">
                      {m.email}
                      {m.role === "admin" && " · admin"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.charityName ?? "—"}{" "}
                    <span className="num text-ink-2">· {m.charityBps / 100}%</span>
                  </td>
                  <td className="flex flex-wrap gap-2 px-4 py-3">
                    {subscriptionBadge(m)}
                    {m.subscription?.source === "admin" && <Badge tone="pool">admin-granted</Badge>}
                    {m.subscription?.source === "seed" && <Badge tone="neutral">seeded</Badge>}
                  </td>
                  <td className="num px-4 py-3 text-right">{m.scoreCount}/5</td>
                  <td className="px-4 py-3 text-ink-2">{formatDay(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
