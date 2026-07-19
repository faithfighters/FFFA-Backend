import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Req,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { VideosService } from '../videos/videos.service';
import { VotingCyclesService } from '../voting-cycles/voting-cycles.service';
import { PayoutsService } from '../payouts/payouts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CausesService } from '../causes/causes.service';
import { CharitiesService } from '../charities/charities.service';
import { VotesService } from '../votes/votes.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { PLAN_CONFIG } from '../common/plan-config';
import { Types } from 'mongoose';
import { PaymentRecord, PaymentRecordDocument } from '../stripe/schemas/payment-record.schema';

@ApiTags('Admin')
@ApiCookieAuth('fffa_session')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    @InjectModel(PaymentRecord.name) private readonly paymentModel: Model<PaymentRecordDocument>,
    private readonly usersService: UsersService,
    private readonly videosService: VideosService,
    private readonly cyclesService: VotingCyclesService,
    private readonly payoutsService: PayoutsService,
    private readonly subsService: SubscriptionsService,
    private readonly causesService: CausesService,
    private readonly charitiesService: CharitiesService,
    private readonly votesService: VotesService,
    private readonly notifService: NotificationsService,
    private readonly transcriptionService: TranscriptionService,
  ) {}

  // ── Blocked Words ────────────────────────────────────────

  @ApiOperation({ summary: 'Get blocked words list' })
  @ApiResponse({ status: 200, description: 'Array of blocked words' })
  @Get('blocked-words')
  async getBlockedWords() {
    return { blockedWords: await this.transcriptionService.getBlockedWords() };
  }

  @ApiOperation({ summary: 'Add a blocked word' })
  @ApiBody({ schema: { properties: { word: { type: 'string' } }, required: ['word'] } })
  @Post('blocked-words')
  async addBlockedWord(@Body() body: { word: string }) {
    if (!body.word?.trim()) throw new BadRequestException('word is required.');
    return { blockedWords: await this.transcriptionService.addBlockedWord(body.word) };
  }

  @ApiOperation({ summary: 'Remove a blocked word' })
  @ApiParam({ name: 'word', description: 'Word to remove' })
  @Delete('blocked-words/:word')
  async removeBlockedWord(@Param('word') word: string) {
    return { blockedWords: await this.transcriptionService.removeBlockedWord(word) };
  }

  // ── Members ──────────────────────────────────────────────
  @ApiOperation({ summary: 'List all members with subscription info and actual votes cast' })
  @Get('members')
  async getMembers() {
    const [users, subs, allVotes] = await Promise.all([
      this.usersService.findAll(),
      this.subsService.findAll(),
      this.votesService.findAll(),
    ]);

    // Only include members — exclude admins and moderators from the leaderboard
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

  @ApiOperation({ summary: 'Update member role or plan' })
  @ApiParam({ name: 'id' })
  @Patch('members/:id')
  async updateMember(@Param('id') id: string, @Body() body: { role?: string; plan?: string }, @Req() req: any) {
    const allowedRoles = ['member', 'moderator', 'admin'];
    const allowedPlans = ['faith_builder', 'faith_hero', 'faith_fighter'];
    const updates: Record<string, string> = {};
    if (body.role !== undefined) {
      if (!allowedRoles.includes(body.role)) throw new BadRequestException('Invalid role.');
      // Only admins can assign the admin role — moderators cannot escalate privileges
      if (body.role === 'admin' && req.user?.role !== 'admin')
        throw new BadRequestException('Only admins can assign the admin role.');
      updates.role = body.role;
    }
    if (body.plan !== undefined) {
      if (!allowedPlans.includes(body.plan)) throw new BadRequestException('Invalid plan.');
      updates.plan = body.plan;
    }
    if (Object.keys(updates).length === 0) throw new BadRequestException('No valid fields to update.');
    const updated = await this.usersService.update(id, updates as any);
    if (!updated) throw new NotFoundException('User not found.');
    return { user: this.usersService.sanitize(updated) };
  }

  // ── Subscription endDate backfill ───────────────────────
  @ApiOperation({ summary: 'Backfill endDate for all subscriptions missing it (startDate + 30 days)' })
  @Post('subscriptions/backfill-end-dates')
  async backfillEndDates() {
    const all = await this.subsService.findAll();
    let updated = 0;
    for (const sub of all) {
      if (!(sub as any).endDate && sub.startDate) {
        const end = new Date(new Date(sub.startDate).getTime() + 30 * 86400000).toISOString();
        await this.subsService.update(sub._id.toString(), { endDate: end } as any);
        updated++;
      }
    }
    return { updated, total: all.length };
  }

  // ── Videos ───────────────────────────────────────────────
  @ApiOperation({ summary: 'List all video submissions (all statuses, optional reported filter)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'reported', required: false })
  @Get('videos')
  async getVideos(@Query('status') status?: string, @Query('reported') reported?: string) {
    const filter: any = {};
    if (status) filter.status = status;
    if (reported === 'true') filter.isReported = true;
    const videos = await this.videosService.findAll(filter);
    return { videos };
  }

  @ApiOperation({ summary: 'List finished campaign videos (100% funded, or expired without reaching target)' })
  @ApiQuery({ name: 'filter', required: false, description: "'completed' (reached 100%) or 'expired' (cycle over, not funded). Omit for both." })
  @Get('videos/finished')
  async getFinishedVideos(@Query('filter') filter?: 'completed' | 'expired') {
    const videos = await this.videosService.findAll({ status: 'approved' });
    const now = new Date().toISOString();

    const withProgress = videos.map(v => {
      const requiredVotes = (v as any).targetAmount ? Math.ceil((v as any).targetAmount / 0.8) : 0;
      const voteCount = (v as any).voteCount || 0;
      const isCompleted = requiredVotes > 0 && voteCount >= requiredVotes;
      const cycleEnded = !(v as any).votingCycleEndDate || (v as any).votingCycleEndDate < now;
      return { video: v, requiredVotes, voteCount, isCompleted, cycleEnded };
    });

    // Finished = either fully funded, or its cycle window has ended without reaching the target
    const finished = withProgress.filter(v => v.isCompleted || v.cycleEnded);

    const scoped = !filter
      ? finished
      : filter === 'completed'
        ? finished.filter(v => v.isCompleted)
        : finished.filter(v => !v.isCompleted && v.cycleEnded);

    return {
      videos: scoped.map(v => ({
        ...(v.video as any).toJSON?.() ?? v.video,
        requiredVotes: v.requiredVotes,
        voteCount: v.voteCount,
        percentFunded: v.requiredVotes > 0 ? Math.round((v.voteCount / v.requiredVotes) * 100) : 0,
        isCompleted: v.isCompleted,
      })),
    };
  }

  @ApiOperation({ summary: 'Set a video as the featured video (clears any previously featured video)' })
  @ApiParam({ name: 'id' })
  @Patch('videos/:id/feature')
  async featureVideo(@Param('id') id: string) {
    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('Video not found.');
    if (video.status !== 'approved') throw new BadRequestException('Only approved videos can be featured.');
    // Clear existing featured video
    const currentlyFeatured = await this.videosService.findAll({ isFeatured: true });
    for (const v of currentlyFeatured) {
      await this.videosService.update((v as any).id, { isFeatured: false } as any);
    }
    const updated = await this.videosService.update(id, { isFeatured: true } as any);
    return { video: updated };
  }

  @ApiOperation({ summary: 'Update video status or report status' })
  @ApiParam({ name: 'id' })
  @Patch('videos/:id')
  async updateVideo(
    @Param('id') id: string,
    @Body() body: {
      status?: string;
      isReported?: boolean;
      reportCount?: number;
      reportReasons?: string[];
      votingCycleStartDate?: string;
      votingCycleEndDate?: string;
    },
  ) {
    const { status, isReported, reportCount, reportReasons, votingCycleStartDate, votingCycleEndDate } = body;
    if (status && !['approved', 'rejected', 'pending'].includes(status))
      throw new BadRequestException('Invalid status.');
    
    if (status === 'approved') {
      if (!votingCycleStartDate || !votingCycleEndDate) {
        throw new BadRequestException('votingCycleStartDate and votingCycleEndDate are required for approval.');
      }
      if (new Date(votingCycleEndDate) <= new Date(votingCycleStartDate)) {
        throw new BadRequestException('votingCycleEndDate must be after votingCycleStartDate.');
      }
    }

    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('Video not found.');
    
    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (isReported !== undefined) updates.isReported = isReported;
    if (reportCount !== undefined) updates.reportCount = reportCount;
    if (reportReasons !== undefined) updates.reportReasons = reportReasons;
    if (status === 'approved') {
      updates.votingCycleStartDate = votingCycleStartDate;
      updates.votingCycleEndDate = votingCycleEndDate;
    } else if (status === 'pending' || status === 'rejected') {
      updates.votingCycleStartDate = undefined;
      updates.votingCycleEndDate = undefined;
    }
    
    const updated = await this.videosService.update(id, updates);
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
    const { name, startDate } = body;
    if (!name || !startDate) throw new BadRequestException('Missing required fields.');
    await this.cyclesService.closeActive();

    // Fetch all active causes to ensure they follow the same cycle
    const activeCauses = await this.causesService.findActive();
    const activeCauseIds = activeCauses.map(c => c._id);

    const cycle = await this.cyclesService.create({
      name,
      startDate,
      endDate: '2030-11-30T23:59:59.000Z',
      status: 'active',
      causes: activeCauseIds as any,
    });
    return { cycle };
  }

  @Patch('cycles/:id')
  async updateCycle(
    @Param('id') id: string,
    @Body() body: { name?: string; startDate?: string; endDate?: string; status?: string; causes?: string[] },
  ) {
    const allowedStatuses = ['active', 'closed', 'upcoming'];
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.startDate !== undefined) updates.startDate = body.startDate;

    const cycle = await this.cyclesService.findById(id);
    if (!cycle) throw new NotFoundException('Cycle not found.');

    const isTargetActive = body.status === 'active' || (body.status === undefined && cycle.status === 'active');

    if (isTargetActive) {
      updates.endDate = '2030-11-30T23:59:59.000Z';
      const activeCauses = await this.causesService.findActive();
      updates.causes = activeCauses.map(c => c._id);
    } else {
      if (body.endDate !== undefined) updates.endDate = body.endDate;
      if (body.causes !== undefined) updates.causes = body.causes.map(id => new Types.ObjectId(id));
    }

    if (body.status !== undefined) {
      if (!allowedStatuses.includes(body.status)) throw new BadRequestException('Invalid status.');
      updates.status = body.status;
    }

    const updated = await this.cyclesService.update(id, updates);
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

    // Mark participating causes as 'funded' + notify submitters
    for (const entry of closed.fundDistribution) {
      const cause = await this.causesService.update(entry.causeId, { status: 'funded' } as any);
      if (cause?.submittedBy) {
        this.notifService.create({
          userId: cause.submittedBy.toString(),
          type: 'cause_funded',
          title: '💰 Your cause received funding!',
          message: `"${cause.name}" was funded $${entry.amount.toFixed(2)} from this voting cycle.`,
          link: '/dashboard/activities',
        }).catch(() => {});
      }
    }

    // Notify all members who participated in this cycle
    const voterIds = [...new Set(allVotes.map(v => v.userId.toString()))];
    for (const voterId of voterIds) {
      this.notifService.create({
        userId: voterId,
        type: 'cycle_closed',
        title: '📊 Voting cycle has ended',
        message: `"${cycle.name}" is now closed. $${charityPool.toFixed(2)} is being distributed to funded causes.`,
        link: '/dashboard/leaderboard',
      }).catch(() => {});
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
    const [subs, videos, payouts, users, causes, votes, allPayments] = await Promise.all([
      this.subsService.findAll(),
      this.videosService.findAll(),
      this.payoutsService.findAll(),
      this.usersService.findAll(),
      this.causesService.findAll(),
      this.votesService.findAll(),
      this.paymentModel.find().lean(),
    ]);

    const activeSubs = subs.filter(s => s.status === 'active');

    // Use PLAN_CONFIG price as source of truth when DB amount is 0/missing
    const resolveAmount = (plan: string, stored: number) =>
      stored > 0 ? stored : (PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]?.price ?? 0);

    // MRR = sum of active subscription prices
    const mrr = activeSubs.reduce((sum, s) => sum + resolveAmount(s.plan, s.amount), 0);

    // All-time revenue: prefer real payment records, fall back to summing all subscription prices
    const allTimeRevenue = allPayments.length > 0
      ? allPayments.reduce((sum, p) => sum + p.amount, 0)
      : subs.reduce((sum, s) => sum + resolveAmount(s.plan, s.amount), 0);

    const paymentRecordsSynced = allPayments.length > 0;
    const totalPaidOut = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const activeCauses = causes.filter(c => c.status === 'active').length;
    const totalVotes = votes.reduce((sum, v) => sum + (v.count || 1), 0);
    const members = users.filter(u => u.role === 'member');

    const planBreakdown: Record<string, number> = {};
    for (const key of Object.keys(PLAN_CONFIG)) {
      planBreakdown[key] = activeSubs.filter(s => s.plan === key).length;
    }

    // Revenue by month for chart (last 6 months)
    const now = new Date();
    const revenueByMonth: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const monthRevenue = allPayments
        .filter(p => {
          const pd = new Date(p.paidAt);
          return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
        })
        .reduce((sum, p) => sum + p.amount, 0);
      revenueByMonth.push({ month: label, revenue: monthRevenue });
    }

    return {
      // Flat fields for dashboard page
      totalMembers: members.length,
      totalRevenue: allTimeRevenue,
      monthlyRevenue: mrr,
      paymentRecordsSynced,                // false = still using subscription fallback
      toCharity: allTimeRevenue * 0.8,
      toPlatform: allTimeRevenue * 0.2,
      activeCauses,
      totalVotes,
      revenueByMonth,
      // Nested fields used by reports/other pages
      overview: {
        totalMembers: members.length,
        totalAdmins: users.filter(u => u.role === 'admin').length,
        totalMonthlyRevenue: mrr,
        totalAllTimeRevenue: allTimeRevenue,
        totalToCharity: allTimeRevenue * 0.8,
        totalToPlatform: allTimeRevenue * 0.2,
        totalPaidOut,
        activeSubscriptions: activeSubs.length,
        activeCauses,
        totalVotes,
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
      revenue: { monthly: mrr, allTime: allTimeRevenue, toCharity: allTimeRevenue * 0.8, toPlatform: allTimeRevenue * 0.2 },
      planBreakdown,
      members: { total: members.length, active: activeSubs.length },
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

  @ApiOperation({ summary: 'Platform-wide activity stream for admin view' })
  @Get('activities')
  async getActivities() {
    const [votes, videos, users, causes] = await Promise.all([
      this.votesService.findAll(),
      this.videosService.findAll(),
      this.usersService.findAll(),
      this.causesService.findAll(),
    ]);

    const userMap = new Map(users.map(u => [u._id.toString(), u.name]));
    const causeMap = new Map(causes.map(c => [c._id.toString(), c.name]));

    const activitiesList: {
      id: string;
      type: 'vote' | 'submission' | 'report' | 'signup' | 'moderation';
      title: string;
      description: string;
      user: string;
      timestamp: string;
    }[] = [];

    // 1. All member signups
    for (const u of users) {
      if (u.role === 'member') {
        activitiesList.push({
          id: `signup-${u._id}`,
          type: 'signup',
          title: 'New Member Joined',
          description: `${u.name} (${u.email}) joined the platform${u.plan ? ` on the ${u.plan.replace('_', ' ')} plan` : ''}.`,
          user: u.name,
          timestamp: (u as any).createdAt?.toISOString?.() ?? (u as any).joinedAt ?? new Date().toISOString(),
        });
      }
    }

    // 2. All video submissions
    for (const v of videos) {
      activitiesList.push({
        id: `submission-${v._id}`,
        type: 'submission',
        title: 'Campaign Reel Uploaded',
        description: `${v.authorName} submitted "${v.title}" for cause "${v.causeTag}".`,
        user: v.authorName,
        timestamp: (v as any).createdAt?.toISOString?.() ?? new Date().toISOString(),
      });

      // Moderation events
      if (v.moderatedBy && (v.status === 'approved' || v.status === 'rejected')) {
        const moderatorName = userMap.get(v.moderatedBy.toString()) ?? v.moderatedByName ?? 'Admin';
        activitiesList.push({
          id: `moderation-${v._id}`,
          type: 'moderation',
          title: `Campaign ${v.status === 'approved' ? 'Approved' : 'Rejected'}`,
          description: `${moderatorName} ${v.status} "${v.title}" by ${v.authorName}${v.status === 'rejected' && v.rejectionReason ? `: ${v.rejectionReason}` : ''}.`,
          user: moderatorName,
          timestamp: v.moderatedAt ?? (v as any).updatedAt?.toISOString?.() ?? new Date().toISOString(),
        });
      }
    }

    // 3. All votes cast
    for (const v of votes) {
      const voterName = userMap.get(v.userId?.toString()) ?? 'Member';
      const causeName = causeMap.get(v.causeId?.toString()) ?? 'a cause';
      activitiesList.push({
        id: `vote-${v._id}`,
        type: 'vote',
        title: 'Votes Cast',
        description: `${voterName} cast ${v.count} vote${v.count !== 1 ? 's' : ''} for "${causeName}".`,
        user: voterName,
        timestamp: (v as any).createdAt?.toISOString?.() ?? new Date().toISOString(),
      });
    }

    // Sort newest first
    activitiesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { activities: activitiesList.slice(0, 100) };
  }
}
