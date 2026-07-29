import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContactMessage, ContactMessageDocument } from './schemas/contact-message.schema';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactMessage.name) private model: Model<ContactMessageDocument>,
  ) {}

  create(data: Partial<ContactMessage>): Promise<ContactMessageDocument> {
    return this.model.create(data);
  }

  findAll(): Promise<ContactMessageDocument[]> {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  updateStatus(id: string, status: string): Promise<ContactMessageDocument | null> {
    return this.model.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }
}
