import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentRecordDocument = PaymentRecord & Document;

@Schema({ timestamps: true })
export class PaymentRecord {
  @Prop({ required: true }) stripeInvoiceId: string;
  @Prop({ required: true }) stripeCustomerId: string;
  @Prop() stripeSubscriptionId: string;
  @Prop() userId: string;
  @Prop({ required: true }) amount: number;       // in dollars
  @Prop({ required: true }) plan: string;
  @Prop({ required: true }) paidAt: string;
  @Prop({ default: 'succeeded' }) status: string;
}

export const PaymentRecordSchema = SchemaFactory.createForClass(PaymentRecord);
PaymentRecordSchema.index({ stripeInvoiceId: 1 }, { unique: true });
