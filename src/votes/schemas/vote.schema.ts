import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VoteDocument = Vote & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    ret.userId = ret.userId?.toString();
    ret.causeId = ret.causeId?.toString();
    ret.cycleId = ret.cycleId?.toString();
    if (ret.videoId) ret.videoId = ret.videoId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class Vote {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cause', required: true })
  causeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'VotingCycle', required: true })
  cycleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Video', required: false })
  videoId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  count: number;
}

export const VoteSchema = SchemaFactory.createForClass(Vote);
