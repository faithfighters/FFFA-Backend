import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notifModel: Model<NotificationDocument>,
  ) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    imageUrl?: string;
  }): Promise<NotificationDocument> {
    return this.notifModel.create({
      ...data,
      userId: new Types.ObjectId(data.userId),
    });
  }

  async findByUser(userId: string, limit = 30): Promise<NotificationDocument[]> {
    return this.notifModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notifModel.countDocuments({
      userId: new Types.ObjectId(userId),
      read: false,
    });
  }

  async markRead(notifId: string, userId: string): Promise<void> {
    await this.notifModel.updateOne(
      { _id: new Types.ObjectId(notifId), userId: new Types.ObjectId(userId) },
      { read: true },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifModel.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { read: true },
    );
  }
}
