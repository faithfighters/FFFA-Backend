import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Req,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { VideosService } from '../videos/videos.service';
import { VotingCyclesService } from '../voting-cycles/voting-cycles.service';
import { PayoutsService } from '../payouts/payouts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CausesService } from '../causes/causes.service';
import { CharitiesService } from '../charities/charities.service';
import { VotesService } from '../votes/votes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { PLAN_CONFIG } from '../common/plan-config';
import { Types } from 'mongoose';

@ApiTags('Admin')
@ApiCookieAuth('fffa_session')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly videosService: VideosService,
    private readonly cyclesService: VotingCyclesService,
    private readonly payoutsService: PayoutsService,
    private readonly subsService: SubscriptionsService,
    private readonly causesService: CausesService,
    private readonly charitiesService: CharitiesService,
    private readonly votesService: VotesService,
  ) {}

  // ── Members ──────────────────────────────────────────────
  @ApiOperation({ summary: 'List all members with subscription info' })
  @Get('members')
  async getMembers() {
    const users = await this.usersService.findAll();
    const subs = await this.subsService.findAll();
    const members = users.map(u => ({
      ...this.usersService.sanitize(u),
      subscription: subs.find(s => s.userId.toString() === u._id.toString()) || null,
    }));
    return { members };
  }

  @ApiOperation({ summary: 'Update member role or plan' })
  @ApiParam({ name: 'id' })
  @Patch('members/:id')
  async updateMember(@Param('id') id: string, @Body() body: { role?: string; plan?: string }) {
    const updated = await this.usersService.update(id, body as any);
    if (!updated) throw new NotFoundException('User not found.');
    return { user: this.usersService.sanitize(updated) };
  }

  // ── Videos ───────────────────────────────────────────────
  @ApiOperation({ summary: 'List all video submissions (all statuses)' })
  @ApiQuery({ name: 'status', required: false })
  @Get('videos')
  async getVideos(@Query('status') status?: string) {
    const filter = status ? { status } : {};
    const videos = await this.videosService.findAll(filter);
    return { videos };
  }

  @ApiOperation({ summary: 'Update video status' })
  @ApiParam({ name: 'id' })
  @Patch('videos/:id')
  async updateVideo(@Param('id') id: string, @Body() body: { status: string }) {
    const { status } = body;
    if (!['approved', 'rejected', 'pending'].includes(status))
      throw new BadRequestException('Invalid status.');
    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('Video not found.');
    const updated = await this.videosService.update(id, { status } as any);
    return { video: updated };
  }

  // ── Voting Cycles ─────────────────────────────────────────
  @ApiOperation({ summary: 'List all voting cycles' })
  @Get('cycles')
  async getCycles() {
    return { cycles: await this.cyclesService.findAll() };
  }

  @ApiOperation({ summary: 'Create a new voting cycle (auto-closes the active one)' })
  @Post('cycles')
  async createCycle(
    @Body() body: { name: string; startDate: string; endDate: string; causes?: string[] },
  ) {
    const { name, startDate, endDate, causes } = body;
    if (!name || !startDate || !endDate) throw new BadRequestException('Missing required fields.');
    await this.cyclesService.closeActive();
    const cycle = await this.cyclesService.create({
      name,
      startDate,
      endDate,
      status: 'active',
      causes: (causes || []).map(id => new Types.ObjectId(id)) as any,
    });
    return { cycle };
  }

  @Patch('cycles/:id')
  async updateCycle(@Param('id') id: string, @Body() updates: any) {
    const updated = await this.cyclesService.update(id, updates);
    if (!updated) throw new NotFoundException('Cycle not found.');
    return { cycle: updated };
  }

  /**
   * POST /admin/cycles/:id/close
   * Close a voting cycle and compute vote-proportional fund distribution.
   * Calculates the charity pool from active subscriptions at time of closing.
   */
  @Post('cycles/:id/close')
  async closeCycle(@Param('id') id: string, @Body() body: { charityPool?: number }) {
    const cycle = await this.cyclesService.findById(id);
    if (!cycle) throw new NotFoundException('Cycle not found.');
    if (cycle.status === 'closed') throw new BadRequestException('Cycle is already closed.');

    // Aggregate total votes per cause for this cycle
    const allVotes = await this.votesService.findByCycle(id);
    const causeVoteMap: Map<string, number> = new Map();
    for (const v of allVotes) {
      const cid = v.causeId.toString();
      causeVoteMap.set(cid, (causeVoteMap.get(cid) || 0) + v.count);
    }

    // Resolve cause names
    const voteAggregates: { causeId: string; causeName: string; votes: number }[] = [];
    for (const [causeId, votes] of causeVoteMap.entries()) {
      const cause = await this.causesService.findById(causeId);
      voteAggregates.push({ causeId, causeName: cause?.name || causeId, votes });
    }

    // Calculate charity pool from active subscriptions if not provided
    let charityPool = body.charityPool ?? 0;
    if (!charityPool) {
      const activeSubs = await this.subsService.findAll();
      const active = activeSubs.filter((s: any) => s.status === 'active');
      const totalRevenue = active.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
      charityPool = Math.round(totalRevenue * 0.8 * 100) / 100;
    }

    const closed = await this.cyclesService.closeCycle(id, charityPool, voteAggregates);

    // Mark participating causes as 'funded'
    for (const entry of closed.fundDistribution) {
      await this.causesService.update(entry.causeId, { status: 'funded' } as any);
    }

    return {
      cycle: closed,
      summary: {
        totalVotesCast: closed.totalVotesCast,
        charityPool: closed.charityPool,
        causesDistributed: closed.fundDistribution.length,
        distribution: closed.fundDistribution,
      },
    };
  }

  // ── Charities ─────────────────────────────────────────────
  @Get('charities')
  async getCharities() {
    return { charities: await this.charitiesService.findAll() };
  }

  @Post('charities')
  async createCharity(@Body() body: any) {
    if (!body.name) throw new BadRequestException('Charity name is required.');
    const charity = await this.charitiesService.create(body);
    return { charity };
  }

  @Patch('charities/:id')
  async updateCharity(@Param('id') id: string, @Body() updates: any) {
    const updated = await this.charitiesService.update(id, updates);
    if (!updated) throw new NotFoundException('Charity not found.');
    return { charity: updated };
  }

  @Delete('charities/:id')
  async deleteCharity(@Param('id') id: string) {
    await this.charitiesService.delete(id);
    return { success: true };
  }

  // ── Payouts ───────────────────────────────────────────────
  @ApiOperation({ summary: 'List payouts filtered by status or batch' })
  @Get('payouts')
  async getPayouts(@Query('status') status?: string, @Query('batchId') batchId?: string) {
    const filter: any = {};
    if (status) filter.status = status;
    if (batchId) filter.batchId = new Types.ObjectId(batchId);
    return { payouts: await this.payoutsService.findAll(filter) };
  }

  @ApiOperation({ summary: 'Create a new payout record' })
  @Post('payouts')
  async createPayout(@Body() body: {
    causeId: string; causeName: string; charityId?: string; charityName?: string;
    amount: number; paymentMethod: string; cycleId: string; batchId?: string; notes?: string;
  }) {
    const { causeId, causeName, amount, paymentMethod, cycleId, charityId, charityName, batchId, notes } = body;
    if (!causeId || !causeName || !amount || !paymentMethod || !cycleId)
      throw new BadRequestException('Missing required fields.');
    const payout = await this.payoutsService.create({
      causeId: new Types.ObjectId(causeId) as any,
      causeName,
      charityId: charityId ? new Types.ObjectId(charityId) as any : undefined,
      charityName,
      amount: Number(amount),
      paymentMethod,
      status: 'pending',
      cycleId: new Types.ObjectId(cycleId) as any,
      batchId: batchId ? new Types.ObjectId(batchId) as any : undefined,
      notes,
    });
    return { payout };
  }

  @Patch('payouts/:id')
  async updatePayout(@Param('id') id: string, @Body() body: { status: string; notes?: string }) {
    const { status, notes } = body;
    if (!['pending', 'processing', 'paid', 'failed'].includes(status))
      throw new BadRequestException('Invalid status.');
    const updates: any = { status };
    if (status === 'paid') updates.processedAt = new Date().toISOString();
    if (notes !== undefined) updates.notes = notes;
    const updated = await this.payoutsService.update(id, updates);
    if (!updated) throw new NotFoundException('Payout not found.');
    return { payout: updated };
  }

  // ── Payout Batches ────────────────────────────────────────
  @Get('payout-batches')
  async getBatches() {
    return { batches: await this.payoutsService.findAllBatches() };
  }

  @Get('payout-batches/:id')
  async getBatch(@Param('id') id: string) {
    const batch = await this.payoutsService.findBatchById(id);
    if (!batch) throw new NotFoundException('Batch not found.');
    const payouts = await this.payoutsService.findByBatch(id);
    return { batch, payouts };
  }

  @Post('payout-batches')
  async createBatch(@Body() body: { name: string; cycleId: string; notes?: string }, @Req() req: any) {
    const { name, cycleId, notes } = body;
    if (!name || !cycleId) throw new BadRequestException('Name and cycleId are required.');

    const subs = await this.subsService.findAll();
    const revenue = subs.filter(s => s.status === 'active').reduce((s, sub) => s + sub.amount, 0);
    const charityPool = revenue * 0.8;

    const batch = await this.payoutsService.createBatch({
      name,
      cycleId: new Types.ObjectId(cycleId) as any,
      status: 'draft',
      totalAmount: charityPool,
      notes,
      createdBy: req.user.userId,
    });
    return { batch, charityPool };
  }

  @Patch('payout-batches/:id')
  async updateBatch(@Param('id') id: string, @Body() updates: any) {
    const updated = await this.payoutsService.updateBatch(id, updates);
    if (!updated) throw new NotFoundException('Batch not found.');
    return { batch: updated };
  }

  @Post('payout-batches/:id/process')
  async processBatch(@Param('id') id: string, @Req() req: any) {
    const batch = await this.payoutsService.findBatchById(id);
    if (!batch) throw new NotFoundException('Batch not found.');
    if (batch.status === 'completed') throw new BadRequestException('Batch already completed.');
    await this.payoutsService.updateBatch(id, { status: 'processing' });
    const result = await this.payoutsService.processBatch(id, req.user.userId);
    return result;
  }

  // ── Analytics ─────────────────────────────────────────────
  @ApiOperation({ summary: 'Platform analytics — members, revenue, subscriptions' })
  @Get('analytics')
  async getAnalytics() {
    const [subs, videos, payouts, users] = await Promise.all([
      this.subsService.findAll(),
      this.videosService.findAll(),
      this.payoutsService.findAll(),
      this.usersService.findAll(),
    ]);
    const activeSubs = subs.filter(s => s.status === 'active');
    const revenue = activeSubs.reduce((sum, s) => sum + s.amount, 0);
    const totalPaidOut = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

    const planBreakdown: Record<string, number> = {};
    for (const key of Object.keys(PLAN_CONFIG)) {
      planBreakdown[key] = activeSubs.filter(s => s.plan === key).length;
    }

    return {
      overview: {
        totalMembers: users.filter(u => u.role === 'member').length,
        totalAdmins: users.filter(u => u.role === 'admin').length,
        totalMonthlyRevenue: revenue,
        totalToCharity: revenue * 0.8,
        totalToPlatform: revenue * 0.2,
        totalPaidOut,
        activeSubscriptions: activeSubs.length,
      },
      videoStats: {
        total: videos.length,
        pending: videos.filter(v => v.status === 'pending').length,
        approved: videos.filter(v => v.status === 'approved').length,
        rejected: videos.filter(v => v.status === 'rejected').length,
      },
      payoutStats: {
        totalPaidOut,
        pendingPayouts: payouts.filter(p => p.status === 'pending').length,
        processingPayouts: payouts.filter(p => p.status === 'processing').length,
        totalPayouts: payouts.length,
      },
      revenue: { monthly: revenue, toCharity: revenue * 0.8, toPlatform: revenue * 0.2 },
      planBreakdown,
      members: { total: users.filter(u => u.role === 'member').length, active: activeSubs.length },
    };
  }

  // ── Reports ───────────────────────────────────────────────
  @ApiOperation({ summary: 'Financial report — revenue by plan, payouts, charity pool' })
  @Get('reports/financial')
  async getFinancialReport() {
    const [subs, payouts, cycles] = await Promise.all([
      this.subsService.findAll(),
      this.payoutsService.findAll(),
      this.cyclesService.findAll(),
    ]);
    const activeSubs = subs.filter(s => s.status === 'active');
    const revenue = activeSubs.reduce((s, sub) => s + sub.amount, 0);
    const paidOut = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

    const revenueByPlan: Record<string, { count: number; revenue: number }> = {};
    for (const key of Object.keys(PLAN_CONFIG)) {
      const planSubs = activeSubs.filter(s => s.plan === key);
      revenueByPlan[key] = { count: planSubs.length, revenue: planSubs.reduce((s, sub) => s + sub.amount, 0) };
    }

    return {
      summary: {
        monthlyRevenue: revenue,
        charityPool: revenue * 0.8,
        platformFee: revenue * 0.2,
        totalPaidOut: paidOut,
        pendingPayout: payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
        netUnallocated: revenue * 0.8 - paidOut,
      },
      revenueByPlan,
      payouts: payouts.map(p => ({
        id: (p as any).id,
        causeName: p.causeName,
        charityName: p.charityName,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        status: p.status,
        receiptNumber: p.receiptNumber,
        processedAt: p.processedAt,
        createdAt: (p as any).createdAt,
      })),
      cycles: cycles.map(c => ({
        id: (c as any).id,
        name: c.name,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
      })),
    };
  }

  @ApiOperation({ summary: 'Voting report — per-cycle breakdown and cause stats' })
  @Get('reports/voting')
  async getVotingReport() {
    const cycles = await this.cyclesService.findAll();
    const results = [];
    for (const cycle of cycles) {
      const cycleId = (cycle as any).id;
      const votes = await this.votesService.findByCycle(cycleId);
      const totalVotes = votes.reduce((s, v) => s + v.count, 0);
      const uniqueVoters = new Set(votes.map(v => v.userId.toString())).size;
      const byCause: Record<string, number> = {};
      for (const vote of votes) {
        const cid = vote.causeId.toString();
        byCause[cid] = (byCause[cid] || 0) + vote.count;
      }
      results.push({
        cycleId,
        cycleName: cycle.name,
        status: cycle.status,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        totalVotes,
        uniqueVoters,
        causeBreakdown: Object.entries(byCause).map(([causeId, count]) => ({ causeId, count })),
      });
    }
    return { cycles: results };
  }

  @Get('reports/participation')
  async getParticipationReport() {
    const [users, subs, videos] = await Promise.all([
      this.usersService.findAll(),
      this.subsService.findAll(),
      this.videosService.findAll(),
    ]);
    const members = users.filter(u => u.role === 'member');
    const activeSubs = subs.filter(s => s.status === 'active');
    const planParticipation: Record<string, number> = {};
    for (const key of Object.keys(PLAN_CONFIG)) {
      planParticipation[key] = activeSubs.filter(s => s.plan === key).length;
    }
    return {
      members: {
        total: members.length,
        activeSubscribers: activeSubs.length,
        churnRate: members.length > 0
          ? ((members.length - activeSubs.length) / members.length * 100).toFixed(1) + '%'
          : '0%',
      },
      content: {
        totalVideos: videos.length,
        approvedVideos: videos.filter(v => v.status === 'approved').length,
        pendingReview: videos.filter(v => v.status === 'pending').length,
        rejectionRate: videos.length > 0
          ? ((videos.filter(v => v.status === 'rejected').length / videos.length) * 100).toFixed(1) + '%'
          : '0%',
      },
      planParticipation,
    };
  }
}
