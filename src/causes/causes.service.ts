import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cause, CauseDocument } from './schemas/cause.schema';

@Injectable()
export class CausesService {
  constructor(@InjectModel(Cause.name) private causeModel: Model<CauseDocument>) {}

  findAll(): Promise<CauseDocument[]> {
    return this.causeModel.find().sort({ createdAt: -1 }).exec();
  }

  findByStatus(status: string | string[]): Promise<CauseDocument[]> {
    const filter = Array.isArray(status) ? { status: { $in: status } } : { status };
    return this.causeModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  findActive(): Promise<CauseDocument[]> {
    return this.causeModel.find({ status: 'active' }).exec();
  }

  findPending(): Promise<CauseDocument[]> {
    return this.causeModel.find({ status: 'pending' }).sort({ createdAt: 1 }).exec();
  }

  findById(id: string): Promise<CauseDocument | null> {
    return this.causeModel.findById(id).exec();
  }

  create(data: Partial<Cause>): Promise<CauseDocument> {
    return this.causeModel.create(data);
  }

  update(id: string, updates: Partial<Cause>): Promise<CauseDocument | null> {
    return this.causeModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  countByStatus(): Promise<{ _id: string; count: number }[]> {
    return this.causeModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec();
  }
}
