import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AssistanceRequest, AssistanceRequestDocument } from './schemas/assistance-request.schema';
import { Vote, VoteDocument } from '../votes/schemas/vote.schema';
import { Video, VideoDocument } from '../videos/schemas/video.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AssistanceRequestsService {
  constructor(
    @InjectModel(AssistanceRequest.name) private model: Model<AssistanceRequestDocument>,
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  findAll(filter?: Record<string, any>): Promise<AssistanceRequestDocument[]> {
    return this.model.find(filter || {}).sort({ createdAt: -1 }).exec();
  }

  findById(id: string): Promise<AssistanceRequestDocument | null> {
    return this.model.findById(id).exec();
  }

  findByMember(memberId: string): Promise<AssistanceRequestDocument[]> {
    return this.model.find({ memberId: new Types.ObjectId(memberId) }).sort({ createdAt: -1 }).exec();
  }

  findByVideoId(videoId: string): Promise<AssistanceRequestDocument | null> {
    return this.model.findOne({ videoId: new Types.ObjectId(videoId) }).exec();
  }

  /**
   * Attaches the linked video's playback URL/thumbnail/vote progress to each
   * request's JSON, for a detail view that shows the video alongside the
   * request info. `requiredVotes` uses the same $0.80-per-vote conversion as
   * Video.schema.ts's toJSON transform (targetAmount / 0.8), so it always
   * reflects this specific request's own funding goal — not the shared
   * cause's cumulative totals, which is a separate (and separately correct)
   * number shown elsewhere in the video moderation panel.
   */
  async attachVideoInfo(requests: AssistanceRequestDocument[]): Promise<any[]> {
    const videoIds = requests.map(r => r.videoId).filter(Boolean);
    const videos = videoIds.length
      ? await this.videoModel.find({ _id: { $in: videoIds } }).exec()
      : [];
    const videoMap = new Map(videos.map(v => [(v as any)._id.toString(), v]));

    return requests.map(r => {
      const json = (r as any).toJSON();
      json.requiredVotes = Math.ceil((r.amountRequested || 0) / 0.8);
      const video = r.videoId ? videoMap.get(r.videoId.toString()) : undefined;
      if (video) {
        json.videoUrl = video.videoUrl;
        json.thumbnailUrl = video.thumbnailUrl;
        json.voteCount = video.voteCount || 0;
        // Every other field the member actually filled in on the submission
        // form — not stored on AssistanceRequest itself, so surface it from
        // the linked video for a detail view showing everything they submitted.
        json.beneficiaryName = video.beneficiaryName;
        json.urgencyReason = video.urgencyReason;
        json.submitterPhone = video.submitterPhone;
        json.submitterEmail = video.submitterEmail;
        json.paymentDestination = video.paymentDestination;
      }
      return json;
    });
  }

  create(data: Partial<AssistanceRequest>): Promise<AssistanceRequestDocument> {
    return this.model.create(data);
  }

  update(id: string, updates: Partial<AssistanceRequest>): Promise<AssistanceRequestDocument | null> {
    return this.model.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async setStatus(
    id: string,
    status: string,
    changedBy: string,
    changedByName: string,
    note?: string,
  ): Promise<AssistanceRequestDocument | null> {
    const request = await this.model.findById(id).exec();
    if (!request) return null;

    const historyEntry = {
      status,
      changedAt: new Date().toISOString(),
      changedBy,
      changedByName,
      note: note || '',
    };

    const updates: Partial<AssistanceRequest> & { statusHistory: any } = {
      status,
      statusHistory: [...(request.statusHistory || []), historyEntry],
    } as any;

    if (request.status === 'submitted' && status !== 'submitted') {
      (updates as any).reviewedBy = changedBy;
      (updates as any).reviewedByName = changedByName;
      (updates as any).reviewedAt = new Date().toISOString();
    }

    return this.model.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async updateFinancials(id: string, updates: Partial<AssistanceRequest>): Promise<AssistanceRequestDocument | null> {
    const updated = await this.model.findByIdAndUpdate(id, updates, { new: true }).exec();
    // Marking payment completed is the trigger for this stage — no separate
    // manual stepper click needed on top of filling in the financials.
    if (updated && updates.paymentCompleted && updated.status !== 'payment_completed') {
      return this.setStatus(id, 'payment_completed', 'system', 'System', 'Auto-advanced: payment marked completed.');
    }
    return updated;
  }

  /**
   * Called after a video is approved in the moderation queue: if it has a
   * linked assistance request still sitting at "submitted", advances it
   * straight to "approved" — the moderator's approval of the video IS the
   * review decision, so there's no separate manual step for the admin.
   */
  async onVideoApproved(videoId: string, changedBy: string, changedByName: string): Promise<void> {
    const request = await this.findByVideoId(videoId);
    if (!request || request.status !== 'submitted') return;
    await this.setStatus(request._id.toString(), 'approved', changedBy, changedByName, 'Auto-advanced: linked video approved.');
  }

  /**
   * Called after votes are cast on a video: keeps the request's stage in sync
   * with real funding progress instead of requiring an admin to watch the
   * video and manually advance the stepper.
   *  - approved -> funding_in_progress as soon as the first vote lands
   *  - funding_in_progress -> payment_scheduled once votes reach the goal
   *    (same $0.80/vote conversion used everywhere else)
   */
  async syncFundingStatus(videoId: string): Promise<void> {
    const request = await this.findByVideoId(videoId);
    if (!request) return;

    const video = await this.videoModel.findById(videoId).exec();
    if (!video) return;

    const requiredVotes = Math.ceil((request.amountRequested || 0) / 0.8);
    const voteCount = video.voteCount || 0;

    if (requiredVotes > 0 && voteCount >= requiredVotes && ['approved', 'funding_in_progress'].includes(request.status)) {
      await this.setStatus(request._id.toString(), 'payment_scheduled', 'system', 'System', 'Auto-advanced: funding goal reached.');
      return;
    }

    if (request.status === 'approved' && voteCount > 0) {
      await this.setStatus(request._id.toString(), 'funding_in_progress', 'system', 'System', 'Auto-advanced: first vote received.');
    }
  }

  updatePaymentDetails(id: string, updates: Partial<AssistanceRequest>): Promise<AssistanceRequestDocument | null> {
    return this.model.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async submitTestimonial(
    id: string,
    memberId: string,
    testimonial: { type: 'video' | 'written'; writtenText?: string; videoUrl?: string; photoUrl?: string },
  ): Promise<AssistanceRequestDocument | null> {
    const request = await this.model.findById(id).exec();
    if (!request) return null;
    if (request.memberId.toString() !== memberId) return null;

    const lateEnoughStages = ['payment_completed', 'testimonial_received', 'case_closed'];
    if (!lateEnoughStages.includes(request.status)) return null;

    const updates: Partial<AssistanceRequest> = {
      testimonial: {
        type: testimonial.type,
        writtenText: testimonial.writtenText || '',
        videoUrl: testimonial.videoUrl || '',
        photoUrl: testimonial.photoUrl || '',
        submittedAt: new Date().toISOString(),
        status: 'submitted',
      },
    };

    if (request.status === 'payment_completed') {
      (updates as any).status = 'testimonial_received';
      (updates as any).statusHistory = [
        ...(request.statusHistory || []),
        {
          status: 'testimonial_received',
          changedAt: new Date().toISOString(),
          changedBy: memberId,
          changedByName: request.memberName,
          note: 'Testimonial submitted by member.',
        },
      ];
    }

    const updated = await this.model.findByIdAndUpdate(id, updates, { new: true }).exec();
    if (updated) await this.notifyVoters(updated);
    return updated;
  }

  /** Story-safe projection shared by the single impact-story view and the public testimonials gallery — never internal notes or financial details. */
  toPublicStory(request: AssistanceRequestDocument) {
    return {
      id: (request as any)._id?.toString() ?? (request as any).id,
      memberName: request.memberName,
      requestTitle: request.requestTitle,
      category: request.category,
      description: request.description,
      testimonial: request.testimonial,
    };
  }

  /** Every submitted testimonial, newest first — the public "Testimonial Videos" gallery. */
  findAllTestimonials(): Promise<AssistanceRequestDocument[]> {
    return this.model
      .find({ 'testimonial.status': 'submitted' })
      .sort({ 'testimonial.submittedAt': -1 })
      .exec();
  }

  /**
   * Admin action: email the recipient that their campaign hit 100% and invite
   * them to submit a testimonial. Only valid once payment is actually marked
   * complete — by that point the funding goal and payment details are both
   * already confirmed (payment_completed is only reachable after both), so
   * there's no separate "votes are 100%" check needed here.
   */
  async requestTestimonial(id: string): Promise<AssistanceRequestDocument | null> {
    const request = await this.model.findById(id).exec();
    if (!request) return null;
    if (request.status !== 'payment_completed') return null;

    const member = await this.usersService.findById(request.memberId.toString());
    if (member?.email) {
      await this.emailService
        .sendTestimonialRequest(member.email, request.memberName, request.requestTitle)
        .catch(() => {});
    }

    return this.model.findByIdAndUpdate(
      id,
      { testimonialRequestedAt: new Date().toISOString() },
      { new: true },
    ).exec();
  }

  /**
   * Admin action: removes a testimonial that didn't meet the bar (incomplete,
   * bad-faith, etc). Resets the testimonial back to unsubmitted rather than a
   * permanent "rejected" state, so the member can submit a corrected one — the
   * case's own status is unaffected except that testimonial_received (which
   * only makes sense once a testimonial exists) rolls back to payment_completed.
   */
  async rejectTestimonial(id: string, adminId: string, adminName: string): Promise<AssistanceRequestDocument | null> {
    const request = await this.model.findById(id).exec();
    if (!request) return null;
    if (request.testimonial?.status !== 'submitted') return null;

    const updates: Partial<AssistanceRequest> & { statusHistory: any } = {
      testimonial: { status: 'pending_request' } as any,
      statusHistory: [
        ...(request.statusHistory || []),
        {
          status: request.status === 'testimonial_received' ? 'payment_completed' : request.status,
          changedAt: new Date().toISOString(),
          changedBy: adminId,
          changedByName: adminName,
          note: 'Testimonial rejected and removed by admin.',
        },
      ],
    } as any;

    if (request.status === 'testimonial_received') {
      (updates as any).status = 'payment_completed';
    }

    return this.model.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  /**
   * Closes the feedback loop: every distinct member who voted on the linked video
   * gets a notification once the recipient's testimonial is in. Silently no-ops if
   * there's no linked video (e.g. an admin-manual case with no submission behind it).
   */
  private async notifyVoters(request: AssistanceRequestDocument): Promise<void> {
    if (!request.videoId) return;

    const votes = await this.voteModel.find({ videoId: request.videoId }).exec();
    const voterIds = [...new Set(votes.map(v => v.userId.toString()))]
      .filter(uid => uid !== request.memberId.toString());

    await Promise.all(voterIds.map(userId =>
      this.notificationsService.create({
        userId,
        type: 'testimonial_received',
        title: 'Your vote made a difference! ❤️',
        message: 'Because of your vote, we were able to help another member of the Faith Fighters family.',
        link: `/dashboard/impact/${(request as any)._id?.toString() ?? (request as any).id}`,
        imageUrl: request.testimonial?.photoUrl || undefined,
      }),
    ));
  }
}
