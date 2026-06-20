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
import { PLAN_CONFIG } from '../common/plan-config';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';

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
  ) {}

  @ApiOperation({ summary: 'Get active cycle, causes, and user\'s existing votes' })
  @ApiResponse({ status: 200, description: 'Cycle, causes, and user votes' })
  @Get()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async cast(@Body() body: { causeId: string; count: number; allocation?: Record<string, number>; videoId?: string }, @Req() req: any) {
    // Support both bulk { allocation: { causeId: count } } and single { causeId, count }
    if (body.allocation) {
      return this.castBulk(body.allocation, req.user.userId, body.videoId);
    }

    const { causeId } = body;
    const count = Math.floor(Number(body.count));
    if (!causeId || !count || count < 1 || !Number.isFinite(count))
      throw new BadRequestException('causeId and a positive integer count are required.');

    return this.castSingle(causeId, count, req.user.userId, body.videoId);
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

    // Determine target total: positive entries + any existing votes for causes NOT in this allocation
    const mentionedCauses = new Set(allEntries.map(([id]) => id));
    const targetTotal = positiveEntries.reduce((s, [, c]) => s + c, 0);
    const unmentionedVotes = existingVotes
      .filter(v => !mentionedCauses.has(v.causeId.toString()))
      .reduce((s, v) => s + v.count, 0);

    if (usingBooster) {
      if (targetTotal > boosterRemaining)
        throw new BadRequestException(`You only have ${boosterRemaining} booster vote(s) remaining.`);
    } else {
      if (targetTotal + unmentionedVotes > planVotes)
        throw new BadRequestException(`You only have ${planVotes} donation vote(s) for this cycle.`);
    }

    // Validate all video vote restrictions before applying any database changes
    const now = new Date();
    for (const [causeId, targetCount] of positiveEntries) {
      const already = existingVotes.find(v => v.causeId.toString() === causeId);
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
      const existing = existingVotes.find(v => v.causeId.toString() === causeId);
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
      const already = existingVotes.find(v => v.causeId.toString() === causeId);
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
    }

    if (usingBooster) {
      const newBooster = Math.max(0, boosterRemaining - targetTotal);
      await this.usersService.update(userId, { boosterVotesRemaining: newBooster } as any);
    } else {
      const updatedRemaining = Math.max(0, planVotes - (targetTotal + unmentionedVotes));
      await this.usersService.update(userId, { votesRemaining: updatedRemaining });
    }

    return { success: true };
  }

  private async castSingle(causeId: string, count: number, userId: string, videoId?: string) {
    const cycle = await this.cyclesService.findActive();
    if (!cycle) throw new BadRequestException('No active donation cycle.');
    // Vote locking — reject votes once cycle is closed
    if (cycle.status !== 'active')
      throw new BadRequestException('This voting cycle is no longer accepting votes.');

    const user2 = await this.usersService.findById(userId);
    if (!user2) throw new NotFoundException('User not found.');
    const boosterRemaining2 = (user2 as any).boosterVotesRemaining ?? 0;
    const usingBooster2 = boosterRemaining2 > 0;

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

    if (usingBooster2) {
      if (count > boosterRemaining2)
        throw new BadRequestException(`You only have ${boosterRemaining2} booster vote(s) remaining.`);
    } else {
      if (count > remaining)
        throw new BadRequestException(`You only have ${remaining} donation vote(s) remaining.`);
    }

    const alreadyVoted = existingVotes.find(v => v.causeId.toString() === causeId);

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

    if (usingBooster2) {
      await this.usersService.update(userId, { boosterVotesRemaining: Math.max(0, boosterRemaining2 - count) } as any);
    } else {
      const updatedRemaining = Math.max(0, remaining - count);
      await this.usersService.update(userId, { votesRemaining: updatedRemaining });
    }

    return { success: true };
  }
}
