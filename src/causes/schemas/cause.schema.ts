import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CauseDocument = Cause & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    if (ret.submittedBy) ret.submittedBy = ret.submittedBy?.toString();
    if (ret.moderatedBy) ret.moderatedBy = ret.moderatedBy?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class Cause {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  category: string;

  @Prop({ default: 0 })
  totalVotes: number;

  @Prop({ required: true })
  goalAmount: number;

  @Prop({ default: 0 })
  raisedAmount: number;

  @Prop({ default: '' })
  image: string;

  /**
   * pending  → awaiting moderator review
   * active   → approved, eligible for voting cycles
   * rejected → declined by moderator
   * funded   → voting cycle completed, funds distributed
   * closed   → archived
   */
  @Prop({ enum: ['pending', 'active', 'rejected', 'funded', 'closed'], default: 'pending' })
  status: string;

  // ── Submission metadata ─────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User' })
  submittedBy: Types.ObjectId;

  @Prop()
  submittedByName: string;

  // ── Moderation audit trail ──────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User' })
  moderatedBy: Types.ObjectId;

  @Prop()
  moderatedByName: string;

  @Prop()
  moderatedAt: string;

  @Prop()
  rejectionReason: string;

  @Prop()
  moderationNote: string;
}

export const CauseSchema = SchemaFactory.createForClass(Cause);
