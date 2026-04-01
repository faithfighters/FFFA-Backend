import {
  Controller, Get, Patch, Param, Body, Req, Query,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModeratorGuard } from '../auth/moderator.guard';
import { VideosService } from '../videos/videos.service';
import { CausesService } from '../causes/causes.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';

/**
 * Moderator endpoints — content review only.
 * No access to payments, subscriptions, or payouts.
 */
@ApiTags('Moderator')
@ApiCookieAuth('fffa_session')
@Controller('moderator')
@UseGuards(JwtAuthGuard, ModeratorGuard)
export class ModeratorController {
  constructor(
    private readonly videosService: VideosService,
    private readonly causesService: CausesService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  // ── Review Queue ─────────────────────────────────────────

  /**
   * GET /moderator/queue
   * Returns counts of all pending items (overview).
   */
  @ApiOperation({ summary: 'Review queue overview — pending counts' })
  @Get('queue')
  async getQueue() {
    const [pendingVideos, pendingCauses] = await Promise.all([
      this.videosService.findAll({ status: 'pending' }),
      this.causesService.findPending(),
    ]);
    return {
      queue: {
        pendingVideos: pendingVideos.length,
        pendingCauses: pendingCauses.length,
        total: pendingVideos.length + pendingCauses.length,
      },
    };
  }

  // ── Video Moderation ─────────────────────────────────────

  /**
   * GET /moderator/videos
   * List videos filtered by status (default: pending).
   */
  @ApiOperation({ summary: 'List video submissions by status' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @Get('videos')
  async getVideos(@Query('status') status = 'pending') {
    const allowed = ['pending', 'approved', 'rejected'];
    if (!allowed.includes(status))
      throw new BadRequestException('status must be pending, approved, or rejected.');
    const videos = await this.videosService.findAll({ status });
    return { videos, total: videos.length };
  }

  /**
   * GET /moderator/videos/:id
   * Full detail of a single video submission (including private moderation fields).
   */
  @ApiOperation({ summary: 'Get full detail of a video submission' })
  @ApiParam({ name: 'id' })
  @Get('videos/:id')
  async getVideo(@Param('id') id: string) {
    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('Video not found.');
    return { video };
  }

  /**
   * PATCH /moderator/videos/:id
   * Approve or reject a video submission with a mandatory audit trail.
   */
  @ApiOperation({ summary: 'Approve or reject a video submission' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { properties: { status: { type: 'string', enum: ['approved', 'rejected'] }, rejectionReason: { type: 'string' }, moderationNote: { type: 'string' } }, required: ['status'] } })
  @Patch('videos/:id')
  async reviewVideo(
    @Param('id') id: string,
    @Body() body: {
      status: 'approved' | 'rejected';
      rejectionReason?: string;
      moderationNote?: string;
    },
    @Req() req: any,
  ) {
    const { status, rejectionReason, moderationNote } = body;

    if (!['approved', 'rejected'].includes(status))
      throw new BadRequestException('status must be approved or rejected.');

    if (status === 'rejected' && !rejectionReason?.trim())
      throw new BadRequestException('A rejection reason is required when rejecting a submission.');

    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('Video not found.');
    if (video.status !== 'pending')
      throw new BadRequestException(`Video is already ${video.status}. Only pending submissions can be reviewed.`);

    const reviewer = await this.usersService.findById(req.user.userId);

    const updated = await this.videosService.update(id, {
      status,
      moderatedBy: req.user.userId,
      moderatedByName: reviewer?.name || req.user.userId,
      moderatedAt: new Date().toISOString(),
      rejectionReason: status === 'rejected' ? rejectionReason : '',
      moderationNote: moderationNote || '',
    } as any);

    const submitter = await this.usersService.findById(video.authorId?.toString());
    if (submitter) {
      if (status === 'approved') {
        this.emailService.sendVideoApproved(submitter.email, submitter.name, video.title).catch(() => {});
      } else {
        this.emailService.sendVideoRejected(submitter.email, submitter.name, video.title, rejectionReason!).catch(() => {});
      }
    }

    return {
      video: updated,
      message: status === 'approved'
        ? 'Video approved and published.'
        : 'Video rejected. Submitter notified by email.',
    };
  }

  // ── Campaign / Cause Moderation ──────────────────────────

  /**
   * GET /moderator/causes
   * List cause submissions filtered by status (default: pending).
   */
  @ApiOperation({ summary: 'List cause submissions by status' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'active', 'rejected'] })
  @Get('causes')
  async getCauses(@Query('status') status = 'pending') {
    const allowed = ['pending', 'active', 'rejected'];
    if (!allowed.includes(status))
      throw new BadRequestException('status must be pending, active, or rejected.');
    const causes = await this.causesService.findByStatus(status);
    return { causes, total: causes.length };
  }

  /**
   * GET /moderator/causes/:id
   * Full detail of a single cause submission.
   */
  @ApiOperation({ summary: 'Get full detail of a cause submission' })
  @ApiParam({ name: 'id' })
  @Get('causes/:id')
  async getCause(@Param('id') id: string) {
    const cause = await this.causesService.findById(id);
    if (!cause) throw new NotFoundException('Cause not found.');
    return { cause };
  }

  /**
   * PATCH /moderator/causes/:id
   * Approve or reject a cause campaign submission.
   * Approved causes become eligible to be added to voting cycles.
   */
  @ApiOperation({ summary: 'Approve or reject a cause campaign' })
  @ApiParam({ name: 'id' })
  @Patch('causes/:id')
  async reviewCause(
    @Param('id') id: string,
    @Body() body: {
      status: 'active' | 'rejected';
      rejectionReason?: string;
      moderationNote?: string;
    },
    @Req() req: any,
  ) {
    const { status, rejectionReason, moderationNote } = body;

    if (!['active', 'rejected'].includes(status))
      throw new BadRequestException('status must be active (approve) or rejected.');

    if (status === 'rejected' && !rejectionReason?.trim())
      throw new BadRequestException('A rejection reason is required when rejecting a campaign.');

    const cause = await this.causesService.findById(id);
    if (!cause) throw new NotFoundException('Cause not found.');
    if (cause.status !== 'pending')
      throw new BadRequestException(`Cause is already ${cause.status}. Only pending causes can be reviewed.`);

    const reviewer = await this.usersService.findById(req.user.userId);

    const updated = await this.causesService.update(id, {
      status,
      moderatedBy: req.user.userId,
      moderatedByName: reviewer?.name || req.user.userId,
      moderatedAt: new Date().toISOString(),
      rejectionReason: status === 'rejected' ? rejectionReason : '',
      moderationNote: moderationNote || '',
    } as any);

    const submitter = await this.usersService.findById(cause.submittedBy?.toString());
    if (submitter) {
      if (status === 'active') {
        this.emailService.sendCampaignApproved(submitter.email, submitter.name, cause.name).catch(() => {});
      } else {
        this.emailService.sendCampaignRejected(submitter.email, submitter.name, cause.name, rejectionReason!).catch(() => {});
      }
    }

    return {
      cause: updated,
      message: status === 'active'
        ? 'Campaign approved. It can now be added to a voting cycle.'
        : 'Campaign rejected. Submitter notified by email.',
    };
  }

  // ── Moderator Stats ──────────────────────────────────────

  /**
   * GET /moderator/stats
   * How many items this moderator has reviewed.
   */
  @ApiOperation({ summary: 'Get this moderator\'s review activity stats' })
  @Get('stats')
  async getStats(@Req() req: any) {
    const moderatorId = req.user.userId;

    const [allVideos, allCauses] = await Promise.all([
      this.videosService.findAll({ moderatedBy: moderatorId }),
      this.causesService.findByStatus(['active', 'rejected']),
    ]);

    const myVideos = allVideos.filter(v => v.moderatedBy?.toString() === moderatorId);
    const myCauses = allCauses.filter(c => c.moderatedBy?.toString() === moderatorId);

    const today = new Date().toISOString().slice(0, 10);

    return {
      stats: {
        videosReviewed: myVideos.length,
        videosApproved: myVideos.filter(v => v.status === 'approved').length,
        videosRejected: myVideos.filter(v => v.status === 'rejected').length,
        causesReviewed: myCauses.length,
        causesApproved: myCauses.filter(c => c.status === 'active').length,
        causesRejected: myCauses.filter(c => c.status === 'rejected').length,
        reviewedToday: [
          ...myVideos.filter(v => v.moderatedAt?.startsWith(today)),
          ...myCauses.filter(c => c.moderatedAt?.startsWith(today)),
        ].length,
        totalReviewed: myVideos.length + myCauses.length,
      },
    };
  }
}
