import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PayoutBatchDocument = PayoutBatch & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    ret.cycleId = ret.cycleId?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class PayoutBatch {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'VotingCycle', required: true })
  cycleId: Types.ObjectId;

  @Prop({ enum: ['draft', 'review', 'processing', 'completed', 'failed'], default: 'draft' })
  status: string;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ default: 0 })
  processedAmount: number;

  @Prop()
  notes: string;

  @Prop()
  completedAt: string;

  @Prop()
  createdBy: string;
}

export const PayoutBatchSchema = SchemaFactory.createForClass(PayoutBatch);
