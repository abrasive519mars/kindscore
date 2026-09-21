import type { PlanInterval } from "@/config/constants";
import type { Paise } from "@/engine/money/paise";
import type { SubscriptionStatus } from "@/engine/subscription/status";

export type MemberStatusFilter = "all" | "active" | "lapsed" | "none";

export interface MemberFilter {
  readonly query?: string;
  readonly status?: MemberStatusFilter;
}

export interface MemberSubscription {
  readonly status: SubscriptionStatus;
  readonly interval: PlanInterval;
  readonly currentPeriodEnd: string;
  /** 'stripe' | 'seed' | 'admin' — where the row came from. */
  readonly source: string;
  readonly hasAccess: boolean;
}

export interface MemberRow {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly role: "member" | "admin";
  readonly charityId: string | null;
  readonly charityName: string | null;
  readonly charityBps: number;
  readonly subscription: MemberSubscription | null;
  readonly scoreCount: number;
  readonly createdAt: string;
}

export interface PaymentRow {
  readonly id: string;
  readonly paidAt: string;
  readonly amountPaise: Paise;
  readonly charityPaise: Paise;
  readonly poolPaise: Paise;
  readonly platformPaise: Paise;
}

export interface AuditRow {
  readonly id: string;
  readonly actorName: string | null;
  readonly action: string;
  readonly targetTable: string;
  readonly diff: Record<string, unknown>;
  readonly createdAt: string;
}

export interface MemberDetail extends MemberRow {
  readonly payments: PaymentRow[];
  readonly audit: AuditRow[];
}

export interface ProfileEdit {
  readonly fullName: string;
  readonly charityId: string;
  readonly charityBps: number;
}

export interface AuditWrite {
  readonly actorId: string;
  readonly action: string;
  readonly targetTable: string;
  readonly targetId: string | null;
  readonly diff: Record<string, unknown>;
}

/** Admin reads and writes over members. RLS grants admins the rows; everyone else gets nothing. */
export interface AdminUserRepository {
  listMembers(filter: MemberFilter): Promise<MemberRow[]>;
  findMember(id: string): Promise<MemberDetail | null>;
  updateProfile(userId: string, edit: ProfileEdit): Promise<void>;
  writeAudit(entry: AuditWrite): Promise<void>;
  /** RPC admin_set_subscription: the one subscriptions write allowed to a client, admin-checked inside. */
  setSubscription(userId: string, action: "grant" | "end", interval: PlanInterval): Promise<void>;
}
