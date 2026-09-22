import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, RuleViolationError } from "@/engine/errors";
import { buildFrequencyMap } from "@/engine/draw/frequency";
import { generateNumbers, weightsFromHolders } from "@/engine/draw/generateNumbers";
import { sequenceRng } from "@/engine/draw/rng";
import { DrawService, STALE_MESSAGE } from "@/services/DrawService";
import { candidate, FakeDrawRepository } from "../../fakes/draws";

/** rng that always returns 0 picks the lowest remaining number each time → 1, 2, 3, 4, 5. */
const zeros = () => sequenceRng([0, 0, 0, 0, 0]);

let repo: FakeDrawRepository;
let service: DrawService;

beforeEach(() => {
  repo = new FakeDrawRepository();
  service = new DrawService(repo);
  repo.candidates = [
    candidate("a-jackpot", [1, 2, 3, 4, 5]),
    candidate("b-three", [1, 2, 3, 40, 41]),
    candidate("c-two", [1, 2, 30, 31, 32]),
    candidate("d-four-scores", [10, 11, 12, 13]),
    candidate("e-yearly", [20, 21, 22, 23, 24], "year"),
  ];
  repo.rolloverIn = 1_000;
});

describe("openNextDraw", () => {
  it("creates this month's draft when nothing was ever published", async () => {
    const draw = await service.openNextDraw(new Date("2026-09-21T10:00:00+05:30"));
    expect(draw).toMatchObject({ drawMonth: "2026-09-01", status: "draft" });
  });

  it("returns the open draw instead of creating another", async () => {
    const first = await service.openNextDraw();
    const second = await service.openNextDraw();
    expect(second.id).toBe(first.id);
    expect(repo.draws).toHaveLength(1);
  });

  it("opens the month after the last published draw once that month has begun", async () => {
    const draw = await repo.create("2026-09-01");
    await repo.saveSimulation(simulationOf(draw.id));
    await repo.publish(draw.id);
    await expect(
      service.openNextDraw(new Date("2026-09-25T10:00:00+05:30")),
    ).rejects.toBeInstanceOf(RuleViolationError);
    const next = await service.openNextDraw(new Date("2026-10-02T10:00:00+05:30"));
    expect(next.drawMonth).toBe("2026-10-01");
  });
});

