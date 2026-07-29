import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContactMessageDocument = ContactMessage & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class ContactMessage {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  subject: string;

  @Prop({ required: true })
  message: string;

  /** landing-page submissions have no member account behind them */
  @Prop({ default: 'faith-fighters-site' })
  source: string;

  @Prop({ enum: ['new', 'read', 'replied', 'closed'], default: 'new' })
  status: string;
}

export const ContactMessageSchema = SchemaFactory.createForClass(ContactMessage);
