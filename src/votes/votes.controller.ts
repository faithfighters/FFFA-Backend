import {
  Controller, Get, Post, Body, Req, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { VotesService } from './votes.service';
import { VotingCyclesService } from '../voting-cycles/voting-cycles.service';
import { CausesService } from '../causes/causes.service';
import { UsersService } from '../users/users.service';
import { VideosService } from '../videos/videos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionGuard } from '../auth/subscription.guard';
import { PLAN_CONFIG } from '../common/plan-config';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { NotificationsService } from '../notifications/notifications.service';
import { AssistanceRequestsService } from '../assistance-requests/assistance-requests.service';

@ApiTags('Votes')
@ApiCookieAuth('fffa_session')
@Controller('votes')
export class VotesController {
  constructor(
    private readonly votesService: VotesService,
    private readonly cyclesService: VotingCyclesService,
    private readonly causesService: CausesService,
    private readonly usersService: UsersService,
    private readonly videosService: VideosService,
    private readonly notifService: NotificationsService,
    private readonly assistanceRequestsService: AssistanceRequestsService,
  ) {}

  @ApiOperation({ summary: 'Get active cycle, causes, and user\'s existing votes' })
  @ApiResponse({ status: 200, description: 'Cycle, causes, and user votes' })
  @Get()
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  async findAll(@Req() req: any) {
    const cycle = await this.cyclesService.findActive();
    if (!cycle) return { cycle: null, causes: [], userVotes: [] };

    const userVotes = await this.votesService.findByUserAndCycle(
      req.user.userId,
      cycle._id.toString(),
    );
    return { cycle, causes: cycle.causes, userVotes };
  }

  // POST /votes — submit a single vote
  @ApiOperation({ summary: 'Cast votes', description: 'Single vote: { causeId, count } or bulk allocation: { allocation: { causeId: count } }' })
  @ApiBody({ schema: { properties: { causeId: { type: 'string' }, count: { type: 'number' }, allocation: { type: 'object', additionalProperties: { type: 'number' } }, videoId: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'Votes cast successfully' })
  @ApiResponse({ status: 400, description: 'No active cycle, cycle closed, or insufficient votes remaining' })
  @Post()
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  async cast(@Body() body: { causeId: string; count: number; allocation?: Record<string, number>; videoId?: string }, @Req() req: any) {
    // Support both bulk { allocation: { causeId: count } } and single { causeId, count }
    let result;
    if (body.allocation) {
      result = await this.castBulk(body.allocation, req.user.userId, body.videoId);
    } else {
      const { causeId } = body;
      const count = Math.floor(Number(body.count));
      if (!causeId || !count || count < 1 || !Number.isFinite(count))
        throw new BadRequestException('causeId and a positive integer count are required.');

      result = await this.castSingle(causeId, count, req.user.userId, body.videoId);
    }

    // Keep any linked assistance request's stage in sync with real funding progress.
    if (body.videoId) {
      await this.assistanceRequestsService.syncFundingStatus(body.videoId).catch(() => {});
    }

    return result;
  }

  private async castBulk(allocation: Record<string, number>, userId: string, videoId?: string) {
    const rawEntries = Object.entries(allocation);
    if (rawEntries.length > 20)
      throw new BadRequestException('Allocation cannot contain more than 20 causes at once.');
    // Normalise all counts to integers
    const allEntries = rawEntries.map(([id, c]) => [id, Math.floor(Number(c))] as [string, number]);
    const positiveEntries = allEntries.filter(([, count]) => count > 0);
    const zeroEntries = allEntries.filter(([, count]) => count === 0);

    if (positiveEntries.length === 0 && zeroEntries.length === 0)
      throw new BadRequestException('No votes allocated.');

    const cycle = await this.cyclesService.findActive();
    if (!cycle) throw new BadRequestException('No active donation cycle.');
    if (cycle.status !== 'active')
      throw new BadRequestException('This voting cycle is no longer accepting votes.');

    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found.');

    const boosterRemaining = (user as any).boosterVotesRemaining ?? 0;
    const usingBooster = boosterRemaining > 0;

    const planKey = user.plan as keyof typeof PLAN_CONFIG | undefined;
    const planVotes = planKey ? PLAN_CONFIG[planKey].votes : 0;

    const existingVotes = await this.votesService.findByUserAndCycle(userId, cycle._id.toString());
    const perVoteDollars = planKey && planVotes > 0 ? (PLAN_CONFIG[planKey].price * 0.8) / planVotes : 0;

    // A vote record is keyed by (cause, video) — a user can hold separate vote
    // allocations for different videos under the same cause. Every lookup below
    // must match on both, not cause alone, or votes for one video corrupt another.
    const keyOf = (v: { causeId: unknown; videoId?: unknown }) =>
      `${(v.causeId as { toString(): string }).toString()}|${v.videoId ? (v.videoId as { toString(): string }).toString() : ''}`;
    const findExisting = (causeId: string) =>
      existingVotes.find(v =>
        v.causeId.toString() === causeId &&
        (videoId ? v.videoId?.toString() === videoId : !v.videoId),
      );

    // Determine target total: positive entries + any existing votes for (cause, video)
    // pairs NOT in this allocation
    const mentionedKeys = new Set(allEntries.map(([causeId]) => `${causeId}|${videoId ?? ''}`));
    const targetTotal = positiveEntries.reduce((s, [, c]) => s + c, 0);
    const unmentionedVotes = existingVotes
      .filter(v => !mentionedKeys.has(keyOf(v)))
      .reduce((s, v) => s + v.count, 0);

    const planRemaining = user.votesRemaining ?? 0;
    const totalAvailable = planRemaining + boosterRemaining;

    const previousTotalCast = existingVotes.reduce((s, v) => s + v.count, 0);
    const newTotalCast = targetTotal + unmentionedVotes;
    const diff = newTotalCast - previousTotalCast;

    if (diff > 0 && diff > totalAvailable) {
      throw new BadRequestException(`You only have ${totalAvailable} vote(s) remaining.`);
    }

    // Validate all video vote restrictions before applying any database changes
    const now = new Date();
    for (const [causeId, targetCount] of positiveEntries) {
      const already = findExisting(causeId);
      const alreadyCount = already ? already.count : 0;
      const diff = targetCount - alreadyCount;

      if (diff === 0) continue;

      const activeVideoId = videoId || already?.videoId?.toString();
      if (activeVideoId) {
        const video = await this.videosService.findById(activeVideoId);
        if (video) {
          if (video.votingCycleStartDate) {
            const startDate = new Date(video.votingCycleStartDate);
            if (now < startDate) {
              throw new BadRequestException(`The voting cycle for "${video.title}" has not started yet.`);
            }
          }
          if (video.votingCycleEndDate) {
            const endDate = new Date(video.votingCycleEndDate);
            if (now > endDate) {
              throw new BadRequestException(`The voting cycle for "${video.title}" has expired.`);
            }
          }

          const requiredVotes = video.targetAmount ? Math.ceil(video.targetAmount / 0.8) : 0;
          const otherUsersVotes = Math.max(0, (video.voteCount || 0) - alreadyCount);
          const newTotalVotes = otherUsersVotes + targetCount;

          if (video.voteCount >= requiredVotes && diff > 0) {
            throw new BadRequestException(`The video "${video.title}" has already reached its required vote count.`);
          }
          if (newTotalVotes > requiredVotes) {
            throw new BadRequestException(
              `Cannot cast ${targetCount} votes to "${video.title}". Only ${requiredVotes - otherUsersVotes} votes remaining are required.`
            );
          }
        }
      }
    }

    // Clear votes for causes explicitly set to 0 (reallocation)
    for (const [causeId] of zeroEntries) {
      const existing = findExisting(causeId);
      if (existing && existing.count > 0) {
        const cause = await this.causesService.findById(causeId);
        if (cause) {
          await this.causesService.update(causeId, {
            totalVotes: Math.max(0, cause.totalVotes - existing.count),
            raisedAmount: Math.max(0, cause.raisedAmount - perVoteDollars * existing.count),
          });
        }
        if (existing.videoId) {
          const video = await this.videosService.findById(existing.videoId.toString());
          if (video) {
            await this.videosService.update(video.id, {
              voteCount: Math.max(0, (video.voteCount || 0) - existing.count),
            });
          }
        }
        await this.votesService.deleteVote(existing._id.toString());
      }
    }

    // Apply positive vote allocations (set final target count per cause)
    for (const [causeId, targetCount] of positiveEntries) {
      const already = findExisting(causeId);
      const alreadyCount = already ? already.count : 0;
      const diff = targetCount - alreadyCount;

      if (diff === 0) continue;

      const cause = await this.causesService.findById(causeId);
      if (!cause) continue;

      // Prevent users from voting for their own submitted causes
      if (cause.submittedBy?.toString() === userId)
        throw new BadRequestException('You cannot vote for a cause you submitted.');

      const activeVideoId = videoId || already?.videoId?.toString();
      if (activeVideoId) {
        const video = await this.videosService.findById(activeVideoId);
        if (video) {
          const otherUsersVotes = Math.max(0, (video.voteCount || 0) - alreadyCount);
          const newTotalVotes = otherUsersVotes + targetCount;
          await this.videosService.update(video.id, {
            voteCount: newTotalVotes,
          });
        }
      }

      if (already) {
        await this.votesService.updateCount(already._id.toString(), targetCount);
      } else {
        await this.votesService.create({ userId, causeId, cycleId: cycle._id.toString(), count: targetCount, videoId: activeVideoId });
      }

      await this.causesService.update(causeId, {
        totalVotes: Math.max(0, cause.totalVotes + diff),
        raisedAmount: Math.max(0, cause.raisedAmount + perVoteDollars * diff),
      });

      if (diff > 0) {
        await this.notifService.create({
          userId,
          type: 'vote_cast',
          title: `Voted on ${cause.name}`,
          message: `${diff} vote${diff !== 1 ? 's' : ''} casted for this campaign.`,
          link: '/dashboard/campaigns',
        }).catch(() => {});
      }
    }

    if (diff > 0) {
      let planDeduct = 0;
      let boosterDeduct = 0;
      if (planRemaining >= diff) {
        planDeduct = diff;
      } else {
        planDeduct = planRemaining;
        boosterDeduct = diff - planRemaining;
      }
      await this.usersService.update(userId, {
        votesRemaining: Math.max(0, planRemaining - planDeduct),
        boosterVotesRemaining: Math.max(0, boosterRemaining - boosterDeduct),
      } as any);
    } else if (diff < 0) {
      const refundAmount = -diff;
      let planRefund = 0;
      let boosterRefund = 0;
      const planMissing = Math.max(0, planVotes - planRemaining);
      if (planMissing >= refundAmount) {
        planRefund = refundAmount;
      } else {
        planRefund = planMissing;
        boosterRefund = refundAmount - planMissing;
      }
      await this.usersService.update(userId, {
        votesRemaining: planRemaining + planRefund,
        boosterVotesRemaining: boosterRemaining + boosterRefund,
      } as any);
    }

    return { success: true };
  }

  private async castSingle(causeId: string, count: number, userId: string, videoId?: string) {
    const cycle = await this.cyclesService.findActive();
    if (!cycle) throw new BadRequestException('No active donation cycle.');
    // Vote locking — reject votes once cycle is closed
    if (cycle.status !== 'active')
      throw new BadRequestException('This voting cycle is no longer accepting votes.');

    const cause = await this.causesService.findById(causeId);
    if (!cause) throw new NotFoundException('Cause not found.');

    if (cause.submittedBy?.toString() === userId)
      throw new BadRequestException('You cannot vote for a cause you submitted.');

    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found.');

    const planKey = user.plan as keyof typeof PLAN_CONFIG | undefined;
    const planVotes = planKey ? PLAN_CONFIG[planKey].votes : 0;

    const existingVotes = await this.votesService.findByUserAndCycle(userId, cycle._id.toString());
    const usedVotes = existingVotes.reduce((s, v) => s + v.count, 0);
    const remaining = planVotes - usedVotes;

    const planRemaining = user.votesRemaining ?? 0;
    const boosterRemaining = (user as any).boosterVotesRemaining ?? 0;
    const totalAvailable = planRemaining + boosterRemaining;

    if (count > totalAvailable) {
      throw new BadRequestException(`You only have ${totalAvailable} vote(s) remaining.`);
    }

    const alreadyVoted = existingVotes.find(v =>
      v.causeId.toString() === causeId &&
      (videoId ? v.videoId?.toString() === videoId : !v.videoId),
    );

    const activeVideoId = videoId || alreadyVoted?.videoId?.toString();
    if (activeVideoId) {
      const video = await this.videosService.findById(activeVideoId);
      if (video) {
        const now = new Date();
        if (video.votingCycleStartDate) {
          const startDate = new Date(video.votingCycleStartDate);
          if (now < startDate) {
            throw new BadRequestException(`The voting cycle for "${video.title}" has not started yet.`);
          }
        }
        if (video.votingCycleEndDate) {
          const endDate = new Date(video.votingCycleEndDate);
          if (now > endDate) {
            throw new BadRequestException(`The voting cycle for "${video.title}" has expired.`);
          }
        }

        const requiredVotes = video.targetAmount ? Math.ceil(video.targetAmount / 0.8) : 0;
        const newTotalVotes = (video.voteCount || 0) + count;

        if (video.voteCount >= requiredVotes) {
          throw new BadRequestException(`The video "${video.title}" has already reached its required vote count.`);
        }
        if (newTotalVotes > requiredVotes) {
          throw new BadRequestException(
            `Cannot cast ${count} votes. Only ${requiredVotes - video.voteCount} votes remaining are required for this video.`
          );
        }

        await this.videosService.update(video.id, {
          voteCount: newTotalVotes,
        });
      }
    }

    if (alreadyVoted) {
      // Allow multiple/incremental casting by updating the existing vote count
      await this.votesService.updateCount(alreadyVoted._id.toString(), alreadyVoted.count + count);
    } else {
      // Create new vote record
      await this.votesService.create({ userId, causeId, cycleId: cycle._id.toString(), count, videoId: activeVideoId });
    }

    const perVoteDollars = planKey ? (PLAN_CONFIG[planKey].price * 0.8) / planVotes : 0;
    await this.causesService.update(causeId, {
      totalVotes: cause.totalVotes + count,
      raisedAmount: cause.raisedAmount + perVoteDollars * count,
    });

    let planDeduct = 0;
    let boosterDeduct = 0;
    if (planRemaining >= count) {
      planDeduct = count;
    } else {
      planDeduct = planRemaining;
      boosterDeduct = count - planRemaining;
    }
    const newPlanRemaining = Math.max(0, planRemaining - planDeduct);
    const newBoosterRemaining = Math.max(0, boosterRemaining - boosterDeduct);
    await this.usersService.update(userId, {
      votesRemaining: newPlanRemaining,
      boosterVotesRemaining: newBoosterRemaining,
    } as any);

    await this.notifService.create({
      userId,
      type: 'vote_cast',
      title: `Voted on ${cause.name}`,
      message: `${count} vote${count !== 1 ? 's' : ''} casted for this campaign.`,
      link: '/dashboard/campaigns',
    }).catch(() => {});

    return { success: true };
  }
}
