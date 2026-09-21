import { validateCharityBps } from "@/engine/charity/splitPayment";
import { NotFoundError, RuleViolationError } from "@/engine/errors";
import type { Charity, CharityRepository } from "@/repositories/interfaces/CharityRepository";
import type {
  ContributionRecord,
  DonationRepository,
} from "@/repositories/interfaces/DonationRepository";
import type {
  BillingProfile,
  ProfileRepository,
} from "@/repositories/interfaces/ProfileRepository";

export interface MemberCharityState {
  readonly profile: BillingProfile;
  readonly charity: Charity | null;
  readonly contributions: ContributionRecord[];
  readonly totalGivenPaise: number;
}

/**
 * The member's side of PRD §08.1: which charity, what share, and what they have given so far.
 * A change applies from the next payment — the payments already made keep their snapshot.
 */
export class MemberCharityService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly charities: CharityRepository,
    private readonly donations: DonationRepository,
  ) {}

  async current(userId: string): Promise<MemberCharityState> {
    const profile = await this.profiles.findById(userId);
    if (!profile) throw new NotFoundError("We couldn't find your profile.");
    const [charity, contributions] = await Promise.all([
      profile.charityId ? this.charities.findById(profile.charityId) : Promise.resolve(null),
      this.donations.listContributionsForUser(userId),
    ]);
    const totalGivenPaise = contributions.reduce((sum, c) => sum + c.amountPaise, 0);
    return { profile, charity, contributions, totalGivenPaise };
  }

  async updateChoice(userId: string, charityId: string, charityBps: number): Promise<void> {
    const bps = validateCharityBps(charityBps);
    const charity = await this.charities.findById(charityId);
    if (!charity) throw new NotFoundError("That charity isn't listed.");
    if (!charity.isActive)
      throw new RuleViolationError("That charity is no longer taking new supporters.");
    await this.profiles.updateCharityChoice(userId, charityId, bps);
  }
}
