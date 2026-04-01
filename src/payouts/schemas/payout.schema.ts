import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PayoutDocument = Payout & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    ret.causeId = ret.causeId?.toString();
    ret.cycleId = ret.cycleId?.toString();
    if (ret.charityId) ret.charityId = ret.charityId?.toString();
    if (ret.batchId) ret.batchId = ret.batchId?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class Payout {
  @Prop({ type: Types.ObjectId, ref: 'Cause', required: true })
  causeId: Types.ObjectId;

  @Prop({ required: true })
  causeName: string;

  @Prop({ type: Types.ObjectId, ref: 'Charity' })
  charityId: Types.ObjectId;

  @Prop()
  charityName: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ enum: ['ach', 'check', 'paypal'], required: true })
  paymentMethod: string;

  @Prop({ enum: ['pending', 'processing', 'paid', 'failed'], default: 'pending' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'VotingCycle', required: true })
  cycleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PayoutBatch' })
  batchId: Types.ObjectId;

  @Prop()
  receiptNumber: string;

  @Prop()
  notes: string;

  @Prop()
  processedAt: string;

  @Prop()
  processedBy: string;
}

export const PayoutSchema = SchemaFactory.createForClass(Payout);
