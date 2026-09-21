import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, clientAs, createUser, deleteUser, grantActiveSubscription, PG, type Db, type TestUser } from "./setup";

let adminUser: TestUser;
let winner: TestUser;
let loser: TestUser;
let asAdmin: Db;
let asWinner: Db;
let drawId: string;

const NUMBERS = [12, 29, 33, 36, 41];

function simulationArgs(overrides: Partial<Parameters<Db["rpc"]>[1]> = {}) {
  return {
    p_draw_id: drawId,
    p_mode: "random" as const,
    p_numbers: NUMBERS,
    p_active_subscriber_count: 2,
    p_pool_paise: 29_940,
    p_rollover_in_paise: 0,
    p_jackpot_pool_paise: 11_976,
    p_four_pool_paise: 10_479,
    p_three_pool_paise: 7_485,
    p_rollover_out_paise: 11_976,
    p_unclaimed_retained_paise: 10_479,
    p_entries_hash: "hash-1",
    p_entries: [
      { user_id: winner.id, scores: [28, 33, 31, 36, 29], match_count: 3 },
      { user_id: loser.id, scores: [20, 22, 25, 27, 30], match_count: 0 },
    ],
    p_results: [{ user_id: winner.id, match_count: 3, prize_paise: 7_485 }],
    ...overrides,
  };
}

beforeAll(async () => {
  [adminUser, winner, loser] = await Promise.all([createUser("admin"), createUser(), createUser()]);
  await Promise.all([grantActiveSubscription(winner.id), grantActiveSubscription(loser.id)]);
  [asAdmin, asWinner] = await Promise.all([clientAs(adminUser), clientAs(winner)]);
  const { data } = await admin.from("draws").insert({ draw_month: "2026-11-01" }).select("id").single();
  drawId = data!.id;
});

afterAll(async () => {
  await admin.from("draws").delete().eq("id", drawId);
  await Promise.all([adminUser, winner, loser].map(deleteUser));
});

describe("save_simulation", () => {
  it("persists numbers, pool snapshot, entries and results in one call", async () => {
    const { data, error } = await asAdmin.rpc("save_simulation", simulationArgs());
    expect(error).toBeNull();
    expect(data!.status).toBe("simulated");
    expect(data!.numbers).toEqual(NUMBERS);
    expect(data!.jackpot_pool_paise).toBe(11_976);

    const { data: entries } = await admin.from("draw_entries").select("user_id, match_count").eq("draw_id", drawId);
    expect(entries).toHaveLength(2);
    const { data: results } = await admin.from("draw_results").select("user_id, prize_paise").eq("draw_id", drawId);
    expect(results).toEqual([{ user_id: winner.id, prize_paise: 7_485 }]);
  });

  it("re-simulating replaces the previous draft rather than appending", async () => {
    const { error } = await asAdmin.rpc(
      "save_simulation",
      simulationArgs({ p_numbers: [1, 2, 3, 4, 5], p_results: [], p_entries_hash: "hash-2" }),
    );
    expect(error).toBeNull();
    const { data: results } = await admin.from("draw_results").select("id").eq("draw_id", drawId);
    expect(results).toEqual([]);
    const { data: draw } = await admin.from("draws").select("numbers, entries_hash").eq("id", drawId).single();
    expect(draw).toEqual({ numbers: [1, 2, 3, 4, 5], entries_hash: "hash-2" });
    // restore the winning simulation for the publish tests
    await asAdmin.rpc("save_simulation", simulationArgs());
  });

  it("is refused for a member", async () => {
    const { error } = await asWinner.rpc("save_simulation", simulationArgs());
    expect(error?.code).toBe(PG.insufficientPrivilege);
  });
});

describe("one open draw at a time", () => {
  it("refuses a second draft while one is open", async () => {
    const { error } = await admin.from("draws").insert({ draw_month: "2026-12-01" });
    expect(error?.code).toBe(PG.uniqueViolation);
  });
});

