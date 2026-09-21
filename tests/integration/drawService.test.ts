import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RuleViolationError } from "@/engine/errors";
import { sequenceRng } from "@/engine/draw/rng";
import { SupabaseDrawRepository } from "@/repositories/supabase/SupabaseDrawRepository";
import { DrawService, STALE_MESSAGE } from "@/services/DrawService";
import {
  admin,
  anon,
  CHARITY,
  clientAs,
  createUser,
  deleteUser,
  grantActiveSubscription,
  type Db,
  type TestUser,
} from "./setup";

/**
 * The whole draw path through the real service against real Postgres, as the three kinds of
 * caller: admin (simulate / publish), member (own entry and result), anon (public statistics).
 * The rng is fixed so the drawn numbers are 1–5 and the winners are known in advance.
 */
const SCORE_SETS: Record<string, number[]> = {
  jackpot: [1, 2, 3, 4, 5],
  three: [1, 2, 3, 40, 41],
  none: [20, 21, 22, 23, 24],
  four: [10, 11, 12, 13], // four scores → funds the pool, not in the draw
};
const zeros = () => sequenceRng([0, 0, 0, 0, 0]);

let adminUser: TestUser;
let members: Record<string, TestUser>;
let adminDb: Db;
let service: DrawService;
let drawId: string;

async function seedScores(userId: string, scores: number[]) {
  const rows = scores.map((score, i) => ({
    user_id: userId,
    score,
    played_on: `2026-09-${String(20 - i).padStart(2, "0")}`,
  }));
  const { error } = await admin.from("scores").insert(rows);
  if (error) throw error;
}

beforeAll(async () => {
  adminUser = await createUser("admin");
  members = Object.fromEntries(
    await Promise.all(
      Object.keys(SCORE_SETS).map(
        async (key) => [key, await createUser("member", CHARITY.udaan)] as const,
      ),
    ),
  );
  for (const [key, user] of Object.entries(members)) {
    await grantActiveSubscription(user.id, key === "none" ? "year" : "month");
    await seedScores(user.id, SCORE_SETS[key]);
  }
  adminDb = await clientAs(adminUser);
  service = new DrawService(new SupabaseDrawRepository(adminDb));
});

afterAll(async () => {
  if (drawId) await admin.from("draws").delete().eq("id", drawId);
  await Promise.all([adminUser, ...Object.values(members)].map(deleteUser));
});

describe("DrawService against Postgres", () => {
  it("opens a draft, simulates, and persists entries + results consistently", async () => {
    const draw = await service.openNextDraw();
    drawId = draw.id;
    const report = await service.simulate(draw.id, "random", zeros());

    expect(report.draw.numbers).toEqual([1, 2, 3, 4, 5]);
    expect(report.eligibleCount).toBeGreaterThanOrEqual(3);
    expect(report.ineligibleCount).toBeGreaterThanOrEqual(1);

    const { data: entries } = await admin
      .from("draw_entries")
      .select("user_id, match_count")
      .eq("draw_id", draw.id);
    const { data: results } = await admin
      .from("draw_results")
      .select("user_id, match_count, prize_paise")
      .eq("draw_id", draw.id);
    const ourEntries = entries!.filter((e) =>
      Object.values(members).some((m) => m.id === e.user_id),
    );
    expect(ourEntries.map((e) => e.user_id)).not.toContain(members.four.id);
    expect(ourEntries.find((e) => e.user_id === members.jackpot.id)?.match_count).toBe(5);

    const jackpot = results!.find((r) => r.user_id === members.jackpot.id);
    const three = results!.find((r) => r.user_id === members.three.id);
    expect(jackpot?.match_count).toBe(5);
    expect(three?.match_count).toBe(3);
    // Σ prizes = Σ tier pools that had winners; nothing is invented.
    const paidOut = results!.reduce((sum, r) => sum + r.prize_paise, 0);
    const pools = report.draw.tierPools;
    expect(paidOut + report.draw.rolloverOutPaise + report.draw.unclaimedRetainedPaise).toBe(
      pools[5] + pools[4] + pools[3],
    );
  });

  it("the admin's winners table names the winners; a member cannot see the draft at all", async () => {
    const rows = await new SupabaseDrawRepository(adminDb).listResults(drawId);
    expect(rows.map((r) => r.email)).toContain(members.jackpot.email);
    const memberDb = await clientAs(members.jackpot);
    const { data } = await memberDb.from("draws").select("id").eq("id", drawId);
    expect(data).toEqual([]);
  });

  it("a score edit by an eligible member makes the draft stale and blocks publishing", async () => {
    const memberDb = await clientAs(members.three);
    const { data: row } = await memberDb.from("scores").select("id").eq("score", 41).single();
    const { error } = await memberDb.from("scores").update({ score: 42 }).eq("id", row!.id);
    expect(error).toBeNull();

    const draft = (await new SupabaseDrawRepository(adminDb).findById(drawId))!;
    expect(await service.checkFreshness(draft)).toEqual({ stale: true });
    await expect(service.publish(drawId)).rejects.toThrow(STALE_MESSAGE);
    await expect(service.publish(drawId)).rejects.toBeInstanceOf(RuleViolationError);
  });

  it("re-simulating clears the staleness; publishing then works and is idempotent", async () => {
    await service.simulate(drawId, "algorithmic", zeros());
    const published = await service.publish(drawId);
    expect(published.status).toBe("published");
    expect((await service.publish(drawId)).publishedAt).toBe(published.publishedAt);
  });

  it("after publishing, a member sees their own outcome and the public tier counts", async () => {
    const memberDb = await clientAs(members.three);
    const outcomes = await new SupabaseDrawRepository(memberDb).listMemberOutcomes(
      members.three.id,
    );
    const mine = outcomes.find((o) => o.draw.drawId === drawId)!;
    expect(mine.entry).toEqual({ scores: [1, 2, 3, 40, 42], matchCount: 3 });
    expect(mine.prizePaise).toBeGreaterThan(0);
    expect(mine.draw.winners[5]).toBeGreaterThanOrEqual(1);
    expect(mine.draw.winners[3]).toBeGreaterThanOrEqual(1);

    // Not their business: another member's result is invisible even after publishing.
    const { data: others } = await memberDb
      .from("draw_results")
      .select("user_id")
      .eq("draw_id", drawId);
    expect(others!.map((r) => r.user_id)).toEqual([members.three.id]);
  });

  it("a visitor sees the published statistics but no entries or results", async () => {
    const summary = await new SupabaseDrawRepository(anon).findSummary(drawId);
    expect(summary?.numbers).toEqual([1, 2, 3, 4, 5]);
    expect(summary?.winners[5]).toBeGreaterThanOrEqual(1);
    const { data: entries } = await anon.from("draw_entries").select("id").eq("draw_id", drawId);
    expect(entries).toEqual([]);
  });

  it("active_subscriber_counts reports plans without exposing rows", async () => {
    const counts = await new SupabaseDrawRepository(anon).activeSubscriberCounts();
    expect(counts.month).toBeGreaterThanOrEqual(3);
    expect(counts.year).toBeGreaterThanOrEqual(1);
    const { data } = await anon.from("subscriptions").select("id");
    expect(data).toEqual([]);
  });

  it("the projected jackpot is the engine's number from those counts", async () => {
    const jackpot = await new DrawService(new SupabaseDrawRepository(anon)).projectedJackpot();
    expect(jackpot).toBeGreaterThan(0);
  });
});
