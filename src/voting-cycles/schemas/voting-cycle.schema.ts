import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VotingCycleDocument = VotingCycle & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    if (Array.isArray(ret.causes)) {
      ret.causes = ret.causes.map((c: any) =>
        typeof c === 'object' && c !== null && !c._id ? c : c._id ? { ...c, id: c._id.toString() } : c.toString()
      );
    }
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class VotingCycle {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true })
  endDate: string;

  @Prop({ enum: ['active', 'closed', 'upcoming'], default: 'upcoming' })
  status: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Cause' }], default: [] })
  causes: Types.ObjectId[];

  // ── Closed-cycle snapshot ───────────────────────────────
  @Prop()
  closedAt: string;

  @Prop({ default: 0 })
  totalVotesCast: number;

  /** Dollar amount of the 80% charity pool for this cycle */
  @Prop({ default: 0 })
  charityPool: number;

  /**
   * Per-cause fund allocation — populated when the cycle is closed.
   * { causeId, causeName, votes, votePercentage, allocatedAmount }
   */
  @Prop({ type: Array, default: [] })
  fundDistribution: Record<string, any>[];
}

export const VotingCycleSchema = SchemaFactory.createForClass(VotingCycle);

export interface FundDistributionEntry {
  causeId: string;
  causeName: string;
  votes: number;
  votePercentage: number;
  allocatedAmount: number;
}