describe("publish_draw", () => {
  it("is invisible to the winner before publishing", async () => {
    const { data } = await asWinner.from("draw_results").select("id").eq("draw_id", drawId);
    expect(data).toEqual([]);
  });

  it("flips the draw to published and opens a verification per winner", async () => {
    const { data, error } = await asAdmin.rpc("publish_draw", { p_draw_id: drawId });
    expect(error).toBeNull();
    expect(data!.status).toBe("published");
    expect(data!.published_by).toBe(adminUser.id);

    const { data: verifications } = await admin.from("winner_verifications").select("user_id, review_status").eq("user_id", winner.id);
    expect(verifications).toEqual([{ user_id: winner.id, review_status: "awaiting_proof" }]);
  });

  it("is idempotent: publishing again returns the same row and adds nothing", async () => {
    const { data, error } = await asAdmin.rpc("publish_draw", { p_draw_id: drawId });
    expect(error).toBeNull();
    expect(data!.status).toBe("published");
    const { data: verifications } = await admin.from("winner_verifications").select("id").eq("user_id", winner.id);
    expect(verifications).toHaveLength(1);
  });

  it("lets the winner see their result and entry only after publishing", async () => {
    const { data: results } = await asWinner.from("draw_results").select("prize_paise").eq("draw_id", drawId);
    expect(results).toEqual([{ prize_paise: 7_485 }]);
    const { data: entries } = await asWinner.from("draw_entries").select("user_id").eq("draw_id", drawId);
    expect(entries!.map((e) => e.user_id)).toEqual([winner.id]);
  });

  it("refuses to re-simulate a published draw", async () => {
    const { error } = await asAdmin.rpc("save_simulation", simulationArgs());
    expect(error?.code).toBe(PG.raiseException);
  });

  it("refuses to publish a bare draft", async () => {
    const { data: draft } = await admin.from("draws").insert({ draw_month: "2027-01-01" }).select("id").single();
    const { error } = await asAdmin.rpc("publish_draw", { p_draw_id: draft!.id });
    expect(error?.code).toBe(PG.raiseException);
    await admin.from("draws").delete().eq("id", draft!.id);
  });
});

describe("winner verification RPCs mirror the state machine", () => {
  let verificationId: string;

  beforeAll(async () => {
    const { data } = await admin.from("winner_verifications").select("id").eq("user_id", winner.id).single();
    verificationId = data!.id;
  });

  it("admin cannot approve before proof is submitted", async () => {
    const { error } = await asAdmin.rpc("review_winner", { p_verification_id: verificationId, p_approve: true });
    expect(error?.code).toBe(PG.raiseException);
  });

  it("winner submits proof → submitted", async () => {
    const { data, error } = await asWinner.rpc("submit_winner_proof", {
      p_verification_id: verificationId,
      p_proof_path: `${winner.id}/${verificationId}.webp`,
    });
    expect(error).toBeNull();
    expect(data!.review_status).toBe("submitted");
  });

  it("another member cannot submit proof on the winner's claim", async () => {
    const asLoser = await clientAs(loser);
    const { error } = await asLoser.rpc("submit_winner_proof", { p_verification_id: verificationId, p_proof_path: "x" });
    expect(error?.code).toBe(PG.noDataFound);
  });

  it("reject → one resubmission allowed → approve → paid", async () => {
    const rejected = await asAdmin.rpc("review_winner", { p_verification_id: verificationId, p_approve: false, p_note: "Blurry" });
    expect(rejected.data!.review_status).toBe("rejected");

    const resubmitted = await asWinner.rpc("submit_winner_proof", { p_verification_id: verificationId, p_proof_path: "again.webp" });
    expect(resubmitted.data!.resubmissions).toBe(1);

    const paidTooEarly = await asAdmin.rpc("mark_winner_paid", { p_verification_id: verificationId });
    expect(paidTooEarly.error?.code).toBe(PG.raiseException);

    const approved = await asAdmin.rpc("review_winner", { p_verification_id: verificationId, p_approve: true });
    expect(approved.data!.review_status).toBe("approved");

    const paid = await asAdmin.rpc("mark_winner_paid", { p_verification_id: verificationId });
    expect(paid.data!.payout_status).toBe("paid");

    const paidAgain = await asAdmin.rpc("mark_winner_paid", { p_verification_id: verificationId });
    expect(paidAgain.error?.code).toBe(PG.raiseException);
  });

  it("member cannot review or mark paid", async () => {
    const review = await asWinner.rpc("review_winner", { p_verification_id: verificationId, p_approve: true });
    expect(review.error?.code).toBe(PG.insufficientPrivilege);
    const paid = await asWinner.rpc("mark_winner_paid", { p_verification_id: verificationId });
    expect(paid.error?.code).toBe(PG.insufficientPrivilege);
  });

  it("reporting views reflect the paid prize", async () => {
    const { data } = await asAdmin.from("draw_statistics").select("three_match_winners, prizes_paise").eq("draw_id", drawId).single();
    expect(data).toEqual({ three_match_winners: 1, prizes_paise: 7_485 });
    const { data: summary } = await asAdmin.from("reports_summary").select("prizes_paid_paise").single();
    expect(summary!.prizes_paid_paise).toBeGreaterThanOrEqual(7_485);
  });
});
