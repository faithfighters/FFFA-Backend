import { Controller, Get, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { VotingCyclesService } from '../voting-cycles/voting-cycles.service';
import { VotesService } from '../votes/votes.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cyclesService: VotingCyclesService,
    private readonly votesService: VotesService,
    private readonly subsService: SubscriptionsService,
  ) {}

  @ApiOperation({ summary: 'Get member dashboard data', description: 'Returns user profile, active cycle, causes, user votes, and subscription' })
  @ApiCookieAuth('fffa_session')
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  @Get()
  @UseGuards(JwtAuthGuard)
  async get(@Req() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found.');

    const cycle = await this.cyclesService.findActive();
    const userVotes = cycle
      ? await this.votesService.findByUserAndCycle(req.user.userId, cycle._id.toString())
      : [];
    const subscription = await this.subsService.findActiveByUser(req.user.userId);

    return {
      user: this.usersService.sanitize(user),
      cycle,
      causes: cycle ? cycle.causes : [],
      userVotes,
      subscription,
    };
  }
}
