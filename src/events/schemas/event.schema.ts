import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDocument = Event & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({ required: true })
  location: string;

  @Prop({ default: '' })
  coverImage: string;

  @Prop({ type: [String], default: [] })
  galleryImages: string[];

  @Prop({ enum: ['upcoming', 'past'], default: 'upcoming' })
  status: string;
}

export const EventSchema = SchemaFactory.createForClass(Event);
