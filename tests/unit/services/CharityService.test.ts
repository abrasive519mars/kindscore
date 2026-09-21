import { beforeEach, describe, expect, it } from "vitest";
import { CHARITY_MEDIA } from "@/config/constants";
import { ConflictError, NotFoundError, RuleViolationError, ValidationError } from "@/engine/errors";
import { CharityService } from "@/services/CharityService";
import { MemberCharityService } from "@/services/MemberCharityService";
import { billingProfile, FakeProfileRepository } from "../../fakes/billing";
import {
  charity,
  FakeCharityMediaStorage,
  FakeCharityRepository,
  FakeDonationRepository,
  imageFile,
} from "../../fakes/charities";

let repo: FakeCharityRepository;
let storage: FakeCharityMediaStorage;
let service: CharityService;

const input = {
  name: "Roshni Netra Care",
  tagline: "Sight restored.",
  description: "Eye camps.",
  category: "Health",
  city: "Warangal",
  outcomeLine: "₹50 a month = twelve eye screenings",
  websiteUrl: null,
};

beforeEach(() => {
  repo = new FakeCharityRepository();
  storage = new FakeCharityMediaStorage();
  service = new CharityService(repo, storage);
  repo.charities = [
    charity({
      id: "c-1",
      slug: "neer-jal",
      name: "Neer Jal Trust",
      category: "Water",
      city: "Anantapur",
    }),
    charity({
      id: "c-2",
      slug: "sahaj",
      name: "Sahaj Shiksha",
      category: "Education",
      city: "Nalgonda",
      featuredRank: 1,
    }),
    charity({
      id: "c-3",
      slug: "hidden",
      name: "Hidden Trust",
      category: "Water",
      city: "Nalgonda",
      isActive: false,
    }),
  ];
  repo.totals = [{ charityId: "c-1", totalPaise: 12_000, contributorCount: 3 }];
});

describe("directory", () => {
  it("lists active charities with totals (zero when nobody has given yet) and the chip values", async () => {
    const { charities, categories, cities } = await service.directory({});
    expect(charities.map((c) => c.slug)).toEqual(["neer-jal", "sahaj"]);
    expect(charities[0].totals).toEqual({
      charityId: "c-1",
      totalPaise: 12_000,
      contributorCount: 3,
    });
    expect(charities[1].totals.totalPaise).toBe(0);
    expect(categories).toEqual(["Education", "Water"]);
    expect(cities).toEqual(["Anantapur", "Nalgonda"]);
  });

  it("filters, and lets the admin include hidden ones", async () => {
    expect((await service.directory({ category: "Water" })).charities.map((c) => c.slug)).toEqual([
      "neer-jal",
    ]);
    expect(
      (await service.directory({ category: "Water" }, true)).charities.map((c) => c.slug),
    ).toEqual(["neer-jal", "hidden"]);
  });

  it("names the featured charity", async () => {
    expect((await service.featured())?.slug).toBe("sahaj");
  });
});

