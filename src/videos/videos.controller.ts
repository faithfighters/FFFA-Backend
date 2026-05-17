import {
  Controller, Get, Post, Patch, Param, Body, Req, Query,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModeratorGuard } from '../auth/moderator.guard';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly usersService: UsersService,
  ) {}

  /** Public — approved videos only */
  @ApiOperation({ summary: 'List approved videos', description: 'Optionally filter by causeTag' })
  @ApiQuery({ name: 'causeTag', required: false, description: 'Filter by cause tag' })
  @ApiResponse({ status: 200, description: 'List of approved videos' })
  @Get()
  async findAll(@Query('causeTag') causeTag?: string) {
    const filter: Record<string, any> = { status: 'approved' };
    if (causeTag) filter.causeTag = causeTag;
    const videos = await this.videosService.findAll(filter);
    return { videos };
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
    },
    @Req() req: any,
  ) {
    const { title, description, thumbnailUrl, videoUrl, causeTag } = body;
    if (!title || !description || !videoUrl || !causeTag)
      throw new BadRequestException('title, description, videoUrl and causeTag are required.');

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
      targetAmount: body.targetAmount,
      submitterPhone: body.submitterPhone,
      submitterEmail: body.submitterEmail,
      paymentDestination: body.paymentDestination,
    });
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
    },
    @Req() req: any,
  ) {
    const { status, rejectionReason, moderationNote } = body;
    if (!['approved', 'rejected'].includes(status))
      throw new BadRequestException('status must be approved or rejected.');

    if (status === 'rejected' && !rejectionReason)
      throw new BadRequestException('A rejection reason is required when rejecting a video.');

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
    } as any);

    return { video: updated };
  }

  /** Report a video submission */
  @ApiOperation({ summary: 'Report a video submission' })
  @Post(':id/report')
  async reportVideo(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('Video not found.');

    const updated = await this.videosService.update(id, {
      isReported: true,
      reportCount: (video.reportCount || 0) + 1,
      reportReasons: body.reason 
        ? [...(video.reportReasons || []), body.reason] 
        : (video.reportReasons || []).length > 0 
          ? video.reportReasons 
          : ['Inappropriate content'],
    } as any);

    return { success: true, video: updated };
  }
}
