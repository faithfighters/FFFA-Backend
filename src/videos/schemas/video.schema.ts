import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoDocument = Video & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    ret.authorId = ret.authorId?.toString();
    if (ret.causeId) ret.causeId = ret.causeId.toString();
    ret.requiredVotes = ret.targetAmount ? Math.ceil(ret.targetAmount / 0.8) : 0;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class Video {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: '' })
  thumbnailUrl: string;

  @Prop({ required: true })
  videoUrl: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cause' })
  causeId: Types.ObjectId;

  @Prop({ required: true })
  authorName: string;

  @Prop({ required: true })
  causeTag: string;

  @Prop({ enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: string;

  @Prop()
  beneficiaryName: string;

  @Prop()
  urgencyReason: string;

  @Prop()
  targetAmount: number;

  @Prop({ enum: ['pending', 'paid'], default: 'pending' })
  billPayStatus: string;

  @Prop({
    type: {
      type: { type: String, enum: ['hospital', 'utility', 'rent', 'other'] },
      institutionName: String,
      address: String,
      phone: String,
      accountNumber: String,
    },
  })
  paymentDestination: {
    type: string;
    institutionName?: string;
    address?: string;
    phone?: string;
    accountNumber?: string;
  };

  // ── Submitter contact ───────────────────────────────────
  @Prop()
  submitterPhone: string;

  @Prop()
  submitterEmail: string;

  // ── Transcription ───────────────────────────────────────
  @Prop({ default: '' })
  transcript: string;

  @Prop({ enum: ['none', 'pending', 'done', 'failed'], default: 'none' })
  transcriptionStatus: string;

  @Prop({ default: '' })
  transcriptionJobId: string;

  // ── Moderation audit trail ──────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User' })
  moderatedBy: Types.ObjectId;

  @Prop()
  moderatedByName: string;

  @Prop()
  moderatedAt: string;

  /** Reason shown to the submitter when rejected */
  @Prop()
  rejectionReason: string;

  /** Internal note visible only to admins/moderators */
  @Prop()
  moderationNote: string;

  // ── Featured ───────────────────────────────────────────
  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  voteCount: number;

  @Prop()
  votingCycleStartDate: string;

  @Prop()
  votingCycleEndDate: string;

  // ── Reporting System ───────────────────────────────────
  @Prop({ default: false })
  isReported: boolean;

  @Prop({ default: 0 })
  reportCount: number;

  @Prop({ type: [String], default: [] })
  reportReasons: string[];
}

export const VideoSchema = SchemaFactory.createForClass(Video);
