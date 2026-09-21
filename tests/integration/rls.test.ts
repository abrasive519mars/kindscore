import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anon,
  CHARITY,
  clientAs,
  createUser,
  deleteUser,
  grantActiveSubscription,
  type Db,
  type TestUser,
} from "./setup";

let member: TestUser;
let other: TestUser;
let adminUser: TestUser;
let asMember: Db;
let asOther: Db;
let asAdmin: Db;
let draftDrawId: string;

beforeAll(async () => {
  [member, other, adminUser] = await Promise.all([
    createUser("member", CHARITY.udaan),
    createUser("member"),
    createUser("admin"),
  ]);
  await grantActiveSubscription(member.id);
  await grantActiveSubscription(other.id);
  [asMember, asOther, asAdmin] = await Promise.all([
    clientAs(member),
    clientAs(other),
    clientAs(adminUser),
  ]);

  await admin.from("scores").insert([
    { user_id: member.id, score: 30, played_on: "2026-09-01" },
    { user_id: other.id, score: 35, played_on: "2026-09-01" },
  ]);
  const { data: draw, error } = await admin
    .from("draws")
    .insert({ draw_month: "2026-10-01" })
    .select("id")
    .single();
  if (error) throw error;
  draftDrawId = draw.id;
});

afterAll(async () => {
  await admin.from("draws").delete().eq("id", draftDrawId);
  await Promise.all([member, other, adminUser].map(deleteUser));
});

describe("anonymous visitor", () => {
  it("can read the active charity directory", async () => {
    const { data, error } = await anon.from("charities").select("slug").order("slug");
    expect(error).toBeNull();
    expect(data!.map((c) => c.slug)).toContain("udaan-girls-sports");
  });

  it.each(["scores", "subscriptions", "profiles", "payments", "charity_contributions"] as const)(
    "sees nothing in %s",
    async (table) => {
      const { data, error } = await anon.from(table).select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it("cannot see a draft draw", async () => {
    const { data } = await anon.from("draws").select("id").eq("id", draftDrawId);
    expect(data).toEqual([]);
  });
});

describe("member", () => {
  it("reads their own profile only", async () => {
    const { data } = await asMember.from("profiles").select("id, charity_id");
    expect(data).toHaveLength(1);
    expect(data![0]).toEqual({ id: member.id, charity_id: CHARITY.udaan });
  });

  it("reads their own scores and not another member's", async () => {
    const { data } = await asMember.from("scores").select("user_id");
    expect(data).toHaveLength(1);
    expect(data![0].user_id).toBe(member.id);
  });

  it("cannot promote themselves to admin", async () => {
    const { error } = await asMember.from("profiles").update({ role: "admin" }).eq("id", member.id);
    expect(error).not.toBeNull();
    const { data } = await admin.from("profiles").select("role").eq("id", member.id).single();
    expect(data!.role).toBe("member");
  });

  it("can change their charity choice", async () => {
    const { error } = await asMember
      .from("profiles")
      .update({ charity_bps: 1500 })
      .eq("id", member.id);
    expect(error).toBeNull();
  });

  it("cannot insert a subscription for themselves", async () => {
    const { error } = await asMember.from("subscriptions").insert({
      user_id: member.id,
      stripe_subscription_id: "sub_forged",
      stripe_price_id: "price_x",
      plan_interval: "month",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("cannot see a draft draw", async () => {
    const { data } = await asMember.from("draws").select("id").eq("id", draftDrawId);
    expect(data).toEqual([]);
  });

  it("cannot call the admin draw RPC", async () => {
    const { error } = await asMember.rpc("publish_draw", { p_draw_id: draftDrawId });
    expect(error?.code).toBe("42501");
  });

  it("cannot delete another member's score", async () => {
    const { data: before } = await admin.from("scores").select("id").eq("user_id", other.id);
    await asMember.from("scores").delete().eq("user_id", other.id);
    const { data: after } = await admin.from("scores").select("id").eq("user_id", other.id);
    expect(after).toHaveLength(before!.length);
  });
});

describe("admin", () => {
  it("reads every member's scores", async () => {
    const { data } = await asAdmin.from("scores").select("user_id");
    const owners = new Set(data!.map((s) => s.user_id));
    expect(owners.has(member.id) && owners.has(other.id)).toBe(true);
  });

  it("sees draft draws and all subscriptions", async () => {
    const { data: draws } = await asAdmin.from("draws").select("id").eq("id", draftDrawId);
    expect(draws).toHaveLength(1);
    const { data: subs } = await asAdmin.from("subscriptions").select("user_id");
    expect(subs!.length).toBeGreaterThanOrEqual(2);
  });

  it("reads the reporting views", async () => {
    const { data, error } = await asAdmin.from("reports_summary").select("*").single();
    expect(error).toBeNull();
    expect(data!.active_subscribers).toBeGreaterThanOrEqual(2);
  });
});

describe("other member", () => {
  it("does not see the first member's data through the same policies", async () => {
    const { data } = await asOther.from("scores").select("user_id");
    expect(data!.every((s) => s.user_id === other.id)).toBe(true);
  });
});
