import type { PlanInterval } from "@/config/constants";
import type { PaymentLine } from "@/engine/reports/monthly";
import type {
  AdminUserRepository,
  AuditWrite,
  MemberDetail,
  MemberFilter,
  MemberRow,
  ProfileEdit,
} from "@/repositories/interfaces/AdminUserRepository";
import type {
  CharityTotalRow,
  ReportSummary,
  ReportsRepository,
} from "@/repositories/interfaces/ReportsRepository";

export function member(overrides: Partial<MemberDetail> = {}): MemberDetail {
  return {
    id: "user-1",
    fullName: "Priya Test",
    email: "priya@kindscore.test",
    role: "member",
    charityId: "c-1",
    charityName: "Neer Jal Trust",
    charityBps: 1000,
    subscription: null,
    scoreCount: 0,
    createdAt: "2026-09-01T00:00:00Z",
    payments: [],
    audit: [],
    ...overrides,
  };
}

export class FakeAdminUserRepository implements AdminUserRepository {
  members: MemberDetail[] = [];
  audits: AuditWrite[] = [];
  subscriptionCalls: Array<{ userId: string; action: "grant" | "end"; interval: PlanInterval }> =
    [];

  async listMembers(filter: MemberFilter): Promise<MemberRow[]> {
    const q = (filter.query ?? "").toLowerCase();
    return this.members.filter(
      (m) => !q || m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }
  async findMember(id: string) {
    return this.members.find((m) => m.id === id) ?? null;
  }
  async updateProfile(userId: string, edit: ProfileEdit) {
    this.members = this.members.map((m) =>
      m.id === userId
        ? { ...m, fullName: edit.fullName, charityId: edit.charityId, charityBps: edit.charityBps }
        : m,
    );
  }
  async writeAudit(entry: AuditWrite) {
    this.audits.push(entry);
  }
  async setSubscription(userId: string, action: "grant" | "end", interval: PlanInterval) {
    this.subscriptionCalls.push({ userId, action, interval });
  }
}

export class FakeReportsRepository implements ReportsRepository {
  summaryRow: ReportSummary = {
    totalMembers: 3,
    activeSubscribers: 2,
    poolThisMonthPaise: 29_940,
    poolTotalPaise: 119_760,
    charityTotalPaise: 9_980,
    prizesAwardedPaise: 0,
    prizesPaidPaise: 0,
    proofsAwaitingReview: 0,
    currentRolloverPaise: 0,
  };
  totals: CharityTotalRow[] = [];
  lines: PaymentLine[] = [];
  async summary() {
    return this.summaryRow;
  }
  async charityTotals() {
    return this.totals;
  }
  async payments() {
    return this.lines;
  }
}
