import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "@/engine/errors";
import type { ScoreEntry } from "@/engine/scores/latestFive";
import type { ScoreRepository, ScoreWrite } from "@/repositories/interfaces/ScoreRepository";
import { AdminUserService } from "@/services/AdminUserService";
import { ScoreService } from "@/services/ScoreService";
import { FakeAdminUserRepository, member } from "../../fakes/admin";
import { charity, FakeCharityRepository } from "../../fakes/charities";

/** Same in-memory scores as the ScoreService tests — the admin edits under identical rules. */
class FakeScoreRepository implements ScoreRepository {
  rows: ScoreEntry[] = [];
  private seq = 0;
  async listForUser() {
    return [...this.rows].sort((a, b) => b.playedOn.localeCompare(a.playedOn));
  }
  async insert(_userId: string, write: ScoreWrite): Promise<ScoreEntry> {
    const entry = {
      id: `r${++this.seq}`,
      score: write.score,
      playedOn: write.playedOn,
      createdAt: `${write.playedOn}T10:00:00Z`,
    };
    this.rows.push(entry);
    return entry;
  }
  async update(_userId: string, id: string, write: ScoreWrite) {
    const i = this.rows.findIndex((r) => r.id === id);
    this.rows[i] = { ...this.rows[i], ...write };
    return this.rows[i];
  }
  async delete(_userId: string, id: string) {
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}

let users: FakeAdminUserRepository;
let charities: FakeCharityRepository;
let scores: FakeScoreRepository;
let service: AdminUserService;
const ADMIN = "admin-1";

beforeEach(() => {
  users = new FakeAdminUserRepository();
  users.members = [member()];
  charities = new FakeCharityRepository();
  charities.charities = [
    charity({ id: "c-1" }),
    charity({ id: "c-2", slug: "sahaj", name: "Sahaj Shiksha" }),
  ];
  scores = new FakeScoreRepository();
  service = new AdminUserService(users, charities, new ScoreService(scores));
});

describe("profile", () => {
  it("updates name, charity and share, and audits before/after", async () => {
    await service.updateProfile(ADMIN, "user-1", {
      fullName: " Priya Sharma ",
      charityId: "c-2",
      charityBps: 2500,
    });
    expect(users.members[0]).toMatchObject({
      fullName: "Priya Sharma",
      charityId: "c-2",
      charityBps: 2500,
    });
    expect(users.audits).toEqual([
      expect.objectContaining({
        actorId: ADMIN,
        action: "profile.update",
        targetTable: "profiles",
        targetId: "user-1",
        diff: {
          before: { fullName: "Priya Test", charityId: "c-1", charityBps: 1000 },
          after: { fullName: "Priya Sharma", charityId: "c-2", charityBps: 2500 },
        },
      }),
    ]);
  });

  it("refuses a share outside the rules and an unknown charity, and audits nothing", async () => {
    await expect(
      service.updateProfile(ADMIN, "user-1", { fullName: "P", charityId: "c-1", charityBps: 7500 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.updateProfile(ADMIN, "user-1", {
        fullName: "P",
        charityId: "nope",
        charityBps: 1000,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      service.updateProfile(ADMIN, "ghost", { fullName: "P", charityId: "c-1", charityBps: 1000 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(users.audits).toEqual([]);
  });
});

describe("scores", () => {
  it("adds under the five-by-date rule, evicting the oldest, and audits each step", async () => {
    for (let d = 1; d <= 5; d++)
      await service.addScore(ADMIN, "user-1", { score: 30 + d, playedOn: `2026-09-0${d}` });
    await service.addScore(ADMIN, "user-1", { score: 40, playedOn: "2026-09-10" });
    // The fake repository does not evict (the database trigger does); the service still reports the kept five.
    expect((await service.detail("user-1")).scores.map((s) => s.score)).toEqual([
      40, 35, 34, 33, 32,
    ]);
    expect(users.audits).toHaveLength(6);
    expect(users.audits[5]).toMatchObject({
      action: "score.add",
      diff: { user_id: "user-1", evicted: expect.objectContaining({ score: 31 }) },
    });
  });

  it("refuses a duplicate date exactly as the member would see it", async () => {
    await service.addScore(ADMIN, "user-1", { score: 30, playedOn: "2026-09-01" });
    await expect(
      service.addScore(ADMIN, "user-1", { score: 31, playedOn: "2026-09-01" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("updates and deletes with before/after in the audit", async () => {
    await service.addScore(ADMIN, "user-1", { score: 30, playedOn: "2026-09-01" });
    const id = scores.rows[0].id;
    await service.updateScore(ADMIN, "user-1", id, { score: 33, playedOn: "2026-09-01" });
    await service.removeScore(ADMIN, "user-1", id);
    expect(scores.rows).toEqual([]);
    expect(users.audits.map((a) => a.action)).toEqual([
      "score.add",
      "score.update",
      "score.delete",
    ]);
    expect(users.audits[1].diff).toEqual({
      user_id: "user-1",
      before: { score: 30, playedOn: "2026-09-01" },
      after: { score: 33, playedOn: "2026-09-01" },
    });
  });
});

describe("subscription", () => {
  it("delegates grant and end to the RPC (which audits itself)", async () => {
    await service.grantSubscription("user-1", "year");
    await service.endSubscription("user-1");
    expect(users.subscriptionCalls).toEqual([
      { userId: "user-1", action: "grant", interval: "year" },
      { userId: "user-1", action: "end", interval: "month" },
    ]);
    expect(users.audits).toEqual([]);
  });
});
