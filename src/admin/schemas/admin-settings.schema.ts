import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdminSettingsDocument = AdminSettings & Document;

@Schema({ timestamps: true })
export class AdminSettings {
  /** Singleton key — always 'global' */
  @Prop({ required: true, unique: true, default: 'global' })
  key: string;

  /** Words that trigger automatic rejection of transcribed videos */
  @Prop({ type: [String], default: [] })
  blockedWords: string[];
}

export const AdminSettingsSchema = SchemaFactory.createForClass(AdminSettings);
