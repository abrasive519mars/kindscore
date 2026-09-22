import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotFoundError, RuleViolationError } from "@/engine/errors";
import { SupabaseProofStorage } from "@/lib/storage/SupabaseProofStorage";
import { SupabaseWinnerRepository } from "@/repositories/supabase/SupabaseWinnerRepository";
import { summariseWinnings, WinnerService } from "@/services/WinnerService";
import {
  admin,
  clientAs,
  createUser,
  deleteUser,
  grantActiveSubscription,
  type Db,
  type TestUser,
} from "./setup";

/**
 * The verification flow through the real service, real Storage and real RPCs: the winner uploads
 * a genuine PNG on their own client, another member sees nothing, the admin reviews on theirs.
 */

// A valid 1×1 transparent PNG (67 bytes) so the bucket's MIME sniffing is satisfied.
const PNG_1x1 = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);
const png = () => new File([PNG_1x1], "screenshot.png", { type: "image/png" });

let adminUser: TestUser;
let winner: TestUser;
let stranger: TestUser;
let drawId: string;
let verificationId: string;
let asWinner: WinnerService;
let asStranger: WinnerService;
let asAdmin: WinnerService;
let adminDb: Db;
let winnerDb: Db;
let strangerDb: Db;

function serviceOn(db: Db) {
  return new WinnerService(new SupabaseWinnerRepository(db), new SupabaseProofStorage(db));
}

beforeAll(async () => {
  [adminUser, winner, stranger] = await Promise.all([
    createUser("admin"),
    createUser(),
    createUser(),
  ]);
  await Promise.all([grantActiveSubscription(winner.id), grantActiveSubscription(stranger.id)]);
  const [wDb, sDb, aDb] = await Promise.all([
    clientAs(winner),
    clientAs(stranger),
    clientAs(adminUser),
  ]);
  adminDb = aDb;
  winnerDb = wDb;
  strangerDb = sDb;
  asWinner = serviceOn(winnerDb);
  asStranger = serviceOn(sDb);
  asAdmin = serviceOn(aDb);

  // A published draw with one 3-match winner, straight through the Phase 2 RPCs.
  const { data: draw } = await admin
    .from("draws")
    .insert({ draw_month: "2027-03-01" })
    .select("id")
    .single();
  drawId = draw!.id;
  const { error } = await adminDb.rpc("save_simulation", {
    p_draw_id: drawId,
    p_mode: "random",
    p_numbers: [28, 33, 31, 12, 40],
    p_active_subscriber_count: 2,
    p_pool_paise: 29_940,
    p_rollover_in_paise: 0,
    p_jackpot_pool_paise: 11_976,
    p_four_pool_paise: 10_479,
    p_three_pool_paise: 7_485,
    p_rollover_out_paise: 11_976,
    p_unclaimed_retained_paise: 10_479,
    p_entries_hash: "test",
    p_entries: [{ user_id: winner.id, scores: [28, 33, 31, 36, 29], match_count: 3 }],
    p_results: [{ user_id: winner.id, match_count: 3, prize_paise: 7_485 }],
  });
  if (error) throw error;
  await adminDb.rpc("publish_draw", { p_draw_id: drawId });
  const { data: verification } = await admin
    .from("winner_verifications")
    .select("id")
    .eq("user_id", winner.id)
    .single();
  verificationId = verification!.id;
});

afterAll(async () => {
  await admin.storage.from("proofs").remove([`${winner.id}/${verificationId}.png`]);
  await admin.from("draws").delete().eq("id", drawId);
  await Promise.all([adminUser, winner, stranger].map(deleteUser));
});

describe("winner verification end to end", () => {
  it("the winner sees their claim awaiting proof; a stranger sees nothing", async () => {
    const mine = await asWinner.listWinnings(winner.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      verificationId,
      matchCount: 3,
      prizePaise: 7_485,
      review: "awaiting_proof",
      numbers: [28, 33, 31, 12, 40],
    });
    expect(await asStranger.listWinnings(stranger.id)).toEqual([]);
    await expect(asStranger.getWinning(stranger.id, verificationId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("uploads a real PNG into the winner's own folder and moves the claim to submitted", async () => {
    const updated = await asWinner.submitProof(winner.id, verificationId, png());
    expect(updated).toMatchObject({
      review: "submitted",
      proofPath: `${winner.id}/${verificationId}.png`,
    });
    const { data } = await admin.storage.from("proofs").list(winner.id);
    expect(data?.map((o) => o.name)).toEqual([`${verificationId}.png`]);
  });

  it("only the winner and an admin can sign a URL for the proof", async () => {
    const path = `${winner.id}/${verificationId}.png`;
    await expect(asWinner.proofUrl(path)).resolves.toMatch(/proofs/);
    await expect(asAdmin.proofUrl(path)).resolves.toMatch(/proofs/);
    const { data: forbidden } = await strangerDb.storage.from("proofs").createSignedUrl(path, 60);
    expect(forbidden).toBeNull();
  });

  it("the winner cannot approve their own claim", async () => {
    await expect(asWinner.review(verificationId, true, "")).rejects.toBeInstanceOf(Error);
    expect((await asWinner.getWinning(winner.id, verificationId)).review).toBe("submitted");
  });

  it("admin rejects with a reason → the winner sees it and may upload once more", async () => {
    const rejected = await asAdmin.review(
      verificationId,
      false,
      "The date on the screenshot is wrong.",
    );
    expect(rejected.review).toBe("rejected");
    const seen = await asWinner.getWinning(winner.id, verificationId);
    expect(seen.reviewNote).toBe("The date on the screenshot is wrong.");
    const again = await asWinner.submitProof(winner.id, verificationId, png());
    expect(again).toMatchObject({ review: "submitted", resubmissions: 1 });
  });

  it("approve → the winner claims the payout; a stranger and the admin are refused", async () => {
    await asAdmin.review(verificationId, true, "");
    await expect(
      new SupabaseWinnerRepository(strangerDb).claimPayout(verificationId, "seed", "x"),
    ).rejects.toBeInstanceOf(Error);
    await expect(
      new SupabaseWinnerRepository(adminDb).claimPayout(verificationId, "seed", "x"),
    ).rejects.toBeInstanceOf(Error);
    const paid = await new SupabaseWinnerRepository(winnerDb).claimPayout(
      verificationId,
      "stripe_credit",
      "cbtxn_test_1",
    );
    expect(paid).toMatchObject({
      payout: "paid",
      payoutMethod: "stripe_credit",
      payoutReference: "cbtxn_test_1",
    });
    const summary = summariseWinnings(await asWinner.listWinnings(winner.id));
    expect(summary).toEqual({
      totalWonPaise: 7_485,
      paidPaise: 7_485,
      awaitingPayoutPaise: 0,
      unverifiedCount: 0,
    });
    await expect(asWinner.submitProof(winner.id, verificationId, png())).rejects.toBeInstanceOf(
      RuleViolationError,
    );
    const { data: report } = await adminDb
      .from("reports_summary")
      .select("prizes_paid_paise")
      .single();
    expect(report!.prizes_paid_paise).toBeGreaterThanOrEqual(7_485);
  });

  it("the admin queue lists the claim with the member's name", async () => {
    const queue = await asAdmin.listQueue();
    const row = queue.find((c) => c.verificationId === verificationId);
    expect(row).toMatchObject({ email: winner.email, review: "approved", payout: "paid" });
  });
});