describe("simulate", () => {
  it("records the weighting strength the admin chose alongside the mode", async () => {
    const draw = await service.openNextDraw();
    const report = await service.simulate(draw.id, "algorithmic", zeros(), 5_000);
    expect(report.draw.weightStrengthBps).toBe(5_000);
    expect(repo.simulations[0]).toMatchObject({ mode: "algorithmic", weightStrengthBps: 5_000 });
  });

  it("draws with the engine, snapshots eligible entries and allocates prizes exactly", async () => {
    const draw = await service.openNextDraw();
    const report = await service.simulate(draw.id, "random", zeros());

    const expectedNumbers = generateNumbers("random", buildFrequencyMap([]), zeros());
    expect(report.draw.numbers).toEqual(expectedNumbers);
    expect(report.draw.numbers).toEqual([1, 2, 3, 4, 5]);
    expect(report.eligibleCount).toBe(4);
    expect(report.ineligibleCount).toBe(1);

    // Pool: everyone active funds it — 4 monthly × 14,970 + 1 yearly × 12,497.
    expect(report.draw.poolPaise).toBe(72_377);
    expect(report.draw.activeSubscriberCount).toBe(5);
    expect(report.draw.tierPools).toEqual({ 5: 29_952, 4: 25_331, 3: 18_094 });
    expect(report.prizes).toEqual([
      { userId: "a-jackpot", tier: 5, prizePaise: 29_952 },
      { userId: "b-three", tier: 3, prizePaise: 18_094 },
    ]);
    expect(report.draw.rolloverOutPaise).toBe(0);
    expect(report.draw.unclaimedRetainedPaise).toBe(25_331);
    expect(report.draw.status).toBe("simulated");
  });

  it("stores every eligible entry with its match count, and only winners as results", async () => {
    const draw = await service.openNextDraw();
    await service.simulate(draw.id, "random", zeros());
    const write = repo.simulations[0];
    expect(write.entries.map((e) => [e.userId, e.matchCount])).toEqual([
      ["a-jackpot", 5],
      ["b-three", 3],
      ["c-two", 2],
      ["e-yearly", 0],
    ]);
    expect(write.results.map((r) => r.userId)).toEqual(["a-jackpot", "b-three"]);
    expect(write.entriesHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("with nobody eligible, the jackpot rolls over and the other tiers are retained", async () => {
    repo.candidates = [candidate("d-four-scores", [10, 11, 12, 13])];
    const draw = await service.openNextDraw();
    const report = await service.simulate(draw.id, "algorithmic", zeros());
    expect(report.eligibleCount).toBe(0);
    expect(report.draw.poolPaise).toBe(14_970);
    expect(report.draw.rolloverOutPaise).toBe(report.draw.tierPools[5]);
    expect(report.draw.unclaimedRetainedPaise).toBe(
      report.draw.tierPools[4] + report.draw.tierPools[3],
    );
    expect(report.prizes).toEqual([]);
  });

  it("re-simulating replaces the draft", async () => {
    const draw = await service.openNextDraw();
    await service.simulate(draw.id, "random", zeros());
    const again = await service.simulate(
      draw.id,
      "algorithmic",
      sequenceRng([0.9, 0.9, 0.9, 0.9, 0.9]),
    );
    expect(again.draw.mode).toBe("algorithmic");
    expect(again.draw.numbers).not.toEqual([1, 2, 3, 4, 5]);
    expect(repo.draws).toHaveLength(1);
  });

  it("refuses to simulate a published draw or a missing one", async () => {
    const draw = await service.openNextDraw();
    await service.simulate(draw.id, "random", zeros());
    await service.publish(draw.id);
    await expect(service.simulate(draw.id, "random", zeros())).rejects.toBeInstanceOf(
      RuleViolationError,
    );
    await expect(service.simulate("nope", "random", zeros())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("freshness and publish", () => {
  it("a draft is fresh until an eligible member's scores change", async () => {
    const draw = await service.openNextDraw();
    const { draw: simulated } = await service.simulate(draw.id, "random", zeros());
    expect(await service.checkFreshness(simulated)).toEqual({ stale: false });

    repo.candidates[1] = candidate("b-three", [1, 2, 3, 40, 42]);
    expect(await service.checkFreshness(simulated)).toEqual({ stale: true });
  });

  it("an ineligible member's change does not make the draft stale", async () => {
    const draw = await service.openNextDraw();
    const { draw: simulated } = await service.simulate(draw.id, "random", zeros());
    repo.candidates[3] = candidate("d-four-scores", [10, 11, 12, 14]);
    expect(await service.checkFreshness(simulated)).toEqual({ stale: false });
  });

  it("a funder lapsing makes the draft stale even though no ticket changed", async () => {
    const draw = await service.openNextDraw();
    const { draw: simulated } = await service.simulate(draw.id, "random", zeros());
    repo.candidates = repo.candidates.filter((c) => c.userId !== "d-four-scores");
    expect(await service.checkFreshness(simulated)).toEqual({ stale: true });
  });

  it("every winner in a tier is paid from that tier's pool, and the tier is paid out in full", async () => {
    repo.candidates = [
      candidate("a", [1, 2, 3, 4, 5]),
      candidate("b", [1, 2, 3, 4, 6]),
      candidate("c", [1, 2, 3, 40, 41]),
      candidate("d", [1, 2, 3, 42, 43]),
    ];
    const draw = await service.openNextDraw();
    const { draw: simulated, prizes } = await service.simulate(draw.id, "random", zeros());
    for (const tier of [5, 4, 3] as const) {
      const paid = prizes.filter((p) => p.tier === tier).reduce((s, p) => s + p.prizePaise, 0);
      expect(paid).toBe(simulated.tierPools[tier]);
    }
  });

  it("publish refuses a bare draft, refuses a stale draft, and passes a fresh one", async () => {
    const draw = await service.openNextDraw();
    await expect(service.publish(draw.id)).rejects.toThrow("Simulate first.");

    await service.simulate(draw.id, "random", zeros());
    repo.candidates.push(candidate("f-new", [5, 6, 7, 8, 9]));
    await expect(service.publish(draw.id)).rejects.toThrow(STALE_MESSAGE);

    await service.simulate(draw.id, "random", zeros());
    const published = await service.publish(draw.id);
    expect(published.status).toBe("published");
  });

  it("publishing twice returns the published draw unchanged", async () => {
    const draw = await service.openNextDraw();
    await service.simulate(draw.id, "random", zeros());
    const first = await service.publish(draw.id);
    const second = await service.publish(draw.id);
    expect(second).toEqual(first);
  });
});

describe("describeHolders", () => {
  it("counts eligible holders per number, index = the number", () => {
    const holders = service.describeHolders(repo.candidates);
    expect(holders).toHaveLength(46); // 0 unused
    expect(holders[1]).toBe(3); // 1 is held by a, b and c
    expect(holders[10]).toBe(0); // 10 is held only by the ineligible member
  });

  it("feeds the same weights the draw uses: flat in random, holders-shaped in algorithmic", () => {
    const holders = service.describeHolders(repo.candidates);
    expect(
      weightsFromHolders("random", holders)
        .slice(1)
        .every((w) => w === 1),
    ).toBe(true);
    const weighted = weightsFromHolders("algorithmic", holders);
    expect(weighted[1]).toBeGreaterThan(weighted[45]);
    expect(weighted[45]).toBeGreaterThan(0);
  });
});

describe("projectedJackpot", () => {
  it("is 40% of the counts-based pool plus the carried rollover", async () => {
    repo.counts = { month: 200, year: 100 };
    repo.rolloverIn = 50_000;
    // pool = 200 × 14,970 + 100 × 12,497 = 4,243,700; four 1,485,295; three 1,060,925; jackpot = rest + 50,000
    expect(await service.projectedJackpot()).toBe(4_243_700 - 1_485_295 - 1_060_925 + 50_000);
  });
});

function simulationOf(drawId: string) {
  return {
    drawId,
    mode: "random" as const,
    weightStrengthBps: 10_000,
    numbers: [1, 2, 3, 4, 5],
    activeSubscriberCount: 0,
    poolPaise: 0,
    rolloverInPaise: 0,
    tierPools: { 5: 0, 4: 0, 3: 0 },
    rolloverOutPaise: 0,
    unclaimedRetainedPaise: 0,
    entriesHash: "0",
    entries: [],
    results: [],
  };
}
