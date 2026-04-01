import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VotingCycle, VotingCycleDocument, FundDistributionEntry } from './schemas/voting-cycle.schema';

@Injectable()
export class VotingCyclesService {
  constructor(@InjectModel(VotingCycle.name) private cycleModel: Model<VotingCycleDocument>) {}

  findAll(): Promise<VotingCycleDocument[]> {
    return this.cycleModel.find().sort({ createdAt: -1 }).exec();
  }

  findActive(): Promise<VotingCycleDocument | null> {
    return this.cycleModel.findOne({ status: 'active' }).populate('causes').exec();
  }

  findById(id: string): Promise<VotingCycleDocument | null> {
    return this.cycleModel.findById(id).populate('causes').exec();
  }

  create(data: Partial<VotingCycle>): Promise<VotingCycleDocument> {
    return this.cycleModel.create(data);
  }

  update(id: string, updates: Partial<VotingCycle>): Promise<VotingCycleDocument | null> {
    return this.cycleModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  closeActive(): Promise<any> {
    return this.cycleModel.updateMany({ status: 'active' }, { status: 'closed' }).exec();
  }

  /**
   * Close a specific cycle and store the vote-proportional fund distribution.
   * Called by AdminController after it calculates voteAggregates + charityPool.
   */
  async closeCycle(
    id: string,
    charityPool: number,
    voteAggregates: { causeId: string; causeName: string; votes: number }[],
  ): Promise<VotingCycleDocument> {
    const cycle = await this.cycleModel.findById(id).exec();
    if (!cycle) throw new NotFoundException('Voting cycle not found.');
    if (cycle.status === 'closed') throw new BadRequestException('Cycle is already closed.');

    const totalVotes = voteAggregates.reduce((s, v) => s + v.votes, 0);

    const fundDistribution: FundDistributionEntry[] = voteAggregates.map(v => ({
      causeId: v.causeId,
      causeName: v.causeName,
      votes: v.votes,
      votePercentage: totalVotes > 0 ? Math.round((v.votes / totalVotes) * 10000) / 100 : 0,
      allocatedAmount: totalVotes > 0
        ? Math.round((v.votes / totalVotes) * charityPool * 100) / 100
        : 0,
    }));

    const updated = await this.cycleModel.findByIdAndUpdate(
      id,
      {
        status: 'closed',
        closedAt: new Date().toISOString(),
        totalVotesCast: totalVotes,
        charityPool,
        fundDistribution,
      },
      { new: true },
    ).exec();

    return updated!;
  }

  /** Get results for a closed cycle (populate causes + distribution) */
  async getResults(id: string): Promise<VotingCycleDocument> {
    const cycle = await this.cycleModel.findById(id).populate('causes').exec();
    if (!cycle) throw new NotFoundException('Voting cycle not found.');
    return cycle;
  }
}
