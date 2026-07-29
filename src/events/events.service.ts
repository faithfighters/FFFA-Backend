import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from './schemas/event.schema';

@Injectable()
export class EventsService {
  constructor(@InjectModel(Event.name) private eventModel: Model<EventDocument>) {}

  findAll(filter?: { status?: string }): Promise<EventDocument[]> {
    const query = filter?.status ? { status: filter.status } : {};
    return this.eventModel.find(query).sort({ createdAt: -1 }).exec();
  }

  findById(id: string): Promise<EventDocument | null> {
    return this.eventModel.findById(id).exec();
  }

  create(data: Partial<Event>): Promise<EventDocument> {
    return this.eventModel.create(data);
  }

  update(id: string, data: Partial<Event>): Promise<EventDocument | null> {
    return this.eventModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  delete(id: string): Promise<EventDocument | null> {
    return this.eventModel.findByIdAndDelete(id).exec();
  }
}
