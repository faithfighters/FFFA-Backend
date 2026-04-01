import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    ret.userId = ret.userId?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: ['faith_builder', 'faith_hero', 'faith_fighter'], required: true })
  plan: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ enum: ['active', 'cancelled', 'past_due'], default: 'active' })
  status: string;

  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true })
  nextBillingDate: string;

  @Prop()
  stripeSubscriptionId: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
