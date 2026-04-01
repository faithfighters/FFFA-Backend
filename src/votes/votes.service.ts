import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vote, VoteDocument } from './schemas/vote.schema';

@Injectable()
export class VotesService {
  constructor(@InjectModel(Vote.name) private voteModel: Model<VoteDocument>) {}

  findByUserAndCycle(userId: string, cycleId: string): Promise<VoteDocument[]> {
    return this.voteModel.find({
      userId: new Types.ObjectId(userId),
      cycleId: new Types.ObjectId(cycleId),
    }).exec();
  }

  findByCycle(cycleId: string): Promise<VoteDocument[]> {
    return this.voteModel.find({ cycleId: new Types.ObjectId(cycleId) }).exec();
  }

  create(data: { userId: string; causeId: string; cycleId: string; count: number }): Promise<VoteDocument> {
    return this.voteModel.create({
      userId: new Types.ObjectId(data.userId),
      causeId: new Types.ObjectId(data.causeId),
      cycleId: new Types.ObjectId(data.cycleId),
      count: data.count,
    });
  }
}