describe("profile", () => {
  it("assembles media, upcoming events and totals", async () => {
    repo.media = [
      {
        id: "m1",
        charityId: "c-1",
        storagePath: "seed/neer-jal/gallery-1.webp",
        alt: "",
        sortOrder: 0,
      },
    ];
    repo.events = [
      {
        id: "e1",
        charityId: "c-1",
        title: "Past",
        description: "",
        startsAt: "2026-01-01T00:00:00Z",
        location: "",
      },
      {
        id: "e2",
        charityId: "c-1",
        title: "Soon",
        description: "",
        startsAt: "2026-12-01T00:00:00Z",
        location: "",
      },
    ];
    const profile = await service.profile("neer-jal", new Date("2026-09-22T00:00:00Z"));
    expect(profile.media).toHaveLength(1);
    expect(profile.events.map((e) => e.title)).toEqual(["Soon"]);
    expect(profile.totals.contributorCount).toBe(3);
    await expect(service.profile("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("admin", () => {
  it("creates with a slug from the name and refuses a duplicate", async () => {
    const created = await service.saveCharity(input);
    expect(created.slug).toBe("roshni-netra-care");
    await expect(service.saveCharity(input)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.saveCharity({ ...input, name: "  " })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("updates in place", async () => {
    const updated = await service.saveCharity(
      { ...input, name: "Neer Jal Trust", city: "Kadapa" },
      "c-1",
    );
    expect(updated).toMatchObject({ id: "c-1", city: "Kadapa" });
  });

  it("keeps exactly one featured charity", async () => {
    await service.setFeatured("c-1");
    expect(repo.charities.map((c) => c.featuredRank)).toEqual([1, null, null]);
  });

  it("soft-deletes and reports how many members still contribute", async () => {
    repo.subscribers.set("c-1", 12);
    expect(await service.deactivate("c-1")).toBe(12);
    expect((await service.directory({})).charities.map((c) => c.slug)).toEqual(["sahaj"]);
    await service.reactivate("c-1");
    expect((await service.directory({})).charities).toHaveLength(2);
  });

  it("uploads a cover to {charityId}/cover-*.webp and stores the path", async () => {
    await service.uploadMedia("c-1", "cover", imageFile(), "");
    expect(storage.uploads[0]).toMatch(/^c-1\/cover-\d+\.webp$/);
    expect(repo.charities[0].coverPath).toBe(storage.uploads[0]);
  });

  it("adds a gallery photo and removes it from storage too", async () => {
    await service.uploadMedia("c-1", "gallery", imageFile("image/png"), "Volunteers at a pump");
    const [item] = repo.media;
    expect(item).toMatchObject({ alt: "Volunteers at a pump" });
    await service.removeMedia("c-1", item.id);
    expect(repo.media).toEqual([]);
    expect(storage.removed).toEqual([item.storagePath]);
  });

  it("never deletes seed files from storage", async () => {
    repo.media = [
      {
        id: "m1",
        charityId: "c-1",
        storagePath: "seed/neer-jal/gallery-1.webp",
        alt: "",
        sortOrder: 0,
      },
    ];
    await service.removeMedia("c-1", "m1");
    expect(storage.removed).toEqual([]);
  });

  it("refuses the wrong type or an oversized image without uploading", async () => {
    await expect(
      service.uploadMedia("c-1", "cover", imageFile("image/gif"), ""),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.uploadMedia("c-1", "cover", imageFile("image/png", CHARITY_MEDIA.MAX_BYTES + 1), ""),
    ).rejects.toThrow(/Max 2 MB/);
    expect(storage.uploads).toEqual([]);
  });

  it("saves and deletes events", async () => {
    const event = await service.saveEvent({
      charityId: "c-1",
      title: "Camp",
      description: "",
      startsAt: "2026-12-01T03:00:00Z",
      location: "Warangal",
    });
    expect(repo.events).toHaveLength(1);
    await expect(service.saveEvent({ ...event, title: " " })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await service.deleteEvent(event.id);
    expect(repo.events).toEqual([]);
  });
});

describe("MemberCharityService", () => {
  let profiles: FakeProfileRepository;
  let member: MemberCharityService;

  beforeEach(() => {
    profiles = new FakeProfileRepository();
    profiles.profiles = [billingProfile({ id: "user-1", charityId: "c-1", charityBps: 1000 })];
    const donations = new FakeDonationRepository();
    donations.contributions = [
      {
        id: "l1",
        charityId: "c-1",
        charityName: "Neer Jal Trust",
        source: "subscription",
        amountPaise: 4_990,
        createdAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "l2",
        charityId: "c-1",
        charityName: "Neer Jal Trust",
        source: "donation",
        amountPaise: 25_000,
        createdAt: "2026-09-01T00:00:00Z",
      },
    ];
    member = new MemberCharityService(profiles, repo, donations);
  });

  it("reports the current charity and everything given", async () => {
    const state = await member.current("user-1");
    expect(state.charity?.slug).toBe("neer-jal");
    expect(state.totalGivenPaise).toBe(29_990);
    expect(state.contributions).toHaveLength(2);
  });

  it("changes charity and share within the rules", async () => {
    await member.updateChoice("user-1", "c-2", 2500);
    expect(profiles.profiles[0]).toMatchObject({ charityId: "c-2", charityBps: 2500 });
    await expect(member.updateChoice("user-1", "c-2", 7500)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(member.updateChoice("user-1", "c-2", 1250)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(member.updateChoice("user-1", "c-3", 1000)).rejects.toBeInstanceOf(
      RuleViolationError,
    );
    await expect(member.updateChoice("user-1", "nope", 1000)).rejects.toBeInstanceOf(NotFoundError);
  });
});
