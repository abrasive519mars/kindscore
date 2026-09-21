import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, RuleViolationError } from "@/engine/errors";
import type { ScoreEntry } from "@/engine/scores/latestFive";
import type { ScoreRepository, ScoreWrite } from "@/repositories/interfaces/ScoreRepository";
import { ScoreService } from "@/services/ScoreService";

/** In-memory repository: proves the service's orchestration without a database. */
class FakeScoreRepository implements ScoreRepository {
  rows: ScoreEntry[] = [];
  inserts = 0;
  private seq = 0;

  async listForUser(): Promise<ScoreEntry[]> {
    return [...this.rows].sort((a, b) => b.playedOn.localeCompare(a.playedOn));
  }
  async insert(_userId: string, write: ScoreWrite): Promise<ScoreEntry> {
    this.inserts++;
    const entry = { id: `r${++this.seq}`, score: write.score, playedOn: write.playedOn, createdAt: `${write.playedOn}T10:00:00Z` };
    this.rows.push(entry);
    return entry;
  }
  async update(_userId: string, id: string, write: ScoreWrite): Promise<ScoreEntry> {
    const index = this.rows.findIndex((r) => r.id === id);
    this.rows[index] = { ...this.rows[index], ...write };
    return this.rows[index];
  }
  async delete(_userId: string, id: string): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}

let repo: FakeScoreRepository;
let service: ScoreService;

beforeEach(async () => {
  repo = new FakeScoreRepository();
  service = new ScoreService(repo);
  for (const playedOn of ["2026-09-01", "2026-09-05", "2026-09-10", "2026-09-15", "2026-09-20"]) {
    await repo.insert("u1", { score: 30, playedOn });
  }
});

describe("add", () => {
  it("inserts and names the round that got evicted", async () => {
    const result = await service.add("u1", { score: 35, playedOn: "2026-09-25" });
    expect(repo.inserts).toBe(6);
    expect(result.entry.playedOn).toBe("2026-09-25");
    expect(result.evicted?.playedOn).toBe("2026-09-01");
  });

  it("evicts by date played, not insert order, when backdating inside the window", async () => {
    const result = await service.add("u1", { score: 35, playedOn: "2026-09-12" });
    expect(result.evicted?.playedOn).toBe("2026-09-01");
  });

  it("returns no eviction when there is room", async () => {
    await repo.delete("u1", "r1");
    const result = await service.add("u1", { score: 35, playedOn: "2026-09-25" });
    expect(result.evicted).toBeNull();
  });

  it("refuses a duplicate date before touching storage", async () => {
    await expect(service.add("u1", { score: 40, playedOn: "2026-09-10" })).rejects.toThrow(ConflictError);
    expect(repo.inserts).toBe(5);
  });

  it("refuses a round older than the five kept, before touching storage", async () => {
    await expect(service.add("u1", { score: 40, playedOn: "2026-08-20" })).rejects.toThrow(RuleViolationError);
    expect(repo.inserts).toBe(5);
  });
});

describe("update", () => {
  it("changes score and date of an owned round", async () => {
    const updated = await service.update("u1", "r3", { score: 41, playedOn: "2026-09-11" });
    expect(updated).toMatchObject({ id: "r3", score: 41, playedOn: "2026-09-11" });
  });

  it("allows keeping the same date", async () => {
    await expect(service.update("u1", "r3", { score: 41, playedOn: "2026-09-10" })).resolves.toBeDefined();
  });

  it("refuses moving onto a date another round already has", async () => {
    await expect(service.update("u1", "r3", { score: 41, playedOn: "2026-09-15" })).rejects.toThrow(ConflictError);
  });

  it("refuses an unknown or foreign id", async () => {
    await expect(service.update("u1", "nope", { score: 41, playedOn: "2026-09-11" })).rejects.toThrow(NotFoundError);
  });
});

describe("remove", () => {
  it("deletes an owned round", async () => {
    await service.remove("u1", "r5");
    expect(await service.list("u1")).toHaveLength(4);
  });

  it("refuses an unknown id", async () => {
    await expect(service.remove("u1", "nope")).rejects.toThrow(NotFoundError);
  });
});

describe("list", () => {
  it("returns newest first and never more than five", async () => {
    repo.rows.push({ id: "extra", score: 30, playedOn: "2026-08-01", createdAt: "" });
    const list = await service.list("u1");
    expect(list).toHaveLength(5);
    expect(list[0].playedOn).toBe("2026-09-20");
    expect(list.some((e) => e.id === "extra")).toBe(false);
  });
});
