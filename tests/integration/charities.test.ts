import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseCharityMediaStorage } from "@/lib/storage/SupabaseCharityMediaStorage";
import { SupabaseCharityRepository } from "@/repositories/supabase/SupabaseCharityRepository";
import { SupabaseDonationRepository } from "@/repositories/supabase/SupabaseDonationRepository";
import { SupabaseProfileRepository } from "@/repositories/supabase/SupabaseProfileRepository";
import { CharityService } from "@/services/CharityService";
import { MemberCharityService } from "@/services/MemberCharityService";
import {
  admin,
  anon,
  CHARITY,
  clientAs,
  createUser,
  deleteUser,
  PG,
  type Db,
  type TestUser,
} from "./setup";

const PNG_1x1 = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

let adminUser: TestUser;
let member: TestUser;
let adminDb: Db;
let memberDb: Db;
let createdCharityId: string;
let uploadedPath: string | null = null;

function charityServiceOn(db: Db) {
  return new CharityService(new SupabaseCharityRepository(db), new SupabaseCharityMediaStorage(db));
}

beforeAll(async () => {
  [adminUser, member] = await Promise.all([
    createUser("admin"),
    createUser("member", CHARITY.sahajShiksha),
  ]);
  [adminDb, memberDb] = await Promise.all([clientAs(adminUser), clientAs(member)]);
});

afterAll(async () => {
  if (uploadedPath) await admin.storage.from("charity-media").remove([uploadedPath]);
  if (createdCharityId) await admin.from("charities").delete().eq("id", createdCharityId);
  await Promise.all([adminUser, member].map(deleteUser));
});

describe("public directory", () => {
  it("a visitor sees the seven active seed charities with totals, and can open a profile", async () => {
    const { charities, categories } = await charityServiceOn(anon).directory({});
    expect(charities.length).toBeGreaterThanOrEqual(7);
    expect(charities.every((c) => c.isActive)).toBe(true);
    expect(categories).toContain("Education");
    const profile = await charityServiceOn(anon).profile("udaan-girls-sports");
    expect(profile.charity.featuredRank).toBe(1);
    expect(profile.media.length).toBeGreaterThanOrEqual(1);
    expect(profile.events.length).toBeGreaterThanOrEqual(1);
  });

  it("search narrows the directory", async () => {
    const { charities } = await charityServiceOn(anon).directory({ query: "water" });
    expect(charities.map((c) => c.slug)).toEqual(["neer-jal"]);
  });
});

describe("member choice", () => {
  it("changes charity and share through RLS; the check constraint refuses an out-of-range share", async () => {
    const service = new MemberCharityService(
      new SupabaseProfileRepository(memberDb),
      new SupabaseCharityRepository(memberDb),
      new SupabaseDonationRepository(memberDb),
    );
    await service.updateChoice(member.id, CHARITY.udaan, 2500);
    const state = await service.current(member.id);
    expect(state.profile).toMatchObject({ charityId: CHARITY.udaan, charityBps: 2500 });
    expect(state.charity?.slug).toBe("udaan-girls-sports");

    const { error } = await memberDb
      .from("profiles")
      .update({ charity_bps: 7100 })
      .eq("id", member.id);
    expect(error?.code).toBe(PG.checkViolation);
  });
});

describe("donations", () => {
  const donationId = crypto.randomUUID();

  it("the member opens an unpaid donation on their own client", async () => {
    const repo = new SupabaseDonationRepository(memberDb);
    const row = await repo.create({
      id: donationId,
      userId: member.id,
      charityId: CHARITY.udaan,
      amountPaise: 25_000,
      stripeCheckoutSessionId: `cs_test_${donationId}`,
    });
    expect(row.paid).toBe(false);
    const { error } = await memberDb.from("donations").update({ paid: true }).eq("id", donationId);
    const { data } = await admin.from("donations").select("paid").eq("id", donationId).single();
    expect(error === null ? data!.paid : false).toBe(false); // no update policy: silently zero rows, still unpaid
  });

  it("the service role marks it paid once; the ledger and totals follow", async () => {
    const before = (await charityServiceOn(anon).profile("udaan-girls-sports")).totals.totalPaise;
    const repo = new SupabaseDonationRepository(admin);
    expect(await repo.markPaid(donationId)).toBe("paid");
    expect(await repo.markPaid(donationId)).toBe("already_paid");
    const { data: ledger } = await admin
      .from("charity_contributions")
      .select("source, amount_paise")
      .eq("donation_id", donationId);
    expect(ledger).toEqual([{ source: "donation", amount_paise: 25_000 }]);
    const after = (await charityServiceOn(anon).profile("udaan-girls-sports")).totals.totalPaise;
    expect(after - before).toBe(25_000);
    const mine = await new SupabaseDonationRepository(memberDb).listContributionsForUser(member.id);
    expect(mine.find((c) => c.source === "donation")).toMatchObject({
      amountPaise: 25_000,
      charityName: "Udaan Girls' Sports Collective",
    });
  });
});

describe("admin management", () => {
  const input = {
    name: "Integration Test Trust",
    tagline: "Temporary.",
    description: "Created by tests.",
    category: "Test",
    city: "Nowhere",
    outcomeLine: "₹50 a month = one test",
    websiteUrl: null,
  };

  it("creates a charity with an event and a cover upload; a visitor cannot upload", async () => {
    const service = charityServiceOn(adminDb);
    const created = await service.saveCharity(input);
    createdCharityId = created.id;
    expect(created.slug).toBe("integration-test-trust");
    await service.saveEvent({
      charityId: created.id,
      title: "Open day",
      description: "",
      startsAt: "2027-01-10T04:30:00Z",
      location: "Nowhere",
    });
    await service.uploadMedia(
      created.id,
      "cover",
      new File([PNG_1x1], "cover.png", { type: "image/png" }),
      "",
    );
    const profile = await service.profileById(created.id, new Date("2026-09-22T00:00:00Z"));
    uploadedPath = profile.charity.coverPath;
    expect(uploadedPath).toMatch(new RegExp(`^${created.id}/cover-\\d+\\.png$`));
    expect(profile.events).toHaveLength(1);

    const { error } = await anon.storage
      .from("charity-media")
      .upload("hack/cover.png", PNG_1x1, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("a member cannot edit charities", async () => {
    const { data } = await memberDb
      .from("charities")
      .update({ name: "Hacked" })
      .eq("id", createdCharityId)
      .select("id");
    expect(data).toEqual([]);
  });

  it("featured is exactly one; hiding removes it from the public directory but not from the admin", async () => {
    const service = charityServiceOn(adminDb);
    await service.setFeatured(createdCharityId);
    const all = await new SupabaseCharityRepository(adminDb).listAll();
    expect(all.filter((c) => c.featuredRank === 1).map((c) => c.id)).toEqual([createdCharityId]);
    await service.setFeatured(CHARITY.udaan); // restore the seed spotlight

    expect(await service.deactivate(createdCharityId)).toBe(0);
    expect((await charityServiceOn(anon).directory({})).charities.map((c) => c.id)).not.toContain(
      createdCharityId,
    );
    expect((await service.directory({}, true)).charities.map((c) => c.id)).toContain(
      createdCharityId,
    );
  });
});
