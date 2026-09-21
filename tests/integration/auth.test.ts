import { afterAll, describe, expect, it } from "vitest";
import { admin, anon, CHARITY } from "./setup";

/**
 * The public signup path an evaluator will use: anon key, email + password + metadata.
 * Proves the handle_new_user trigger builds the profile from that metadata.
 */
const email = `signup-${crypto.randomUUID().slice(0, 8)}@kindscore.test`;
const password = "Kindscore!2026";
let userId: string | undefined;

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("public signup", () => {
  it("creates a confirmed user and a profile carrying the chosen charity and share", async () => {
    const { data, error } = await anon.auth.signUp({
      email,
      password,
      options: { data: { full_name: "Sign Up", charity_id: CHARITY.udaan, charity_bps: 2500 } },
    });
    expect(error).toBeNull();
    userId = data.user?.id;
    expect(data.session).not.toBeNull(); // confirmations are off: a session is issued immediately

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, charity_id, charity_bps, role")
      .eq("id", userId!)
      .single();
    expect(profile).toEqual({
      full_name: "Sign Up",
      charity_id: CHARITY.udaan,
      charity_bps: 2500,
      role: "member",
    });
  });

  it("refuses the same email twice", async () => {
    const { data, error } = await anon.auth.signUp({ email, password });
    // GoTrue either errors or returns an obfuscated user with no identities; both mean "no second account"
    const rejected = error !== null || (data.user?.identities?.length ?? 0) === 0;
    expect(rejected).toBe(true);
  });

  it("refuses a wrong password and accepts the right one", async () => {
    const wrong = await anon.auth.signInWithPassword({ email, password: "not-it" });
    expect(wrong.error).not.toBeNull();
    const right = await anon.auth.signInWithPassword({ email, password });
    expect(right.error).toBeNull();
    expect(right.data.session?.user.id).toBe(userId);
  });
});
