import {
  Controller, Get, Post, Patch, Param, Body, Req, Query,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { CausesService } from './causes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { UsersService } from '../users/users.service';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Causes')
@Controller('causes')
export class CausesController {
  constructor(
    private readonly causesService: CausesService,
    private readonly usersService: UsersService,
  ) {}

  /** Public — approved/active causes only */
  @ApiOperation({ summary: 'List active causes', description: 'Returns all approved/active causes. Filter by status with ?status=' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (active, pending, funded, closed)' })
  @ApiResponse({ status: 200, description: 'List of causes' })
  @Get()
  async findAll(@Query('status') status?: string) {
    const causes = status
      ? await this.causesService.findByStatus(status)
      : await this.causesService.findActive();
    return { causes };
  }

  /** Public — single cause */
  @ApiOperation({ summary: 'Get a single cause by ID' })
  @ApiParam({ name: 'id', description: 'Cause ID' })
  @ApiResponse({ status: 200, description: 'Cause detail' })
  @ApiResponse({ status: 404, description: 'Cause not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const cause = await this.causesService.findById(id);
    if (!cause) throw new NotFoundException('Cause not found.');
    return { cause };
  }

  /**
   * Authenticated members can propose a campaign/cause.
   * Goes into 'pending' status for moderator review.
   * Admins can bypass to 'active' immediately.
   */
  @ApiOperation({ summary: 'Submit a cause/campaign (member or admin)', description: 'Members submit for moderation review (pending). Admins go directly to active.' })
  @ApiCookieAuth('fffa_session')
  @ApiResponse({ status: 201, description: 'Cause created' })
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() body: {
      name: string;
      description: string;
      category: string;
      goalAmount: number;
      image?: string;
    },
    @Req() req: any,
  ) {
    const { name, description, category, goalAmount, image } = body;
    if (!name || !description || !category || !goalAmount)
      throw new BadRequestException('name, description, category and goalAmount are required.');

    const user = await this.usersService.findById(req.user.userId);
    // Admins create causes as active; members submit for moderation
    const isAdmin = req.user.role === 'admin';

    const cause = await this.causesService.create({
      name,
      description,
      category,
      goalAmount: Number(goalAmount),
      raisedAmount: 0,
      totalVotes: 0,
      image: image || '',
      status: isAdmin ? 'active' : 'pending',
      submittedBy: req.user.userId,
      submittedByName: user?.name || 'Unknown',
    });
    return { cause };
  }

  /** Admin-only — update cause status/details */
  @ApiOperation({ summary: 'Update cause (admin only)' })
  @ApiCookieAuth('fffa_session')
  @ApiParam({ name: 'id', description: 'Cause ID' })
  @ApiResponse({ status: 200, description: 'Updated cause' })
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      description: string;
      goalAmount: number;
      status: string;
      image: string;
    }>,
  ) {
    const cause = await this.causesService.findById(id);
    if (!cause) throw new NotFoundException('Cause not found.');
    const updated = await this.causesService.update(id, body as any);
    return { cause: updated };
  }
}
