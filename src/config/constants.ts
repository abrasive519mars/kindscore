/**
 * Every business number in Kindscore lives here and nowhere else.
 * Each constant cites the PRD section (docs/PRD.md) or the decision (docs/GAME.md) it comes from.
 * Money is always integer paise. Percentages are always basis points (1% = 100 bps).
 */

export const BRAND = {
  name: "Kindscore",
  tagline: "Give every month. Win some months.",
} as const;

// ── Scores ────────────────────────────────────────────────────────────
export const SCORE = {
  /** Stableford lower and upper bounds. */
  MIN: 1,
  MAX: 45,
  /** "Only the latest 5 scores are retained at any time." */
  WINDOW_SIZE: 5,
} as const;

// ── Draw ─────────────────────────────────────────────────────────
export const DRAW = {
  /** Numbers are drawn from the same range scores occupy. */
  NUMBER_MIN: SCORE.MIN,
  NUMBER_MAX: SCORE.MAX,
  /** Five distinct numbers per draw, matching the five kept scores. */
  NUMBERS_DRAWN: 5,
  /** Match counts that pay out (§06 "5-number / 4-number / 3-number match"). */
  WINNING_MATCH_COUNTS: [5, 4, 3] as const,
  /** The tier whose unclaimed pool rolls over. */
  JACKPOT_MATCH_COUNT: 5,
  /**
   * Algorithmic mode (GAME.md §3): count how many eligible users hold each number, smooth that
   * count across ±2 neighbours with SMOOTHING_KERNEL, then weight = BASELINE + smoothed.
   * The baseline keeps every number possible — [decision].
   */
  ALGORITHMIC_BASELINE_WEIGHT: 1,
  /**
   * Weights for offsets −2..+2 applied to the raw frequency tally. Removes single-number
   * sampling gaps (31 with 9 holders between 30 and 32 with 40 each) — [decision].
   */
  SMOOTHING_KERNEL: [0.25, 0.5, 1, 0.5, 0.25] as const,
} as const;

/** Pool share per tier. Must sum to 10 000 bps; asserted in tests. */
export const TIER_SHARE_BPS: Readonly<Record<5 | 4 | 3, number>> = {
  5: 4000,
  4: 3500,
  3: 2500,
};

// ── Money split ────────────────────────────────────────────────
export const SPLIT = {
  /** "A fixed portion of each subscription contributes to the prize pool" - intentional decision to ensure company can keep running.*/
  POOL_SHARE_BPS: 3000,
  /** "Minimum contribution: 10% of subscription fee".*/
  CHARITY_MIN_BPS: 1000,
  /** Derived: charity can potentially take everything the pool does not.*/
  get CHARITY_MAX_BPS(): number {
    return 10_000 - this.POOL_SHARE_BPS;
  },
  /** Slider granularity in the UI. */
  CHARITY_STEP_BPS: 500,
  BPS_DENOMINATOR: 10_000,
} as const;

// ── Plans ─────────────────────────────────────────────────────────────
export type PlanInterval = "month" | "year";

export const PLANS: Readonly<Record<PlanInterval, { pricePaise: number; label: string }>> = {
  month: { pricePaise: 499_00, label: "Monthly" },
  year: { pricePaise: 4_999_00, label: "Yearly" },
};

export const MONTHS_PER_YEAR = 12;

// ── Verification uploads ──────────────────────────────────────────────
export const PROOF_UPLOAD = {
  MAX_BYTES: 5 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ["image/png", "image/jpeg", "image/webp"] as const,
  BUCKET: "proofs",
} as const;

export const CHARITY_MEDIA = {
  MAX_BYTES: 2 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ["image/png", "image/jpeg", "image/webp"] as const,
  BUCKET: "charity-media",
} as const;

// ── Locale ──────────────────────────────────────────────────────────────────
export const LOCALE = {
  /** Website-wide timezone. */
  TIMEZONE: "Asia/Kolkata",
  /** en-IN gives lakh/crore grouping: ₹1,80,000. */
  NUMBER_LOCALE: "en-IN",
  CURRENCY: "INR",
} as const;
