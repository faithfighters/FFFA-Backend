import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(data: Partial<User>): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async update(id: string, updates: Partial<User>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  // Fix all users who have a plan but never got votes assigned (e.g. registered via OAuth or before vote tracking)
  async fixZeroVoteUsers(planVotes: Record<string, number>): Promise<number> {
    let fixed = 0;
    for (const [plan, votes] of Object.entries(planVotes)) {
      const result = await this.userModel.updateMany(
        { plan, votesTotal: 0 },
        { $set: { votesTotal: votes, votesRemaining: votes } },
      ).exec();
      fixed += result.modifiedCount;
    }
    return fixed;
  }

  sanitize(user: UserDocument) {
    const obj = user.toJSON() as any;
    const { passwordHash, ...safe } = obj;
    return safe;
  }
}
