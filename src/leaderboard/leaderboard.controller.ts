import { Controller, Get } from '@nestjs/common';
import { CausesService } from '../causes/causes.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly causesService: CausesService) {}

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
}
