import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, clientAs, createUser, deleteUser, grantActiveSubscription, PG, type Db, type TestUser } from "./setup";

let subscriber: TestUser;
let nonSubscriber: TestUser;
let asSubscriber: Db;
let asNonSubscriber: Db;

beforeAll(async () => {
  [subscriber, nonSubscriber] = await Promise.all([createUser(), createUser()]);
  await grantActiveSubscription(subscriber.id);
  [asSubscriber, asNonSubscriber] = await Promise.all([clientAs(subscriber), clientAs(nonSubscriber)]);
});

afterAll(async () => {
  await Promise.all([subscriber, nonSubscriber].map(deleteUser));
});

async function keptDates(userId: string): Promise<string[]> {
  const { data } = await admin.from("scores").select("played_on").eq("user_id", userId).order("played_on", { ascending: false });
  return data!.map((row) => row.played_on);
}

describe("rolling five (trigger enforce_score_window)", () => {
  it("keeps the five most recent rounds by date played, whatever the insert order", async () => {
    const dates = ["2026-09-10", "2026-09-01", "2026-09-20", "2026-09-05", "2026-09-15", "2026-09-25"];
    for (const played_on of dates) {
      const { error } = await asSubscriber.from("scores").insert({ user_id: subscriber.id, score: 30, played_on });
      expect(error).toBeNull();
    }
    expect(await keptDates(subscriber.id)).toEqual(["2026-09-25", "2026-09-20", "2026-09-15", "2026-09-10", "2026-09-05"]);
  });

  it("evicts the right round when a backdated one lands inside the window", async () => {
    const { error } = await asSubscriber.from("scores").insert({ user_id: subscriber.id, score: 31, played_on: "2026-09-12" });
    expect(error).toBeNull();
    expect(await keptDates(subscriber.id)).toEqual(["2026-09-25", "2026-09-20", "2026-09-15", "2026-09-12", "2026-09-10"]);
  });
});

describe("constraints", () => {
  it("rejects a second round on the same date", async () => {
    const { error } = await asSubscriber.from("scores").insert({ user_id: subscriber.id, score: 40, played_on: "2026-09-25" });
    expect(error?.code).toBe(PG.uniqueViolation);
  });

  it.each([0, 46])("rejects a score of %s", async (score) => {
    const { error } = await asSubscriber.from("scores").insert({ user_id: subscriber.id, score, played_on: "2026-08-01" });
    expect(error?.code).toBe(PG.checkViolation);
  });
});

describe("access gate (§04)", () => {
  it("refuses a score from a member without an active subscription", async () => {
    const { error } = await asNonSubscriber.from("scores").insert({ user_id: nonSubscriber.id, score: 30, played_on: "2026-09-01" });
    expect(error).not.toBeNull();
    expect(await keptDates(nonSubscriber.id)).toEqual([]);
  });

  it("refuses a score written under another member's id", async () => {
    const { error } = await asSubscriber.from("scores").insert({ user_id: nonSubscriber.id, score: 30, played_on: "2026-09-02" });
    expect(error).not.toBeNull();
  });
});
