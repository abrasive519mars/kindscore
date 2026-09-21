import type { PlanInterval } from "@/config/constants";
import {
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  RuleViolationError,
} from "@/engine/errors";
import { hasActiveAccess } from "@/engine/subscription/status";
import type {
  AdminUserRepository,
  AuditRow,
  AuditWrite,
  MemberDetail,
  MemberFilter,
  MemberRow,
  MemberSubscription,
  PaymentRow,
  ProfileEdit,
} from "@/repositories/interfaces/AdminUserRepository";
import type { Db } from "@/repositories/supabase/db";
import type { Database, Json } from "@/types/database.types";

type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

const MEMBER_SELECT = `
  id, full_name, email, role, charity_id, charity_bps, created_at,
  charities ( name ),
  subscriptions ( status, plan_interval, current_period_end, source ),
  scores ( count )
`;

interface MemberJoined {
  id: string;
  full_name: string;
  email: string;
  role: "member" | "admin";
  charity_id: string | null;
  charity_bps: number;
  created_at: string;
  charities: { name: string } | null;
  subscriptions: Pick<
    SubscriptionRow,
    "status" | "plan_interval" | "current_period_end" | "source"
  >[];
  scores: { count: number }[];
}

const PG_RAISE_EXCEPTION = "P0001";
const PG_NO_DATA_FOUND = "P0002";
const PG_INSUFFICIENT_PRIVILEGE = "42501";

function liveSubscription(
  rows: MemberJoined["subscriptions"],
  now: Date,
): MemberSubscription | null {
  const live = rows.find((s) => s.status === "active" || s.status === "past_due") ?? rows[0];
  if (!live) return null;
  return {
    status: live.status,
    interval: live.plan_interval,
    currentPeriodEnd: live.current_period_end,
    source: live.source,
    hasAccess: hasActiveAccess(
      { status: live.status, currentPeriodEnd: live.current_period_end },
      now,
    ),
  };
}

function toRow(row: MemberJoined, now: Date): MemberRow {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    charityId: row.charity_id,
    charityName: row.charities?.name ?? null,
    charityBps: row.charity_bps,
    subscription: liveSubscription(row.subscriptions, now),
    scoreCount: row.scores[0]?.count ?? 0,
    createdAt: row.created_at,
  };
}

function matchesStatus(row: MemberRow, status: MemberFilter["status"]): boolean {
  if (!status || status === "all") return true;
  if (status === "none") return row.subscription === null;
  if (status === "active") return row.subscription?.hasAccess === true;
  return row.subscription !== null && !row.subscription.hasAccess;
}

function matchesQuery(row: MemberRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || row.fullName.toLowerCase().includes(q) || row.email.toLowerCase().includes(q);
}

function mapRpcError(error: { code?: string; message: string }): Error {
  if (error.code === PG_RAISE_EXCEPTION)
    return new RuleViolationError(
      error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".",
    );
  if (error.code === PG_NO_DATA_FOUND) return new NotFoundError("That member doesn't exist.");
  if (error.code === PG_INSUFFICIENT_PRIVILEGE) return new ForbiddenError();
  return new ExternalServiceError("Members", error);
}

export class SupabaseAdminUserRepository implements AdminUserRepository {
  constructor(private readonly db: Db) {}

  async listMembers(filter: MemberFilter): Promise<MemberRow[]> {
    const { data, error } = await this.db
      .from("profiles")
      .select(MEMBER_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new ExternalServiceError("Members", error);
    const now = new Date();
    return (data as unknown as MemberJoined[])
      .map((row) => toRow(row, now))
      .filter((row) => matchesQuery(row, filter.query ?? "") && matchesStatus(row, filter.status));
  }

  async findMember(id: string): Promise<MemberDetail | null> {
    const { data, error } = await this.db
      .from("profiles")
      .select(MEMBER_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Members", error);
    if (!data) return null;
    const [payments, audit] = await Promise.all([this.payments(id), this.audit(id)]);
    return { ...toRow(data as unknown as MemberJoined, new Date()), payments, audit };
  }

  async updateProfile(userId: string, edit: ProfileEdit): Promise<void> {
    const { error } = await this.db
      .from("profiles")
      .update({
        full_name: edit.fullName,
        charity_id: edit.charityId,
        charity_bps: edit.charityBps,
      })
      .eq("id", userId);
    if (error) throw new ExternalServiceError("Members", error);
  }

  async writeAudit(entry: AuditWrite): Promise<void> {
    const { error } = await this.db.from("audit_log").insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_table: entry.targetTable,
      target_id: entry.targetId,
      diff: entry.diff as Json,
    });
    if (error) throw new ExternalServiceError("Audit", error);
  }

  async setSubscription(
    userId: string,
    action: "grant" | "end",
    interval: PlanInterval,
  ): Promise<void> {
    const { error } = await this.db.rpc("admin_set_subscription", {
      p_user_id: userId,
      p_action: action,
      p_interval: interval,
    });
    if (error) throw mapRpcError(error);
  }

  private async payments(userId: string): Promise<PaymentRow[]> {
    const { data, error } = await this.db
      .from("payments")
      .select("id, paid_at, amount_paise, charity_paise, pool_paise, platform_paise")
      .eq("user_id", userId)
      .order("paid_at", { ascending: false })
      .limit(12);
    if (error) throw new ExternalServiceError("Members", error);
    return data.map((p) => ({
      id: p.id,
      paidAt: p.paid_at,
      amountPaise: p.amount_paise,
      charityPaise: p.charity_paise,
      poolPaise: p.pool_paise,
      platformPaise: p.platform_paise,
    }));
  }

  /** Rows about this member: their own row id, or a diff that names them (subscription RPC). */
  private async audit(userId: string): Promise<AuditRow[]> {
    const { data, error } = await this.db
      .from("audit_log")
      .select(
        "id, action, target_table, diff, created_at, profiles!audit_log_actor_id_fkey ( full_name )",
      )
      .or(`target_id.eq.${userId},diff->>user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new ExternalServiceError("Audit", error);
    return (
      data as unknown as Array<{
        id: string;
        action: string;
        target_table: string;
        diff: Record<string, unknown>;
        created_at: string;
        profiles: { full_name: string } | null;
      }>
    ).map((row) => ({
      id: row.id,
      actorName: row.profiles?.full_name ?? null,
      action: row.action,
      targetTable: row.target_table,
      diff: row.diff,
      createdAt: row.created_at,
    }));
  }
}
