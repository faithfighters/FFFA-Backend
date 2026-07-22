import {
  Controller, Get, Post, Param, Body, Req,
  UseGuards, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AssistanceRequestsService } from './assistance-requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Assistance Requests')
@ApiCookieAuth('fffa_session')
@Controller('assistance-requests')
@UseGuards(JwtAuthGuard)
export class AssistanceRequestsController {
  constructor(private readonly requestsService: AssistanceRequestsService) {}

  /** The current member's own assistance requests */
  @ApiOperation({ summary: "List the current member's assistance requests" })
  @Get('mine')
  async findMine(@Req() req: any) {
    return { requests: await this.requestsService.findByMember(req.user.userId) };
  }

  /** A single request — only visible to its own member (admins use /admin/assistance-requests instead) */
  @ApiOperation({ summary: 'Get a single assistance request (owner only)' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const request = await this.requestsService.findById(id);
    if (!request) throw new NotFoundException('Request not found.');
    if (request.memberId.toString() !== req.user.userId) throw new ForbiddenException('Not your request.');

    const json = (request as any).toJSON();
    delete json.internalNotes;
    return { request: json };
  }

  /** Submit a testimonial — only the request's own member, only once the case has reached a late-enough stage */
  @ApiOperation({ summary: 'Submit a testimonial for a completed assistance request' })
  @Post(':id/testimonial')
  async submitTestimonial(
    @Param('id') id: string,
    @Body() body: { type: 'video' | 'written'; writtenText?: string; videoUrl?: string; photoUrl?: string },
    @Req() req: any,
  ) {
    const { type, writtenText, videoUrl, photoUrl } = body;
    if (!['video', 'written'].includes(type))
      throw new BadRequestException('type must be "video" or "written".');
    if (type === 'written' && !writtenText)
      throw new BadRequestException('writtenText is required for a written testimonial.');
    if (type === 'video' && !videoUrl)
      throw new BadRequestException('videoUrl is required for a video testimonial.');

    const request = await this.requestsService.findById(id);
    if (!request) throw new NotFoundException('Request not found.');
    if (request.memberId.toString() !== req.user.userId) throw new ForbiddenException('Not your request.');

    const lateEnoughStages = ['payment_completed', 'testimonial_received', 'case_closed'];
    if (!lateEnoughStages.includes(request.status))
      throw new BadRequestException('This request is not eligible for a testimonial yet.');

    const updated = await this.requestsService.submitTestimonial(id, req.user.userId, {
      type, writtenText, videoUrl, photoUrl,
    });
    if (!updated) throw new BadRequestException('Could not submit testimonial.');

    const json = (updated as any).toJSON();
    delete json.internalNotes;
    return { request: json };
  }

  /**
   * Public-to-members "impact story" view — any authenticated member can see this
   * (not just the recipient or voters), matching how videos are already publicly
   * viewable elsewhere. Only exposes story-safe fields, never internal notes or
   * financial details.
   */
  @ApiOperation({ summary: "Get a recipient's impact story (testimonial + before/after) for any authenticated member" })
  @Get(':id/impact')
  async getImpactStory(@Param('id') id: string) {
    const request = await this.requestsService.findById(id);
    if (!request) throw new NotFoundException('Request not found.');
    if (!request.testimonial || request.testimonial.status !== 'submitted')
      throw new NotFoundException('No testimonial available for this request yet.');

    return {
      story: {
        id: (request as any)._id?.toString() ?? (request as any).id,
        memberName: request.memberName,
        requestTitle: request.requestTitle,
        category: request.category,
        description: request.description,
        testimonial: request.testimonial,
      },
    };
  }
}
