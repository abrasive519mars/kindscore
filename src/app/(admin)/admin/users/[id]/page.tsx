import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInr } from "@/engine/money/paise";
import { createAdminUserService } from "@/lib/admin";
import { createCharityService } from "@/lib/charities";
import { createWinnerService } from "@/lib/winners";
import { summariseWinnings } from "@/services/WinnerService";
import { AdminScores } from "@/app/(admin)/admin/users/[id]/AdminScores";
import { ProfileForm } from "@/app/(admin)/admin/users/[id]/ProfileForm";
import { SubscriptionControls } from "@/app/(admin)/admin/users/[id]/SubscriptionControls";
import { Badge, Card, EmptyState, Figure } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Member" };

function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** PRD §11.01 — one member: profile, subscription, scores, payments, winnings, and the audit trail of admin edits. */
export default async function AdminMemberPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const [users, charities, winners] = await Promise.all([
    createAdminUserService(),
    createCharityService(),
    createWinnerService(),
  ]);
  const member = await users.detail(id).catch(() => null);
  if (!member) notFound();
  const [{ charities: options }, winnings] = await Promise.all([
    charities.directory({}, true),
    winners.listWinnings(id),
  ]);
  const won = summariseWinnings(winnings);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-2">
          <Link href="/admin/users" className="hover:text-ink">
            Users
          </Link>{" "}
          / {member.fullName}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl">{member.fullName}</h1>
          <Badge tone={member.role === "admin" ? "pool" : "neutral"}>{member.role}</Badge>
        </div>
        <p className="text-ink-2">
          {member.email} · joined {formatStamp(member.createdAt)}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Figures">
        <Card>
          <Figure
            label="Given to charity"
            value={formatInr(member.payments.reduce((s, p) => s + p.charityPaise, 0))}
            accent
          />
        </Card>
        <Card>
          <Figure
            label="Paid to Kindscore"
            value={formatInr(member.payments.reduce((s, p) => s + p.amountPaise, 0))}
            hint={`${member.payments.length} ${member.payments.length === 1 ? "payment" : "payments"}`}
          />
        </Card>
        <Card>
          <Figure
            label="Won"
            value={formatInr(won.totalWonPaise)}
            hint={
              won.unverifiedCount
                ? `${won.unverifiedCount} awaiting verification`
                : `${formatInr(won.paidPaise)} paid`
            }
          />
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl">Profile</h2>
          <ProfileForm
            userId={member.id}
            fullName={member.fullName}
            charityId={member.charityId}
            charityBps={member.charityBps}
            charities={options.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive }))}
          />
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl">Subscription</h2>
          <SubscriptionControls userId={member.id} subscription={member.subscription} />
        </Card>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Scores</h2>
        <p className="text-sm text-ink-2">
          Same rules as the member: the latest five by date played are kept, one per date, 1–45.
          Every change here is audited.
        </p>
        <AdminScores userId={member.id} entries={member.scores} />
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 min-w-0">
          <h2 className="text-2xl">Payments</h2>
          {member.payments.length === 0 ? (
            <EmptyState
              title="No payments yet"
              body="Stripe invoices appear here as they are paid."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.06em] text-ink-2">
                  <tr>
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                    <th className="py-2 text-right font-medium">Charity</th>
                    <th className="py-2 text-right font-medium">Pool</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {member.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2">{formatStamp(p.paidAt)}</td>
                      <td className="num py-2 text-right">{formatInr(p.amountPaise)}</td>
                      <td className="num py-2 text-right text-saffron">
                        {formatInr(p.charityPaise)}
                      </td>
                      <td className="num py-2 text-right text-pool">{formatInr(p.poolPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="flex flex-col gap-3 min-w-0">
          <h2 className="text-2xl">Audit trail</h2>
          {member.audit.length === 0 ? (
            <EmptyState
              title="No admin edits"
              body="Changes made here are listed with who made them."
            />
          ) : (
            <ol className="flex flex-col divide-y divide-line text-sm">
              {member.audit.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 py-2">
                  <span>
                    <span className="font-medium">{a.action}</span>{" "}
                    <span className="text-ink-2">
                      by {a.actorName ?? "system"} · {formatStamp(a.createdAt)}
                    </span>
                  </span>
                  <code
                    className="num block max-w-full truncate text-xs text-ink-3"
                    title={JSON.stringify(a.diff)}
                  >
                    {JSON.stringify(a.diff)}
                  </code>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
