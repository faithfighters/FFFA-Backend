import {
  Controller, Get, Post, Body, Req, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { VotesService } from './votes.service';
import { VotingCyclesService } from '../voting-cycles/voting-cycles.service';
import { CausesService } from '../causes/causes.service';
import { UsersService } from '../users/users.service';
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
  @ApiBody({ schema: { properties: { causeId: { type: 'string' }, count: { type: 'number' }, allocation: { type: 'object', additionalProperties: { type: 'number' } } } } })
  @ApiResponse({ status: 201, description: 'Votes cast successfully' })
  @ApiResponse({ status: 400, description: 'No active cycle, cycle closed, or insufficient votes remaining' })
  @Post()
  @UseGuards(JwtAuthGuard)
  async cast(@Body() body: { causeId: string; count: number; allocation?: Record<string, number> }, @Req() req: any) {
    // Support both bulk { allocation: { causeId: count } } and single { causeId, count }
    if (body.allocation) {
      return this.castBulk(body.allocation, req.user.userId);
    }

    const { causeId, count } = body;
    if (!causeId || !count || count < 1)
      throw new BadRequestException('causeId and count are required.');

    return this.castSingle(causeId, Number(count), req.user.userId);
  }

  private async castBulk(allocation: Record<string, number>, userId: string) {
    const entries = Object.entries(allocation).filter(([, count]) => count > 0);
    if (entries.length === 0)
      throw new BadRequestException('No votes allocated.');

    const cycle = await this.cyclesService.findActive();
    if (!cycle) throw new BadRequestException('No active donation cycle.');
    // Vote locking — reject votes once cycle is closed
    if (cycle.status !== 'active')
      throw new BadRequestException('This voting cycle is no longer accepting votes.');

    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found.');

    const planKey = user.plan as keyof typeof PLAN_CONFIG | undefined;
    const planVotes = planKey ? PLAN_CONFIG[planKey].votes : 0;

    const existingVotes = await this.votesService.findByUserAndCycle(userId, cycle._id.toString());
    const usedVotes = existingVotes.reduce((s, v) => s + v.count, 0);

    // Calculate total new votes requested by comparing target allocations with already cast votes
    const totalNewVotesNeeded = entries.reduce((sum, [causeId, targetCount]) => {
      const already = existingVotes.find(v => v.causeId.toString() === causeId);
      const alreadyCount = already ? already.count : 0;
      const diff = targetCount - alreadyCount;
      return sum + (diff > 0 ? diff : 0);
    }, 0);

    if (usedVotes + totalNewVotesNeeded > planVotes)
      throw new BadRequestException(`You only have ${planVotes - usedVotes} donation vote(s) remaining.`);

    const perVoteDollars = planKey ? (PLAN_CONFIG[planKey].price * 0.8) / planVotes : 0;

    for (const [causeId, targetCount] of entries) {
      const already = existingVotes.find(v => v.causeId.toString() === causeId);
      const alreadyCount = already ? already.count : 0;
      const diff = targetCount - alreadyCount;

      if (diff <= 0) continue; // No new votes allocated to this cause

      const cause = await this.causesService.findById(causeId);
      if (!cause) continue;

      if (already) {
        // Increment count on existing vote record
        await this.votesService.updateCount(already._id.toString(), already.count + diff);
      } else {
        // Create new vote record
        await this.votesService.create({ userId, causeId, cycleId: cycle._id.toString(), count: diff });
      }

      await this.causesService.update(causeId, {
        totalVotes: cause.totalVotes + diff,
        raisedAmount: cause.raisedAmount + perVoteDollars * diff,
      });
    }

    // Properly decrement votesRemaining in user's MongoDB record
    const updatedRemaining = Math.max(0, planVotes - (usedVotes + totalNewVotesNeeded));
    await this.usersService.update(userId, { votesRemaining: updatedRemaining });

    return { success: true };
  }

  private async castSingle(causeId: string, count: number, userId: string) {
    const cycle = await this.cyclesService.findActive();
    if (!cycle) throw new BadRequestException('No active donation cycle.');
    // Vote locking — reject votes once cycle is closed
    if (cycle.status !== 'active')
      throw new BadRequestException('This voting cycle is no longer accepting votes.');

    const cause = await this.causesService.findById(causeId);
    if (!cause) throw new NotFoundException('Cause not found.');

    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found.');

    const planKey = user.plan as keyof typeof PLAN_CONFIG | undefined;
    const planVotes = planKey ? PLAN_CONFIG[planKey].votes : 0;

    const existingVotes = await this.votesService.findByUserAndCycle(userId, cycle._id.toString());
    const usedVotes = existingVotes.reduce((s, v) => s + v.count, 0);
    const remaining = planVotes - usedVotes;

    if (count > remaining)
      throw new BadRequestException(`You only have ${remaining} donation vote(s) remaining.`);

    const alreadyVoted = existingVotes.find(v => v.causeId.toString() === causeId);
    if (alreadyVoted) {
      // Allow multiple/incremental casting by updating the existing vote count
      await this.votesService.updateCount(alreadyVoted._id.toString(), alreadyVoted.count + count);
    } else {
      // Create new vote record
      await this.votesService.create({ userId, causeId, cycleId: cycle._id.toString(), count });
    }

    const perVoteDollars = planKey ? (PLAN_CONFIG[planKey].price * 0.8) / planVotes : 0;
    await this.causesService.update(causeId, {
      totalVotes: cause.totalVotes + count,
      raisedAmount: cause.raisedAmount + perVoteDollars * count,
    });

    // Properly decrement votesRemaining in user's MongoDB record
    const updatedRemaining = Math.max(0, remaining - count);
    await this.usersService.update(userId, { votesRemaining: updatedRemaining });

    return { success: true };
  }
}
