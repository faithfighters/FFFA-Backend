import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AssistanceRequestDocument = AssistanceRequest & Document;

export const ASSISTANCE_REQUEST_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'funding_in_progress',
  'payment_scheduled',
  'payment_completed',
  'testimonial_received',
  'case_closed',
] as const;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    ret.memberId = ret.memberId?.toString();
    if (ret.videoId) ret.videoId = ret.videoId.toString();
    if (ret.causeId) ret.causeId = ret.causeId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ _id: false })
class StatusHistoryEntry {
  @Prop({ required: true })
  status: string;

  @Prop({ required: true })
  changedAt: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  changedBy: Types.ObjectId;

  @Prop()
  changedByName: string;

  @Prop()
  note: string;
}

@Schema({ _id: false })
class Testimonial {
  @Prop({ enum: ['video', 'written'] })
  type: string;

  @Prop()
  writtenText: string;

  @Prop()
  videoUrl: string;

  @Prop()
  photoUrl: string;

  @Prop()
  submittedAt: string;

  @Prop({ enum: ['pending_request', 'submitted'], default: 'pending_request' })
  status: string;
}

@Schema({ timestamps: true, toJSON })
export class AssistanceRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  memberId: Types.ObjectId;

  @Prop({ required: true })
  memberName: string;

  @Prop({ type: Types.ObjectId, ref: 'Video' })
  videoId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cause' })
  causeId: Types.ObjectId;

  @Prop({ required: true })
  requestTitle: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  documentUrls: string[];

  @Prop({ enum: ASSISTANCE_REQUEST_STATUSES, default: 'submitted' })
  status: string;

  @Prop({ type: [StatusHistoryEntry], default: [] })
  statusHistory: StatusHistoryEntry[];

  // ── Financial tracking ──────────────────────────────────
  @Prop({ required: true })
  amountRequested: number;

  @Prop()
  amountApproved: number;

  @Prop({ default: 0 })
  amountPaid: number;

  @Prop()
  paymentDate: string;

  @Prop({ enum: ['ach', 'check', 'paypal', 'other'] })
  paymentMethod: string;

  @Prop()
  paymentReferenceNumber: string;

  /** Admin-only — never returned to the requesting member */
  @Prop()
  internalNotes: string;

  // ── Payment details ─────────────────────────────────────
  /** What the funds are being used for */
  @Prop()
  fundsUsage: string;

  @Prop({ enum: ['vendor', 'landlord', 'utility_company', 'individual', 'other'] })
  paymentRecipientType: string;

  @Prop()
  paymentRecipientName: string;

  @Prop({ default: false })
  paymentCompleted: boolean;

  // ── Testimonial ──────────────────────────────────────────
  @Prop({ type: Testimonial, default: () => ({}) })
  testimonial: Testimonial;

  /** When the admin last sent the "share your testimonial" email — lets the UI show Sent/Resend instead of a blind button. */
  @Prop()
  testimonialRequestedAt: string;

  // ── Admin audit ──────────────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy: Types.ObjectId;

  @Prop()
  reviewedByName: string;

  @Prop()
  reviewedAt: string;

  @Prop({ default: 'member' })
  createdBy: string;

  @Prop()
  createdByName: string;
}

export const AssistanceRequestSchema = SchemaFactory.createForClass(AssistanceRequest);
