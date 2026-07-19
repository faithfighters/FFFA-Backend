import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  /** member | moderator | admin */
  @Prop({ enum: ['member', 'moderator', 'admin'], default: 'member' })
  role: string;

  /** donor = pays $30 membership upfront, full access | recipient = free signup, submits help videos, paywalled until subscribed */
  @Prop({ enum: ['donor', 'recipient'], default: 'donor' })
  userType: string;

  @Prop({ enum: ['faith_builder', 'faith_hero', 'faith_fighter'] })
  plan: string;

  @Prop({ default: 0 })
  votesRemaining: number;

  @Prop({ default: 0 })
  votesTotal: number;

  /** Booster votes purchased separately — no daily limit applies */
  @Prop({ default: 0 })
  boosterVotesRemaining: number;

  @Prop()
  stripeCustomerId: string;

  @Prop()
  stripeSubscriptionId: string;

  /** Session IDs already synced — prevents vote inflation from repeated /sync calls */
  @Prop({ type: [String], default: [] })
  syncedSessionIds: string[];

  @Prop()
  image: string;

  @Prop()
  joinedAt: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ stripeCustomerId: 1 });
