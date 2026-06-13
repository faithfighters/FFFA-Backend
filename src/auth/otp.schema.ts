import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type OtpDocument = Otp & Document;

@Schema({ timestamps: true, collection: 'otps' })
export class Otp {
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true, enum: ['registration', 'forgot_password'] })
  type: string;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt: Date;

  @Prop({ type: MongooseSchema.Types.Mixed })
  registrationData?: {
    name: string;
    passwordHash: string;
    plan?: string;
  };
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// Compound index to ensure that a user can have at most one active OTP per action type.
// Upsert operations will target this key to safely handle resending/replacing OTPs.
OtpSchema.index({ email: 1, type: 1 }, { unique: true });
