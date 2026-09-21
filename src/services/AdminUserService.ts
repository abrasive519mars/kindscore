import type { PlanInterval } from "@/config/constants";
import { validateCharityBps } from "@/engine/charity/splitPayment";
import { NotFoundError } from "@/engine/errors";
import type { ScoreEntry } from "@/engine/scores/latestFive";
import type {
  AdminUserRepository,
  MemberDetail,
  MemberFilter,
  MemberRow,
  ProfileEdit,
} from "@/repositories/interfaces/AdminUserRepository";
import type { CharityRepository } from "@/repositories/interfaces/CharityRepository";
import type { ScoreWrite } from "@/repositories/interfaces/ScoreRepository";
import type { ScoreService } from "@/services/ScoreService";

export interface MemberPage extends MemberDetail {
  readonly scores: ScoreEntry[];
}

/**
 * PRD §11.01 — the admin acting on a member. Score edits go through the member's own ScoreService
 * (same five-by-date rules; the database trigger and constraints apply regardless), and every
 * change writes an audit row with who did what, before and after.
 */
export class AdminUserService {
  constructor(
    private readonly users: AdminUserRepository,
    private readonly charities: CharityRepository,
    private readonly scores: ScoreService,
  ) {}

  list(filter: MemberFilter): Promise<MemberRow[]> {
    return this.users.listMembers(filter);
  }

  async detail(userId: string): Promise<MemberPage> {
    const member = await this.users.findMember(userId);
    if (!member) throw new NotFoundError("That member doesn't exist.");
    const scores = await this.scores.list(userId);
    return { ...member, scores };
  }

  async updateProfile(actorId: string, userId: string, edit: ProfileEdit): Promise<void> {
    const before = await this.detail(userId);
    const charityBps = validateCharityBps(edit.charityBps);
    const charity = await this.charities.findById(edit.charityId);
    if (!charity) throw new NotFoundError("That charity isn't listed.");
    await this.users.updateProfile(userId, { ...edit, fullName: edit.fullName.trim(), charityBps });
    await this.audit(actorId, "profile.update", "profiles", userId, {
      before: {
        fullName: before.fullName,
        charityId: before.charityId,
        charityBps: before.charityBps,
      },
      after: { fullName: edit.fullName.trim(), charityId: edit.charityId, charityBps },
    });
  }

  async addScore(actorId: string, userId: string, write: ScoreWrite): Promise<void> {
    const { entry, evicted } = await this.scores.add(userId, write);
    await this.audit(actorId, "score.add", "scores", entry.id, {
      user_id: userId,
      after: write,
      evicted,
    });
  }

  async updateScore(
    actorId: string,
    userId: string,
    scoreId: string,
    write: ScoreWrite,
  ): Promise<void> {
    const before = (await this.scores.list(userId)).find((s) => s.id === scoreId);
    const after = await this.scores.update(userId, scoreId, write);
    await this.audit(actorId, "score.update", "scores", scoreId, {
      user_id: userId,
      before: before && { score: before.score, playedOn: before.playedOn },
      after: { score: after.score, playedOn: after.playedOn },
    });
  }

  async removeScore(actorId: string, userId: string, scoreId: string): Promise<void> {
    const before = (await this.scores.list(userId)).find((s) => s.id === scoreId);
    await this.scores.remove(userId, scoreId);
    await this.audit(actorId, "score.delete", "scores", scoreId, {
      user_id: userId,
      before: before && { score: before.score, playedOn: before.playedOn },
    });
  }

  /** The RPC writes its own audit row. */
  grantSubscription(userId: string, interval: PlanInterval): Promise<void> {
    return this.users.setSubscription(userId, "grant", interval);
  }

  endSubscription(userId: string): Promise<void> {
    return this.users.setSubscription(userId, "end", "month");
  }

  private audit(
    actorId: string,
    action: string,
    targetTable: string,
    targetId: string | null,
    diff: Record<string, unknown>,
  ) {
    return this.users.writeAudit({ actorId, action, targetTable, targetId, diff });
  }
}
