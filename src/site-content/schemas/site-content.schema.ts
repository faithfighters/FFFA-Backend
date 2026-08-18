import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SiteContentDocument = SiteContent & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class SiteContent {
  @Prop({ required: true, unique: true, index: true })
  page: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  content: Record<string, any>;

  @Prop()
  updatedBy?: string;
}

export const SiteContentSchema = SchemaFactory.createForClass(SiteContent);
