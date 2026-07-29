import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SsoJtiDocument = SsoJti & Document;

@Schema({ timestamps: true, collection: 'sso_jtis' })
export class SsoJti {
  @Prop({ required: true, unique: true })
  jti: string;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt: Date;
}

export const SsoJtiSchema = SchemaFactory.createForClass(SsoJti);
