import { beforeEach, describe, expect, it } from "vitest";
import { PROOF_UPLOAD } from "@/config/constants";
import { NotFoundError, RuleViolationError, ValidationError } from "@/engine/errors";
import { summariseWinnings, WinnerService } from "@/services/WinnerService";
import { claim, FakeProofStorage, FakeWinnerRepository, pngFile } from "../../fakes/winners";

let repo: FakeWinnerRepository;
let storage: FakeProofStorage;
let service: WinnerService;

beforeEach(() => {
  repo = new FakeWinnerRepository();
  storage = new FakeProofStorage();
  service = new WinnerService(repo, storage);
  repo.rows = [claim()];
});

describe("submitProof", () => {
  it("uploads to {userId}/{verificationId}.{ext} and moves the claim to submitted", async () => {
    const updated = await service.submitProof("user-1", "ver-1", pngFile());
    expect(storage.uploads).toEqual([{ path: "user-1/ver-1.png", size: 1024, type: "image/png" }]);
    expect(updated).toMatchObject({ review: "submitted", proofPath: "user-1/ver-1.png" });
  });

  it("uses the extension of the type, not the file name", async () => {
    await service.submitProof("user-1", "ver-1", pngFile(10, "image/jpeg"));
    expect(storage.uploads[0].path).toBe("user-1/ver-1.jpg");
  });

  it("refuses the wrong type and uploads nothing", async () => {
    await expect(service.submitProof("user-1", "ver-1", pngFile(10, "image/gif"))).rejects.toBeInstanceOf(ValidationError);
    expect(storage.uploads).toEqual([]);
    expect(repo.rows[0].review).toBe("awaiting_proof");
  });

  it("refuses an oversized file and uploads nothing", async () => {
    await expect(service.submitProof("user-1", "ver-1", pngFile(PROOF_UPLOAD.MAX_BYTES + 1))).rejects.toThrow(/Max 5 MB/);
    expect(storage.uploads).toEqual([]);
  });

  it("refuses another member's claim as not found — no hint that it exists", async () => {
    await expect(service.submitProof("user-2", "ver-1", pngFile())).rejects.toBeInstanceOf(NotFoundError);
    expect(storage.uploads).toEqual([]);
  });

  it("refuses an illegal state before uploading", async () => {
    repo.rows = [claim({ review: "approved" })];
    await expect(service.submitProof("user-1", "ver-1", pngFile())).rejects.toBeInstanceOf(RuleViolationError);
    expect(storage.uploads).toEqual([]);
  });

  it("allows exactly one resubmission after a rejection", async () => {
    await service.submitProof("user-1", "ver-1", pngFile());
    await service.review("ver-1", false, "Blurry");
    const again = await service.submitProof("user-1", "ver-1", pngFile());
    expect(again).toMatchObject({ review: "submitted", resubmissions: 1 });
    await service.review("ver-1", false, "Still blurry");
    await expect(service.submitProof("user-1", "ver-1", pngFile())).rejects.toBeInstanceOf(RuleViolationError);
    expect(storage.uploads).toHaveLength(2);
  });
});

describe("review and payout", () => {
  beforeEach(async () => {
    await service.submitProof("user-1", "ver-1", pngFile());
  });

  it("approves, then marks paid", async () => {
    expect((await service.review("ver-1", true, "")).review).toBe("approved");
    expect(await service.markPaid("ver-1")).toMatchObject({ payout: "paid", paidAt: expect.any(String) });
  });

  it("rejecting needs a reason the member will see", async () => {
    await expect(service.review("ver-1", false, "   ")).rejects.toBeInstanceOf(ValidationError);
    const rejected = await service.review("ver-1", false, "  Screenshot shows a different date  ");
    expect(rejected).toMatchObject({ review: "rejected", reviewNote: "Screenshot shows a different date" });
  });

  it("keeps notes under the limit", async () => {
    await expect(service.review("ver-1", false, "x".repeat(201))).rejects.toThrow(/200/);
  });

  it("cannot mark paid before approval", async () => {
    await expect(service.markPaid("ver-1")).rejects.toBeInstanceOf(RuleViolationError);
  });
});

describe("summariseWinnings", () => {
  it("counts approved wins only, split into paid and awaiting payout", () => {
    const summary = summariseWinnings([
      claim({ verificationId: "a", review: "approved", payout: "paid", prizePaise: 100 }),
      claim({ verificationId: "b", review: "approved", payout: "pending", prizePaise: 250 }),
      claim({ verificationId: "c", review: "submitted", prizePaise: 1_000 }),
      claim({ verificationId: "d", review: "awaiting_proof", prizePaise: 1_000 }),
      claim({ verificationId: "e", review: "rejected", prizePaise: 1_000 }),
    ]);
    expect(summary).toEqual({ totalWonPaise: 350, paidPaise: 100, awaitingPayoutPaise: 250, unverifiedCount: 2 });
  });

  it("is all zeros for a member who never won", () => {
    expect(summariseWinnings([])).toEqual({ totalWonPaise: 0, paidPaise: 0, awaitingPayoutPaise: 0, unverifiedCount: 0 });
  });
});
