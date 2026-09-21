import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError } from "@/engine/errors";
import { SupabaseAdminUserRepository } from "@/repositories/supabase/SupabaseAdminUserRepository";
import { SupabaseCharityRepository } from "@/repositories/supabase/SupabaseCharityRepository";
import { SupabaseDrawRepository } from "@/repositories/supabase/SupabaseDrawRepository";
import { SupabaseReportsRepository } from "@/repositories/supabase/SupabaseReportsRepository";
import { SupabaseScoreRepository } from "@/repositories/supabase/SupabaseScoreRepository";
import { AdminUserService } from "@/services/AdminUserService";
import { ReportsService } from "@/services/ReportsService";
import { ScoreService } from "@/services/ScoreService";
import { admin, CHARITY, clientAs, createUser, deleteUser, type Db, type TestUser } from "./setup";

let adminUser: TestUser;
let target: TestUser;
let adminDb: Db;
let targetDb: Db;
let service: AdminUserService;

function adminServiceOn(db: Db) {
  return new AdminUserService(
    new SupabaseAdminUserRepository(db),
    new SupabaseCharityRepository(db),
    new ScoreService(new SupabaseScoreRepository(db)),
  );
}

async function hasAccess(userId: string) {
  const { data } = await admin.rpc("has_active_access", { uid: userId });
  return data;
}

beforeAll(async () => {
  [adminUser, target] = await Promise.all([
    createUser("admin"),
    createUser("member", CHARITY.sahajShiksha),
  ]);
  [adminDb, targetDb] = await Promise.all([clientAs(adminUser), clientAs(target)]);
  service = adminServiceOn(adminDb);
});

afterAll(async () => {
  await Promise.all([adminUser, target].map(deleteUser));
});

describe("who may administer", () => {
  it("a member cannot list members or call the subscription RPC", async () => {
    const asMember = adminServiceOn(targetDb);
    expect((await asMember.list({})).map((m) => m.id)).toEqual([target.id]); // RLS: only their own profile row
    await expect(asMember.grantSubscription(target.id, "month")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await hasAccess(target.id)).toBe(false);
  });

  it("the admin lists members with their score count and finds one by search", async () => {
    const rows = await service.list({ query: target.email });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: target.id,
      scoreCount: 0,
      subscription: null,
      charityName: "Sahaj Shiksha Foundation",
    });
  });
});

describe("editing a member", () => {
  it("profile edits land and are audited", async () => {
    await service.updateProfile(adminUser.id, target.id, {
      fullName: "Target Renamed",
      charityId: CHARITY.udaan,
      charityBps: 2000,
    });
    const detail = await service.detail(target.id);
    expect(detail).toMatchObject({
      fullName: "Target Renamed",
      charityBps: 2000,
      charityName: "Udaan Girls' Sports Collective",
    });
    expect(detail.audit[0]).toMatchObject({ action: "profile.update", actorName: "Test admin" });
  });

  it("scores obey the same rules: five kept by date, one per date, audited", async () => {
    for (let d = 1; d <= 6; d++)
      await service.addScore(adminUser.id, target.id, {
        score: 30 + d,
        playedOn: `2026-08-${String(d).padStart(2, "0")}`,
      });
    const detail = await service.detail(target.id);
    expect(detail.scores.map((s) => s.score)).toEqual([36, 35, 34, 33, 32]);
    await expect(
      service.addScore(adminUser.id, target.id, { score: 20, playedOn: "2026-08-06" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(detail.audit.filter((a) => a.action === "score.add")).toHaveLength(6);
    const { data: own } = await targetDb.from("scores").select("score").eq("user_id", target.id);
    expect(own).toHaveLength(5);
  });
});

describe("subscription control", () => {
  it("grant → access at once, marked admin; end → gone at once", async () => {
    await service.grantSubscription(target.id, "month");
    expect(await hasAccess(target.id)).toBe(true);
    const { data: mine } = await targetDb
      .from("subscriptions")
      .select("source, status")
      .eq("user_id", target.id);
    expect(mine).toEqual([{ source: "admin", status: "active" }]);

    await service.endSubscription(target.id);
    expect(await hasAccess(target.id)).toBe(false);
    const detail = await service.detail(target.id);
    expect(detail.subscription).toMatchObject({ status: "lapsed", hasAccess: false });
    expect(detail.audit.map((a) => a.action).slice(0, 2)).toEqual([
      "subscription.end",
      "subscription.grant",
    ]);
    await expect(service.endSubscription(target.id)).rejects.toThrow(/No live subscription/);
  });
});

describe("reports", () => {
  it("totals equal SQL sums", async () => {
    const reports = new ReportsService(
      new SupabaseReportsRepository(adminDb),
      new SupabaseDrawRepository(adminDb),
      new SupabaseAdminUserRepository(adminDb),
    );
    const { summary, byMonth, charities } = await reports.overview();
    const { data: ledger } = await admin.from("charity_contributions").select("amount_paise");
    expect(summary.charityTotalPaise).toBe(ledger!.reduce((s, r) => s + r.amount_paise, 0));
    expect(charities.reduce((s, c) => s + c.totalPaise, 0)).toBe(summary.charityTotalPaise);
    const { data: payments } = await admin.from("payments").select("pool_paise");
    expect(byMonth.reduce((s, m) => s + m.poolPaise, 0)).toBe(
      payments!.reduce((s, p) => s + p.pool_paise, 0),
    );
    expect((await reports.csv("members")).split("\r\n")[0]).toMatch(/^name,email/);
  });
});
