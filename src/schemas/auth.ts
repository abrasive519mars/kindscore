import { z } from "zod";
import { SPLIT } from "@/config/constants";

/**
 * Shared by the signup/login forms (client-side feedback) and their server actions
 * (the check that counts). One definition, two uses.
 */

const PASSWORD_MIN = 8;

export const charityBpsSchema = z
  .number()
  .int()
  .min(SPLIT.CHARITY_MIN_BPS, `At least ${SPLIT.CHARITY_MIN_BPS / 100}% goes to your charity`)
  .max(SPLIT.CHARITY_MAX_BPS, `Up to ${SPLIT.CHARITY_MAX_BPS / 100}% can go to your charity`)
  .refine((bps) => bps % SPLIT.CHARITY_STEP_BPS === 0, `Choose in steps of ${SPLIT.CHARITY_STEP_BPS / 100}%`);

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Tell us your name").max(80, "That name is a bit long"),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`),
  charityId: z.uuid("Choose a charity"),
  charityBps: z.coerce.number().pipe(charityBpsSchema),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
