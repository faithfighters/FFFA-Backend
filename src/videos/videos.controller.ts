import {
  Controller, Get, Post, Patch, Param, Body, Req, Query,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { UsersService } from '../users/users.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { CausesService } from '../causes/causes.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModeratorGuard } from '../auth/moderator.guard';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly usersService: UsersService,
    private readonly transcriptionService: TranscriptionService,
    private readonly causesService: CausesService,
  ) {}

  /** Public — approved videos only, featured video first */
  @ApiOperation({ summary: 'List approved videos', description: 'Optionally filter by causeTag. Featured video is always first.' })
  @ApiQuery({ name: 'causeTag', required: false, description: 'Filter by cause tag' })
  @ApiResponse({ status: 200, description: 'List of approved videos' })
  @Get()
  async findAll(@Query('causeTag') causeTag?: string) {
    const filter: Record<string, any> = { status: 'approved' };
    if (causeTag) filter.causeTag = causeTag;
    const videos = await this.videosService.findAll(filter);
    // Featured video always comes first
    const sorted = [
      ...videos.filter(v => (v as any).isFeatured),
      ...videos.filter(v => !(v as any).isFeatured),
    ];
    return { videos: sorted };
  }

  /** Public — single approved video */
  @ApiOperation({ summary: 'Get a single approved video' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Video detail' })
  @ApiResponse({ status: 404, description: 'Not found or not approved' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const video = await this.videosService.findById(id);
    if (!video || video.status !== 'approved') throw new NotFoundException('Video not found.');
    return { video };
  }

  /** Authenticated members submit a video for moderation review */
  @ApiOperation({ summary: 'Submit a video for moderation review (authenticated members)' })
  @ApiCookieAuth('fffa_session')
  @ApiResponse({ status: 201, description: 'Video submitted, pending moderation' })
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() body: {
      title: string;
      description: string;
      thumbnailUrl?: string;
      videoUrl: string;
      causeTag: string;
      beneficiaryName?: string;
      urgencyReason?: string;
      targetAmount?: number;
      submitterPhone?: string;
      submitterEmail?: string;
      paymentDestination?: {
        type: string;
        institutionName?: string;
        address?: string;
        phone?: string;
        accountNumber?: string;
      };
      causeId?: string;
    },
    @Req() req: any,
  ) {
    const { title, description, thumbnailUrl, videoUrl, causeTag } = body;
    if (!title || !description || !videoUrl || !causeTag)
      throw new BadRequestException('title, description, videoUrl and causeTag are required.');

    let targetAmount = body.targetAmount;
    let causeIdObj: Types.ObjectId | undefined = undefined;

    if (body.causeId) {
      if (Types.ObjectId.isValid(body.causeId)) {
        causeIdObj = new Types.ObjectId(body.causeId);
      }
      if (!targetAmount) {
        const cause = await this.causesService.findById(body.causeId);
        if (cause) {
          targetAmount = cause.goalAmount;
        }
      }
    }

    const user = await this.usersService.findById(req.user.userId);
    const video = await this.videosService.create({
      title,
      description,
      thumbnailUrl: thumbnailUrl || '',
      videoUrl,
      authorId: req.user.userId,
      authorName: user?.name || 'Unknown',
      causeTag,
      status: 'pending',
      beneficiaryName: body.beneficiaryName,
      urgencyReason: body.urgencyReason,
      targetAmount,
      causeId: causeIdObj as any,
      submitterPhone: body.submitterPhone,
      submitterEmail: body.submitterEmail,
      paymentDestination: body.paymentDestination,
    });
    // Trigger transcription asynchronously — fire and forget
    this.transcriptionService.triggerTranscription(
      (video as any)._id?.toString() ?? (video as any).id,
      videoUrl,
    );

    return { video };
  }

  /**
   * Moderator/Admin — review a video submission.
   * Records a full audit trail (who reviewed, when, reason).
   */
  @ApiOperation({ summary: 'Approve or reject a video (moderator/admin only)' })
  @ApiCookieAuth('fffa_session')
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiBody({ schema: { properties: { status: { type: 'string', enum: ['approved', 'rejected'] }, rejectionReason: { type: 'string' }, moderationNote: { type: 'string' } }, required: ['status'] } })
  @Patch(':id')
  @UseGuards(JwtAuthGuard, ModeratorGuard)
  async review(
    @Param('id') id: string,
    @Body() body: {
      status: 'approved' | 'rejected';
      rejectionReason?: string;
      moderationNote?: string;
      votingCycleStartDate?: string;
      votingCycleEndDate?: string;
    },
    @Req() req: any,
  ) {
    const { status, rejectionReason, moderationNote, votingCycleStartDate, votingCycleEndDate } = body;
    if (!['approved', 'rejected'].includes(status))
      throw new BadRequestException('status must be approved or rejected.');

    if (status === 'rejected' && !rejectionReason)
      throw new BadRequestException('A rejection reason is required when rejecting a video.');

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
    if (video.status !== 'pending')
      throw new BadRequestException('Only pending videos can be reviewed.');

    const reviewer = await this.usersService.findById(req.user.userId);

    const updated = await this.videosService.update(id, {
      status,
      moderatedBy: req.user.userId,
      moderatedByName: reviewer?.name || req.user.userId,
      moderatedAt: new Date().toISOString(),
      rejectionReason: rejectionReason || '',
      moderationNote: moderationNote || '',
      votingCycleStartDate: status === 'approved' ? votingCycleStartDate : undefined,
      votingCycleEndDate: status === 'approved' ? votingCycleEndDate : undefined,
    } as any);

    return { video: updated };
  }

  /** Report a video submission — requires authentication to prevent spam */
  @ApiOperation({ summary: 'Report a video submission' })
  @ApiCookieAuth('fffa_session')
  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async reportVideo(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('Video not found.');

    // Prevent duplicate reports from the same user
    const reportedBy: string[] = (video as any).reportedBy || [];
    if (reportedBy.includes(req.user.userId)) {
      return { success: true, message: 'Already reported.' };
    }

    const updated = await this.videosService.update(id, {
      isReported: true,
      reportCount: (video.reportCount || 0) + 1,
      reportedBy: [...reportedBy, req.user.userId],
      reportReasons: body.reason
        ? [...(video.reportReasons || []), body.reason]
        : (video.reportReasons || []).length > 0
          ? video.reportReasons
          : ['Inappropriate content'],
    } as any);

    return { success: true, video: updated };
  }
}
