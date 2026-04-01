import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';

@Injectable()
export class SubscriptionsService {
  constructor(@InjectModel(Subscription.name) private subModel: Model<SubscriptionDocument>) {}

  findAll(): Promise<SubscriptionDocument[]> {
    return this.subModel.find().exec();
  }

  findActiveByUser(userId: string): Promise<SubscriptionDocument | null> {
    return this.subModel.findOne({ userId: new Types.ObjectId(userId), status: 'active' }).exec();
  }

  findByStripeSubscriptionId(stripeSubId: string): Promise<SubscriptionDocument | null> {
    return this.subModel.findOne({ stripeSubscriptionId: stripeSubId }).exec();
  }

  findByUserId(userId: string): Promise<SubscriptionDocument | null> {
    return this.subModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  create(data: Partial<Subscription>): Promise<SubscriptionDocument> {
    return this.subModel.create(data);
  }

  update(id: string, updates: Partial<Subscription>): Promise<SubscriptionDocument | null> {
    return this.subModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }
}
