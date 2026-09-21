import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, CHARITY, createUser, deleteUser, PG, type TestUser } from "./setup";

let member: TestUser;

beforeAll(async () => {
  member = await createUser("member", CHARITY.sahajShiksha);
});

afterAll(async () => {
  await deleteUser(member);
});

async function ledgerFor(userId: string) {
  const { data } = await admin.from("charity_contributions").select("source, amount_paise, charity_id").eq("user_id", userId);
  return data!;
}

describe("payments → ledger (trigger record_payment_contribution)", () => {
  it("writes exactly one contribution row for the charity slice", async () => {
    const { error } = await admin.from("payments").insert({
      user_id: member.id,
      stripe_invoice_id: `in_${member.id}`,
      amount_paise: 49_900,
      charity_id: CHARITY.sahajShiksha,
      charity_bps: 1_000,
      charity_paise: 4_990,
      pool_paise: 14_970,
      platform_paise: 29_940,
    });
    expect(error).toBeNull();
    expect(await ledgerFor(member.id)).toEqual([
      { source: "subscription", amount_paise: 4_990, charity_id: CHARITY.sahajShiksha },
    ]);
  });

  it("refuses a payment whose three parts do not sum to the amount", async () => {
    const { error } = await admin.from("payments").insert({
      user_id: member.id,
      stripe_invoice_id: `in_bad_${member.id}`,
      amount_paise: 49_900,
      charity_id: CHARITY.sahajShiksha,
      charity_bps: 1_000,
      charity_paise: 4_990,
      pool_paise: 14_970,
      platform_paise: 1,
    });
    expect(error?.code).toBe(PG.checkViolation);
  });

  it("refuses the same Stripe invoice twice", async () => {
    const { error } = await admin.from("payments").insert({
      user_id: member.id,
      stripe_invoice_id: `in_${member.id}`,
      amount_paise: 49_900,
      charity_id: CHARITY.sahajShiksha,
      charity_bps: 1_000,
      charity_paise: 4_990,
      pool_paise: 14_970,
      platform_paise: 29_940,
    });
    expect(error?.code).toBe(PG.uniqueViolation);
  });
});

describe("donations → ledger (trigger record_donation_contribution)", () => {
  it("reaches the ledger only when paid flips true, and only once", async () => {
    const { data: donation } = await admin
      .from("donations")
      .insert({ user_id: member.id, charity_id: CHARITY.sahajShiksha, amount_paise: 25_000, stripe_checkout_session_id: `cs_${member.id}` })
      .select("id")
      .single();

    expect((await ledgerFor(member.id)).filter((r) => r.source === "donation")).toHaveLength(0);

    await admin.from("donations").update({ paid: true }).eq("id", donation!.id);
    await admin.from("donations").update({ paid: true }).eq("id", donation!.id); // webhook replay

    const donations = (await ledgerFor(member.id)).filter((r) => r.source === "donation");
    expect(donations).toEqual([{ source: "donation", amount_paise: 25_000, charity_id: CHARITY.sahajShiksha }]);
  });
});

describe("charity_totals view", () => {
  it("sums the ledger per charity", async () => {
    const { data } = await admin.from("charity_totals").select("*").eq("charity_id", CHARITY.sahajShiksha).single();
    expect(data!.total_paise).toBeGreaterThanOrEqual(4_990 + 25_000);
    expect(data!.contributor_count).toBeGreaterThanOrEqual(1);
  });
});
