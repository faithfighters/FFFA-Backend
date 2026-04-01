import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { VotingCyclesService } from './voting-cycles.service';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('Voting Cycles')
@Controller('voting-cycles')
export class VotingCyclesController {
  constructor(private readonly cyclesService: VotingCyclesService) {}

  /** GET /voting-cycles — all cycles (public) */
  @ApiOperation({ summary: 'List all voting cycles' })
  @ApiResponse({ status: 200, description: 'All voting cycles' })
  @Get()
  async findAll() {
    const cycles = await this.cyclesService.findAll();
    return { cycles };
  }

  /** GET /voting-cycles/active — current active cycle with causes */
  @ApiOperation({ summary: 'Get the current active voting cycle with causes' })
  @ApiResponse({ status: 200, description: 'Active cycle or null' })
  @Get('active')
  async findActive() {
    const cycle = await this.cyclesService.findActive();
    return { cycle: cycle || null };
  }

  /** GET /voting-cycles/:id — single cycle detail */
  @ApiOperation({ summary: 'Get a single voting cycle' })
  @ApiParam({ name: 'id', description: 'Cycle ID' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const cycle = await this.cyclesService.findById(id);
    if (!cycle) throw new NotFoundException('Voting cycle not found.');
    return { cycle };
  }

  /**
   * GET /voting-cycles/:id/results
   * Fund distribution results for a closed cycle.
   */
  @ApiOperation({ summary: 'Get fund distribution results for a closed cycle' })
  @ApiParam({ name: 'id', description: 'Cycle ID' })
  @ApiResponse({ status: 200, description: 'Fund distribution results' })
  @Get(':id/results')
  async getResults(@Param('id') id: string) {
    const cycle = await this.cyclesService.getResults(id);
    if (cycle.status !== 'closed')
      return { cycle, message: 'Cycle is not yet closed. Results will be available after closing.' };
    return {
      cycle,
      results: {
        name: cycle.name,
        closedAt: cycle.closedAt,
        totalVotesCast: cycle.totalVotesCast,
        charityPool: cycle.charityPool,
        fundDistribution: cycle.fundDistribution,
      },
    };
  }
}
