import { Controller, Get, UseGuards } from '@nestjs/common';
import { CausesService } from '../causes/causes.service';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { VotesService } from '../votes/votes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    private readonly causesService: CausesService,
    private readonly usersService: UsersService,
    private readonly subsService: SubscriptionsService,
    private readonly votesService: VotesService,
  ) {}

  @ApiOperation({ summary: 'Get public donation leaderboard', description: 'Returns causes sorted by votes with total stats' })
  @ApiResponse({ status: 200, description: 'Causes and stats' })
  @Get()
  async get() {
    const causes = (await this.causesService.findActive())
      .sort((a, b) => b.totalVotes - a.totalVotes);

    const totalVotes = causes.reduce((s, c) => s + c.totalVotes, 0);
    const totalToCharity = causes.reduce((s, c) => s + c.raisedAmount, 0);

    return {
      causes,
      stats: { totalVotes, totalToCharity, activeCauses: causes.length },
    };
  }

  @ApiCookieAuth('fffa_session')
  @ApiOperation({ summary: 'Get member leaderboard', description: 'Returns all member standings sorted by donations or votes on the client' })
  @ApiResponse({ status: 200, description: 'Members with subscription and vote totals' })
  @Get('members')
  @UseGuards(JwtAuthGuard)
  async getMembers() {
    const [users, subs, allVotes] = await Promise.all([
      this.usersService.findAll(),
      this.subsService.findAll(),
      this.votesService.findAll(),
    ]);

    const members = users
      .filter(u => u.role === 'member')
      .map(u => {
        const uid = u._id.toString();
        const votesCast = allVotes
          .filter(v => v.userId.toString() === uid)
          .reduce((sum, v) => sum + v.count, 0);
        return {
          ...this.usersService.sanitize(u),
          subscription: subs.find(s => s.userId.toString() === uid) || null,
          votesCast,
        };
      });

    return { members };
  }
}
