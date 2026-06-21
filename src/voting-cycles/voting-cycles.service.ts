import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VotingCycle, VotingCycleDocument, FundDistributionEntry } from './schemas/voting-cycle.schema';
import { CausesService } from '../causes/causes.service';

@Injectable()
export class VotingCyclesService {
  constructor(
    @InjectModel(VotingCycle.name) private cycleModel: Model<VotingCycleDocument>,
    private readonly causesService: CausesService,
  ) {}

  findAll(): Promise<VotingCycleDocument[]> {
    return this.cycleModel.find().sort({ createdAt: -1 }).exec();
  }

  async findActive(): Promise<VotingCycleDocument | null> {
    const activeCauses = await this.causesService.findActive();
    const activeCauseIds = activeCauses.map(c => c._id.toString());

    let cycle = await this.cycleModel.findOne({ status: 'active' }).exec();
    const targetEndDate = '2030-11-30T23:59:59.000Z';
    const targetStartDate = '2026-06-01T00:00:00.000Z';

    if (!cycle) {
      cycle = await this.cycleModel.create({
        name: 'Global Voting Cycle',
        startDate: targetStartDate,
        endDate: targetEndDate,
        status: 'active',
        causes: activeCauseIds.map(id => new Types.ObjectId(id)),
      });
    } else {
      let needsUpdate = false;
      if (cycle.endDate !== targetEndDate) {
        cycle.endDate = targetEndDate;
        needsUpdate = true;
      }

      const currentCauseIds = (cycle.causes || []).map(id => id.toString());
      const hasAllCauses = activeCauseIds.every(id => currentCauseIds.includes(id)) &&
                           currentCauseIds.every(id => activeCauseIds.includes(id));
      
      if (!hasAllCauses) {
        cycle.causes = activeCauseIds.map(id => new Types.ObjectId(id)) as any;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.cycleModel.findByIdAndUpdate(cycle._id, {
          endDate: targetEndDate,
          causes: activeCauseIds.map(id => new Types.ObjectId(id)),
        }).exec();
      }
    }

    return this.cycleModel.findById(cycle._id).populate('causes').exec();
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
