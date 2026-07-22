import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AssistanceRequest, AssistanceRequestDocument } from './schemas/assistance-request.schema';

@Injectable()
export class AssistanceRequestsService {
  constructor(
    @InjectModel(AssistanceRequest.name) private model: Model<AssistanceRequestDocument>,
  ) {}

  findAll(filter?: Record<string, any>): Promise<AssistanceRequestDocument[]> {
    return this.model.find(filter || {}).sort({ createdAt: -1 }).exec();
  }

  findById(id: string): Promise<AssistanceRequestDocument | null> {
    return this.model.findById(id).exec();
  }

  findByMember(memberId: string): Promise<AssistanceRequestDocument[]> {
    return this.model.find({ memberId }).sort({ createdAt: -1 }).exec();
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

  updateFinancials(id: string, updates: Partial<AssistanceRequest>): Promise<AssistanceRequestDocument | null> {
    return this.model.findByIdAndUpdate(id, updates, { new: true }).exec();
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

    return this.model.findByIdAndUpdate(id, updates, { new: true }).exec();
  }
}
